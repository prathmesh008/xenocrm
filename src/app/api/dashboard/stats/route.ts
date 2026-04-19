import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Campaign from '@/models/Campaign';
import Customer from '@/models/Customer';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();

  // Fetch last 7 campaigns (reversed to chronological for chart)
  const campaigns = await Campaign.find({
    $or: [{ userId: session.user.id }, { userId: 'system' }],
  })
    .sort({ createdAt: -1 })
    .limit(7)
    .select('name sentCount failedCount audienceSize createdAt tag')
    .lean();

  // Count customers in each spend tier
  const [vip, high, mid, low] = await Promise.all([
    Customer.countDocuments({ spend: { $gte: 5000 } }),
    Customer.countDocuments({ spend: { $gte: 2000, $lt: 5000 } }),
    Customer.countDocuments({ spend: { $gte: 500, $lt: 2000 } }),
    Customer.countDocuments({ spend: { $lt: 500 } }),
  ]);

  // Overall totals across all campaigns
  const totals = campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sentCount || 0),
      failed: acc.failed + (c.failedCount || 0),
    }),
    { sent: 0, failed: 0 }
  );

  const overallSuccessRate =
    totals.sent + totals.failed > 0
      ? ((totals.sent / (totals.sent + totals.failed)) * 100).toFixed(1)
      : '0';

  return NextResponse.json({
    // Chronological order for the line/bar chart
    campaigns: campaigns.reverse().map((c) => ({
      name: c.name.replace('Campaign for ', '').slice(0, 18),
      sent: c.sentCount || 0,
      failed: c.failedCount || 0,
      audienceSize: c.audienceSize || 0,
      successRate:
        c.sentCount + c.failedCount > 0
          ? +((c.sentCount / (c.sentCount + c.failedCount)) * 100).toFixed(1)
          : 0,
    })),
    spendTiers: [
      { tier: 'VIP >₹5k', count: vip, color: '#7c3aed' },
      { tier: 'High ₹2k-5k', count: high, color: '#2563eb' },
      { tier: 'Mid ₹500-2k', count: mid, color: '#16a34a' },
      { tier: 'Low <₹500', count: low, color: '#f59e0b' },
    ],
    summary: {
      totalSent: totals.sent,
      totalFailed: totals.failed,
      overallSuccessRate,
    },
  });
}