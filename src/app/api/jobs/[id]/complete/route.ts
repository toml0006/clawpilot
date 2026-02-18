import { NextRequest, NextResponse } from "next/server";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { jobRunner } from "@/lib/jobRunner";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine
  }

  const summary = typeof body.summary === "string" ? body.summary : undefined;

  const result = await jobRunner.completeJob(id, summary);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await writeAuditLog({
    actorType: "human",
    action: "job.complete",
    entityType: "job",
    entityId: id,
    after: { summary },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ ok: true });
}
