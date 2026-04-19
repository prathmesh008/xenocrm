import { NextResponse } from "next/server";
import connectDB from "@/lib/mongoose";
import Campaign from "@/models/Campaign";
import Segment from "@/models/Segment";
import Customer from "@/models/Customer";
import { vendorApi } from "@/lib/vendorApi";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { logger } from "@/lib/logger";
// import { progressStore } from './progress/route';
import { progressStore } from '@/lib/progressStore';
interface CustomerDocument {
  _id?: any;
  id?: string;
  name?: string;
  email?: string;
}

const campaignSchema = z.object({
  segmentId: z.string(),
  name: z.string().min(1, "Name is required"),
  message: z.string().optional().default(""),
  tag: z.string().optional().default("General")
});

// Runs in background after API returns
async function processCampaignInBackground(
  campaignId: string,
  customers: any[],
  message: string,
) {
  const MAX_BATCH_SIZE = 50;
  let sentCount = 0;
  let failedCount = 0;
  const totalBatches = Math.ceil(customers.length / MAX_BATCH_SIZE);
  const allPromises: Promise<any>[] = [];
  const results: any[] = [];

  logger.info(`Campaign ${campaignId}: processing ${customers.length} customers in ${totalBatches} batches`);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * MAX_BATCH_SIZE;
    const endIdx = Math.min((batchIndex + 1) * MAX_BATCH_SIZE, customers.length);
    const batchCustomers = customers.slice(startIdx, endIdx);
    const batchPromises: Promise<any>[] = [];

    for (const customer of batchCustomers) {
      const c = customer as CustomerDocument;
      const customerId = c._id ? c._id.toString() : (c.id || '');

      const promise = vendorApi.sendMessage(
        { id: customerId, name: c.name || "", email: c.email || "" },
        message,
        campaignId
      ).then(result => {
        results.push(result);
        if (result.status === "SENT") sentCount++;
        else failedCount++;

        // Update live progress every 10 messages
        if (results.length % 10 === 0 || results.length === customers.length) {
          progressStore.set(campaignId, {
            sent: sentCount,
            failed: failedCount,
            total: customers.length,
            done: false
          });
        }
        return result;
      });

      batchPromises.push(promise);
      allPromises.push(promise);
    }

    try {
      await Promise.all(batchPromises);
      logger.info(`Batch ${batchIndex + 1}/${totalBatches} completed`);
    } catch (error) {
      logger.error(`Error in batch ${batchIndex + 1}`, error);
    }

    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  try {
    await Promise.all(allPromises);
  } catch (error) {
    logger.error('Error processing messages', error);
  }

  if (typeof vendorApi._processBatch === 'function') {
    try { await vendorApi._processBatch(); } catch {}
  }

  // Save final counts to DB
  await Campaign.findByIdAndUpdate(campaignId, { sentCount, failedCount });

  // Mark done so SSE closes and frontend redirects
  progressStore.set(campaignId, {
    sent: sentCount,
    failed: failedCount,
    total: customers.length,
    done: true
  });

  logger.info(`Campaign ${campaignId} done: ${sentCount} sent, ${failedCount} failed`);
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const session = await getServerSession(authOptions);

    try {
      const { segmentId, name } = campaignSchema.parse(body);

      const segment = await Segment.findById(segmentId);
      if (!segment) {
        return NextResponse.json({ error: "Segment not found" }, { status: 404 });
      }

      const query = segment.filter || {};
      const customers = await Customer.find(query).lean();
      const userId = (session?.user as any)?.id?.toString() || session?.user?.email || 'system';

      const campaign = await Campaign.create({
        userId,
        name,
        audienceSize: customers.length,
        sentCount: 0,
        failedCount: 0,
        tag: body.tag || 'General',
        customers: customers.map((c: CustomerDocument) =>
          c._id ? c._id.toString() : (c.id || '')
        )
      });

      const campaignId = campaign._id.toString();
      const message = body.message || segment.messageContent || "";

      // Initialize progress immediately so SSE has something to read
      progressStore.set(campaignId, {
        sent: 0,
        failed: 0,
        total: customers.length,
        done: false
      });

      vendorApi.resetStats();

      // Fire and forget -- don't await, return immediately
      processCampaignInBackground(campaignId, customers, message);

      // Return right away so frontend can connect SSE before processing starts
      return NextResponse.json(
        { message: "Campaign created successfully", campaign, campaignId },
        { status: 201 }
      );

    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: validationError.errors },
          { status: 400 }
        );
      }
      throw validationError;
    }
  } catch (error) {
    logger.error(`Failed to create campaign`, error);
    return NextResponse.json(
      { error: "Failed to create campaign", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || 'system';

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
    const search = searchParams.get('search') || '';

    const query: any = {
      $or: [{ userId }, { userId: 'system' }]
    };

    if (search) query.name = { $regex: search, $options: 'i' };

    const totalCount = await Campaign.countDocuments(query);
    const campaigns = await Campaign.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const campaignStats = campaigns.map(campaign => ({
      ...campaign,
      successRate: campaign.sentCount > 0
        ? ((campaign.sentCount / (campaign.sentCount + campaign.failedCount)) * 100).toFixed(2)
        : 0
    }));

    return NextResponse.json({
      campaigns: campaignStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit
      }
    });

  } catch (error) {
    logger.error(`Error fetching campaigns`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}