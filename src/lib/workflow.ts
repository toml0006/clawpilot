import type { Label, Project, Task, TaskLabel, WorkflowState } from "@/generated/prisma/client";

export const WORKFLOW_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;

export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const DEFAULT_WORKFLOW_STATES: Array<{
  key: string;
  name: string;
  category: WorkflowCategory;
  position: number;
  color: string;
  isDefault?: boolean;
}> = [
  { key: "icebox", name: "Icebox", category: "backlog", position: 0, color: "#64748b" },
  {
    key: "backlog",
    name: "Backlog",
    category: "backlog",
    position: 1,
    color: "#4b5563",
    isDefault: true,
  },
  { key: "todo", name: "Todo", category: "unstarted", position: 2, color: "#3b82f6" },
  {
    key: "in-progress",
    name: "In Progress",
    category: "started",
    position: 3,
    color: "#f59e0b",
  },
  { key: "blocked", name: "Blocked", category: "started", position: 4, color: "#a855f7" },
  {
    key: "in-review",
    name: "In Review",
    category: "started",
    position: 5,
    color: "#06b6d4",
  },
  { key: "done", name: "Done", category: "completed", position: 6, color: "#22c55e" },
  {
    key: "canceled",
    name: "Canceled",
    category: "canceled",
    position: 7,
    color: "#ef4444",
  },
];

export const LEGACY_STATUS_TO_STATE_KEY: Record<string, string> = {
  draft: "backlog",
  ready: "todo",
  cliff: "in-progress",
  waiting: "blocked",
  done: "done",
};

export const ACTIVE_VIEW_CATEGORIES: WorkflowCategory[] = ["unstarted", "started"];
export const BACKLOG_VIEW_CATEGORIES: WorkflowCategory[] = ["backlog"];
export const PAST_VIEW_CATEGORIES: WorkflowCategory[] = ["completed", "canceled"];

export function isWorkflowCategory(value: string): value is WorkflowCategory {
  return (WORKFLOW_CATEGORIES as readonly string[]).includes(value);
}

export function isPastCategory(category: string | null | undefined): boolean {
  return category === "completed" || category === "canceled";
}

export function normalizeProjectKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function mapTaskResponse(
  task: Task & {
    workflowState: WorkflowState | null;
    project?: Project | null;
    labels?: Array<TaskLabel & { label: Label }>;
  }
) {
  return {
    ...task,
    status: task.workflowState?.key ?? task.status,
    workflowState: task.workflowState,
    stateCategory: task.workflowState?.category ?? null,
    project: task.project ?? null,
    labels: task.labels?.map((tl) => tl.label) ?? [],
  };
}

export function normalizeStateKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function displayStateName(key: string): string {
  return key
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}
