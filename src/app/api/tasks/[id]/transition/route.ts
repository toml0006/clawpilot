import { NextRequest, NextResponse } from "next/server";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { transitionTask } from "@/lib/tasks/taskMutations";
import { mapTaskResponse } from "@/lib/workflow";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { workflowStateId, status, reason } = body as Record<string, unknown>;

  const toState =
    typeof workflowStateId === "string"
      ? await prisma.workflowState.findUnique({ where: { id: workflowStateId } })
      : typeof status === "string"
        ? await prisma.workflowState.findUnique({
            where: { key: status.trim().toLowerCase() },
          })
        : null;

  if (!toState) {
    return NextResponse.json(
      { error: "workflowStateId or status is required and must match a state" },
      { status: 400 }
    );
  }

  if (toState.category === "canceled" && (typeof reason !== "string" || reason.trim().length === 0)) {
    return NextResponse.json(
      { error: "reason is required when transitioning to canceled" },
      { status: 400 }
    );
  }

  try {
    const updated = await transitionTask({
      taskId: id,
      toStateId: toState.id,
      reason: typeof reason === "string" ? reason.trim() : null,
      actor: {
        actorType: "human",
        requestId: request.headers.get("x-clawpilot-request-id"),
      },
    });

    return NextResponse.json(mapTaskResponse(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to transition task";
    const statusCode = message === "Task not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
