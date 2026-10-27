import { sseBroker } from '@/lib/sse-broker';


export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cycleId } = await params;
  const channel = `cycle:${cycleId}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ connected: true, cycleId })}\n\n`));

      const unsubscribe = sseBroker.subscribe(channel, (eventData) => {
        try {
          const payload = `event: ${eventData.event}\ndata: ${JSON.stringify(eventData.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (err) {
          console.error('Error writing to SSE stream:', err);
        }
      });

      // Keep connection alive with ping every 15 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // stream already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
