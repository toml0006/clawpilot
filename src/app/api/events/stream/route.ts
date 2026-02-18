import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";

/**
 * Server-Sent Events endpoint for realtime event streaming
 *
 * Query params:
 * - taskId: Filter events by task
 * - jobId: Filter events by job
 * - since: Only events after this ISO timestamp
 */
export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const taskId = request.nextUrl.searchParams.get("taskId");
  const jobId = request.nextUrl.searchParams.get("jobId");
  const since = request.nextUrl.searchParams.get("since");

  const encoder = new TextEncoder();
  let lastEventTs = since ? new Date(since) : new Date();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`)
      );

      // Poll for new events
      const pollInterval = setInterval(async () => {
        if (closed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const where: Record<string, unknown> = {
            ts: { gt: lastEventTs },
          };

          if (taskId) where.taskId = taskId;
          if (jobId) where.jobId = jobId;

          const events = await prisma.event.findMany({
            where,
            include: {
              task: { select: { id: true, title: true } },
              job: { select: { id: true, status: true } },
            },
            orderBy: { ts: "asc" },
            take: 50,
          });

          for (const event of events) {
            const data = JSON.stringify({
              ...event,
              data: event.data ? JSON.parse(event.data) : null,
            });
            controller.enqueue(encoder.encode(`event: event\ndata: ${data}\n\n`));
            lastEventTs = event.ts;
          }

          // Send keepalive
          if (events.length === 0) {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          }
        } catch (error) {
          console.error("SSE poll error:", error);
        }
      }, 1000); // Poll every second

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
