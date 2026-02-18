import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { jobRunner } from "@/lib/jobRunner";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const jobs = await prisma.job.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    include: {
      events: {
        orderBy: { ts: "desc" },
        take: 10,
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(jobs);
}

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine
  }

  const model = typeof body.model === "string" ? body.model : undefined;
  const thinking = typeof body.thinking === "string" ? body.thinking : undefined;

  const result = await jobRunner.startJob({
    taskId,
    model,
    thinking,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, jobId: result.jobId },
      { status: 400 }
    );
  }

  await writeAuditLog({
    actorType: "human",
    action: "job.start",
    entityType: "job",
    entityId: result.jobId!,
    after: { taskId, sessionKey: result.sessionKey },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  const job = await prisma.job.findUnique({
    where: { id: result.jobId },
    include: {
      events: { orderBy: { ts: "desc" }, take: 5 },
    },
  });

  return NextResponse.json(job, { status: 201 });
}
