"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  stateCategory: string | null;
  workflowStateId: string | null;
  workflowState: {
    id: string;
    key: string;
    name: string;
    category: string;
    position: number;
    color: string;
    isDefault: boolean;
  } | null;
  projectId?: string | null;
  project?: {
    id: string;
    key: string;
    name: string;
    color: string;
    position: number;
  } | null;
  category: string | null;
  priority: number;
  archivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
  dueAt?: string | null;
  source?: string;
  revision?: number;
  createdAt: string;
  updatedAt: string;
};

const priorityLabel: Record<number, string> = {
  0: "Low",
  1: "Medium",
  2: "High",
  3: "Urgent",
};

export function TaskCard({
  task,
  onSelect,
}: {
  task: Task;
  onSelect?: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const prioText = priorityLabel[task.priority] ?? "Low";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect?.(task.id)}
      className={`rounded-themed border border-edge bg-surface p-3 shadow-themed cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-themed-lg ${
        isDragging ? "opacity-50 shadow-themed-lg ring-2 ring-ring" : ""
      }`}
    >
      <p className="text-sm font-medium text-ink leading-snug">
        {task.title}
      </p>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {task.project && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: `${task.project.color}1f`,
              color: task.project.color,
            }}
          >
            {task.project.name}
          </span>
        )}
        {task.category && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: "var(--th-cat-bg)", color: "var(--th-cat-text)" }}
          >
            {task.category}
          </span>
        )}
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            background: `var(--th-pri${task.priority}-bg)`,
            color: `var(--th-pri${task.priority}-text)`,
          }}
        >
          {prioText}
        </span>
      </div>
    </div>
  );
}
