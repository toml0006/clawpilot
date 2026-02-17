import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  reason: z.string().trim().min(1),
  resolvedBy: z.string().trim().optional(),
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  const rejected = await prisma.agentActionRequest.update({
    where: { id },
    data: {
      status: "rejected",
      decisionReason: parsed.data.reason,
      resolvedBy,
      resolvedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorType: "human",
    actorId: resolvedBy,
    action: "agent_action.reject",
    entityType: "agent_action_request",
    entityId: id,
    before: actionRequest,
    after: rejected,
    requestId: request.headers.get("x-clawpilot-request-id"),
    metadata: {
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({
    ...rejected,
    payload: parsePayload(rejected.payload),
  });
}
