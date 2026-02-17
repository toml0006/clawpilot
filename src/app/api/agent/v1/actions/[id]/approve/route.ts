import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { executeApprovedAction } from "@/lib/policy/approvalExecutor";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  resolvedBy: z.string().trim().optional(),
  execute: z.boolean().optional(),
});

function parsePayload(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();
  const { id } = await params;

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const actionRequest = await prisma.agentActionRequest.findUnique({ where: { id } });
  if (!actionRequest) {
    return NextResponse.json({ error: "Action request not found" }, { status: 404 });
  }

  if (actionRequest.status !== "pending") {
    return NextResponse.json(
      { error: `Action request is already ${actionRequest.status}` },
      { status: 409 }
    );
  }

  const resolvedBy = parsed.data.resolvedBy ?? "human";

  const approved = await prisma.agentActionRequest.update({
    where: { id },
    data: {
      status: "approved",
      resolvedBy,
      resolvedAt: new Date(),
    },
  });

  const execute = parsed.data.execute !== false;
  const execution = execute
    ? await executeApprovedAction({
        actionRequestId: id,
        resolvedBy,
      })
    : { executed: false, reason: "manual-execution" as const };

  await writeAuditLog({
    actorType: "human",
    actorId: resolvedBy,
    action: "agent_action.approve",
    entityType: "agent_action_request",
    entityId: id,
    before: actionRequest,
    after: approved,
    requestId: request.headers.get("x-clawpilot-request-id"),
    metadata: { execution },
  });

  return NextResponse.json({
    ...approved,
    payload: parsePayload(approved.payload),
    execution,
  });
}
