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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const error = body.error;
  if (typeof error !== "string" || error.trim().length === 0) {
    return NextResponse.json({ error: "error message is required" }, { status: 400 });
  }

  const result = await jobRunner.failJob(id, error);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await writeAuditLog({
    actorType: "human",
    action: "job.fail",
    entityType: "job",
    entityId: id,
    after: { error },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ ok: true });
}
