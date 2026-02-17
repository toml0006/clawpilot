import type { Task, WorkflowState } from "@/generated/prisma/client";

export type TaskWithState = Task & { workflowState: WorkflowState | null };

export type TransitionPatch = {
  status: string;
  workflowStateId: string;
  revision: { increment: number };
  startedAt?: Date | null;
  completedAt?: Date | null;
  canceledAt?: Date | null;
};

export function buildTransitionPatch(task: TaskWithState, toState: WorkflowState): TransitionPatch {
  const now = new Date();
  const fromCategory = task.workflowState?.category ?? null;
  const toCategory = toState.category;

  const patch: TransitionPatch = {
    status: toState.key,
    workflowStateId: toState.id,
    revision: { increment: 1 },
  };

  if (toCategory === "started" && !task.startedAt) {
    patch.startedAt = now;
  }

  if (toCategory === "completed") {
    patch.completedAt = now;
    patch.canceledAt = null;
  } else if (fromCategory === "completed") {
    patch.completedAt = null;
  }

  if (toCategory === "canceled") {
    patch.canceledAt = now;
    patch.completedAt = null;
  } else if (fromCategory === "canceled") {
    patch.canceledAt = null;
  }

  return patch;
}

export function isReopen(fromCategory: string | null | undefined, toCategory: string): boolean {
  return (
    (fromCategory === "completed" || fromCategory === "canceled") &&
    toCategory !== "completed" &&
    toCategory !== "canceled"
  );
}
