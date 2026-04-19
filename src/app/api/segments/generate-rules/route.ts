import { NextResponse } from 'next/server';
import { parseSegmentRules } from '@/lib/ai';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const rules = await parseSegmentRules(prompt);
    return NextResponse.json({ rules });
  } catch (error) {
    logger.error('Error generating segment rules from AI:', error);
    return NextResponse.json({ error: 'Failed to generate segment rules' }, { status: 500 });
  }
}
