import { prisma } from "@/lib/prisma";
import { transitionTask } from "@/lib/tasks/taskMutations";
import { writeAuditLog } from "@/lib/audit";

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function executeApprovedAction(input: {
  actionRequestId: string;
  resolvedBy: string;
}) {
  const actionRequest = await prisma.agentActionRequest.findUnique({
    where: { id: input.actionRequestId },
    include: { task: { include: { workflowState: true } } },
  });

  if (!actionRequest) {
    throw new Error("Action request not found");
  }

  if (actionRequest.status !== "approved") {
    return { executed: false, reason: "not-approved" as const };
  }

  const payload = parsePayload(actionRequest.payload);

  if (!actionRequest.taskId) {
    return { executed: false, reason: "no-task" as const };
  }

  if (actionRequest.action === "task.archive") {
    const task = await prisma.task.update({
      where: { id: actionRequest.taskId },
      data: {
        archivedAt: new Date(),
        revision: { increment: 1 },
      },
      include: { workflowState: true },
    });

    await writeAuditLog({
      actorType: "human",
      actorId: input.resolvedBy,
      action: "task.archive",
      entityType: "task",
      entityId: task.id,
      after: task,
      metadata: {
        sourceActionRequestId: actionRequest.id,
      },
    });

    return { executed: true, taskId: task.id };
  }

  if (actionRequest.action === "task.unarchive") {
    const task = await prisma.task.update({
      where: { id: actionRequest.taskId },
      data: {
        archivedAt: null,
        revision: { increment: 1 },
      },
      include: { workflowState: true },
    });

    await writeAuditLog({
      actorType: "human",
      actorId: input.resolvedBy,
      action: "task.unarchive",
      entityType: "task",
      entityId: task.id,
      after: task,
      metadata: {
        sourceActionRequestId: actionRequest.id,
      },
    });

    return { executed: true, taskId: task.id };
  }

  if (
    actionRequest.action === "task.reopen" ||
    actionRequest.action === "task.transition" ||
    actionRequest.action === "task.complete"
  ) {
    const workflowStateId =
      typeof payload.workflowStateId === "string" ? payload.workflowStateId : undefined;
    const status = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : undefined;

    const toState = workflowStateId
      ? await prisma.workflowState.findUnique({ where: { id: workflowStateId } })
      : status
        ? await prisma.workflowState.findUnique({ where: { key: status } })
        : actionRequest.action === "task.complete"
          ? await prisma.workflowState.findUnique({ where: { key: "done" } })
          : null;

    if (!toState) {
      return { executed: false, reason: "state-missing" as const };
    }

    const updated = await transitionTask({
      taskId: actionRequest.taskId,
      toStateId: toState.id,
      reason:
        typeof payload.reason === "string" && payload.reason.trim().length > 0
          ? payload.reason.trim()
          : `Approved action: ${actionRequest.action}`,
      actor: {
        actorType: "human",
        actorId: input.resolvedBy,
      },
    });

    return { executed: true, taskId: updated.id };
  }

  return { executed: false, reason: "unsupported-action" as const };
}
