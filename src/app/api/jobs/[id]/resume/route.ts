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

  const answer = body.answer;
  if (typeof answer !== "string" || answer.trim().length === 0) {
    return NextResponse.json({ error: "answer is required" }, { status: 400 });
  }

  const result = await jobRunner.resumeJob(id, answer);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await writeAuditLog({
    actorType: "human",
    action: "job.resume",
    entityType: "job",
    entityId: id,
    after: { answer },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ ok: true });
}
