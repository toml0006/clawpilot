import { NextRequest, NextResponse } from "next/server";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { jobRunner } from "@/lib/jobRunner";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id } = await context.params;

  const result = await jobRunner.cancelJob(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await writeAuditLog({
    actorType: "human",
    action: "job.cancel",
    entityType: "job",
    entityId: id,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ ok: true });
}
