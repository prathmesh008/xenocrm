import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Customer from '@/models/Customer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST() {
  await connectDB();

  // Sample a snapshot of customer stats to feed Gemini
  const [vip, high, mid, low, totalCount, topSpenders] = await Promise.all([
    Customer.countDocuments({ spend: { $gte: 5000 } }),
    Customer.countDocuments({ spend: { $gte: 2000, $lt: 5000 } }),
    Customer.countDocuments({ spend: { $gte: 500,  $lt: 2000 } }),
    Customer.countDocuments({ spend: { $lt: 500 } }),
    Customer.countDocuments(),
    Customer.find()
      .sort({ spend: -1 })
      .limit(5)
      .select('name spend visits orders')
      .lean(),
  ]);

  const avgSpend = await Customer.aggregate([
    { $group: { _id: null, avg: { $avg: '$spend' } } },
  ]);

  const snapshot = {
    totalCustomers: totalCount,
    averageSpend: Math.round(avgSpend[0]?.avg || 0),
    tiers: { vip, high, mid, low },
    topSpenders: topSpenders.map((c) => ({
      spend: c.spend,
      visits: c.visits,
      orders: c.orders,
    })),
  };

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a CRM analyst. Based on this customer data snapshot, suggest ONE specific audience segment to target for a marketing campaign.

Customer data:
${JSON.stringify(snapshot, null, 2)}

Respond in this exact format (3 short paragraphs, no markdown, no bullet points):
1. WHO to target: describe the segment in plain English (e.g. "Customers who spent over ₹2000 but haven't visited in 30+ days")
2. WHY this segment: explain the business rationale in 1-2 sentences
3. WHAT to say: suggest a campaign message angle (1 sentence)

Keep the entire response under 120 words. Be specific and actionable.`;

  try {
    const result = await model.generateContent(prompt);
    const suggestion = result.response.text().trim();
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Gemini error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestion' },
      { status: 500 }
    );
  }
}