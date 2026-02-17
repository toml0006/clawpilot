import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { buildTransitionPatch } from "@/lib/tasks/transition";

export type ActorContext = {
  actorType: "human" | "agent" | "system";
  actorId?: string | null;
  requestId?: string | null;
};

export async function getDefaultWorkflowState() {
  const state = await prisma.workflowState.findFirst({
    where: { isDefault: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  if (state) return state;

  const fallback = await prisma.workflowState.findFirst({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  if (!fallback) {
    throw new Error("No workflow states configured");
  }

  return fallback;
}

export async function resolveWorkflowState(input: {
  workflowStateId?: string | null;
  statusKey?: string | null;
}) {
  if (input.workflowStateId) {
    const byId = await prisma.workflowState.findUnique({ where: { id: input.workflowStateId } });
    if (byId) return byId;
  }

  if (input.statusKey) {
    const normalized = input.statusKey.trim().toLowerCase();
    const byKey = await prisma.workflowState.findUnique({ where: { key: normalized } });
    if (byKey) return byKey;
  }

  return getDefaultWorkflowState();
}

export async function transitionTask(input: {
  taskId: string;
  toStateId: string;
  reason?: string | null;
  actor: ActorContext;
}) {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    include: { workflowState: true, project: true },
  });
  if (!task) {
    throw new Error("Task not found");
  }

  const toState = await prisma.workflowState.findUnique({ where: { id: input.toStateId } });
  if (!toState) {
    throw new Error("Destination state not found");
  }

  const before = {
    workflowStateId: task.workflowStateId,
    status: task.status,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    canceledAt: task.canceledAt,
    revision: task.revision,
  };

  const patch = buildTransitionPatch(task, toState);

  const updated = await prisma.$transaction(async (tx) => {
    const nextTask = await tx.task.update({
      where: { id: task.id },
      data: patch,
      include: { workflowState: true, project: true },
    });

    await tx.taskTransition.create({
      data: {
        taskId: task.id,
        fromStateId: task.workflowStateId,
        toStateId: toState.id,
        reason: input.reason ?? null,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId ?? null,
        requestId: input.actor.requestId ?? null,
      },
    });

    return nextTask;
  });

  await writeAuditLog({
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    action: "task.transition",
    entityType: "task",
    entityId: task.id,
    before,
    after: {
      workflowStateId: updated.workflowStateId,
      status: updated.status,
      startedAt: updated.startedAt,
      completedAt: updated.completedAt,
      canceledAt: updated.canceledAt,
      revision: updated.revision,
    },
    requestId: input.actor.requestId,
    metadata: {
      reason: input.reason,
      fromStateId: task.workflowStateId,
      toStateId: toState.id,
    },
  });

  return updated;
}
