import { NextRequest } from 'next/server';
import { progressStore } from '@/lib/progressStore';

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaignId');
  if (!campaignId) return new Response('Missing campaignId', { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          const progress = progressStore.get(campaignId);
          
          if (progress) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify(progress)}\n\n`
            ));
            if (progress.done) {
              clearInterval(interval);
              controller.close();
            }
          } else {
            // Heartbeat -- keep connection alive while campaign initializes
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ sent: 0, failed: 0, total: 0, done: false })}\n\n`
            ));
          }
        } catch {
          clearInterval(interval);
        }
      }, 300); // 300ms for snappier updates

      setTimeout(() => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      }, 300000);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}