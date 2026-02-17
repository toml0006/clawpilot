import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { buildTransitionPatch } from "@/lib/tasks/transition";
import { mapTaskResponse } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { workflowState: true, project: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    workflowStateId,
    status,
    orderedIds: rawOrderedIds,
  } = body as Record<string, unknown>;

  const targetState =
    typeof workflowStateId === "string"
      ? await prisma.workflowState.findUnique({ where: { id: workflowStateId } })
      : typeof status === "string"
        ? await prisma.workflowState.findUnique({ where: { key: status.trim().toLowerCase() } })
        : null;

  if (!targetState) {
    return NextResponse.json(
      { error: "workflowStateId or status is required and must reference a valid state" },
      { status: 400 }
    );
  }

  if (!Array.isArray(rawOrderedIds) || rawOrderedIds.length === 0) {
    return NextResponse.json(
      { error: "orderedIds must be a non-empty array" },
      { status: 400 }
    );
  }

  if (!rawOrderedIds.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return NextResponse.json(
      { error: "orderedIds must contain non-empty string IDs" },
      { status: 400 }
    );
  }

  const orderedIds = rawOrderedIds as string[];
  if (!orderedIds.includes(id)) {
    return NextResponse.json(
      { error: "orderedIds must include moved task ID" },
      { status: 400 }
    );
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    return NextResponse.json(
      { error: "orderedIds must not include duplicates" },
      { status: 400 }
    );
  }

  const destinationTasks = await prisma.task.findMany({
    where: {
      workflowStateId: targetState.id,
      NOT: { id },
    },
    select: { id: true },
  });

  const expectedSet = new Set([...destinationTasks.map((task) => task.id), id]);
  if (
    orderedIds.length !== expectedSet.size ||
    orderedIds.some((taskId) => !expectedSet.has(taskId))
  ) {
    return NextResponse.json(
      {
        error:
          "orderedIds must contain exactly the destination column task IDs including the moved task",
      },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (let priority = 0; priority < orderedIds.length; priority += 1) {
      const taskId = orderedIds[priority];
      if (taskId === id) {
        const patch =
          existing.workflowStateId === targetState.id
            ? {
                workflowStateId: targetState.id,
                status: targetState.key,
                priority,
                revision: { increment: 1 as const },
              }
            : {
                ...buildTransitionPatch(existing, targetState),
                priority,
              };

        await tx.task.update({
          where: { id: taskId },
          data: patch,
        });
      } else {
        await tx.task.update({
          where: { id: taskId },
          data: {
            priority,
            revision: { increment: 1 },
          },
        });
      }
    }

    if (existing.workflowStateId !== targetState.id) {
      await tx.taskTransition.create({
        data: {
          taskId: existing.id,
          fromStateId: existing.workflowStateId,
          toStateId: targetState.id,
          reason: "Task reordered",
          actorType: "human",
        },
      });
    }

    return tx.task.findUnique({
      where: { id },
      include: { workflowState: true, project: true },
    });
  });

  if (!updated) {
    return NextResponse.json({ error: "Task not found after update" }, { status: 404 });
  }

  await writeAuditLog({
    actorType: "human",
    action: "task.reorder",
    entityType: "task",
    entityId: id,
    before: mapTaskResponse(existing),
    after: mapTaskResponse(updated),
    requestId: request.headers.get("x-clawpilot-request-id"),
    metadata: {
      orderedIds,
      workflowStateId: targetState.id,
    },
  });

  return NextResponse.json(mapTaskResponse(updated));
}
