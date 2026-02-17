"use client";

import { useMemo } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskCard, type Task } from "./TaskCard";

type ProjectOption = {
  id: string;
  name: string;
  color: string;
};

function groupTasksByProject(tasks: Task[], projectOrder: ProjectOption[]) {
  const tasksByProject = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = task.projectId ?? "__no_project__";
    const existing = tasksByProject.get(key);
    if (existing) {
      existing.push(task);
    } else {
      tasksByProject.set(key, [task]);
    }
  }

  const groups: Array<{
    key: string;
    label: string;
    color: string;
    tasks: Task[];
  }> = [];

  for (const project of projectOrder) {
    const grouped = tasksByProject.get(project.id);
    if (!grouped || grouped.length === 0) continue;
    groups.push({
      key: project.id,
      label: project.name,
      color: project.color,
      tasks: grouped,
    });
    tasksByProject.delete(project.id);
  }

  const remainingProjectGroups = [...tasksByProject.entries()]
    .filter(([key]) => key !== "__no_project__")
    .map(([key, grouped]) => {
      const project = grouped[0]?.project;
      return {
        key,
        label: project?.name ?? "Unknown Project",
        color: project?.color ?? "#64748b",
        tasks: grouped,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  groups.push(...remainingProjectGroups);

  const noProject = tasksByProject.get("__no_project__");
  if (noProject && noProject.length > 0) {
    groups.push({
      key: "__no_project__",
      label: "No Project",
      color: "#64748b",
      tasks: noProject,
    });
  }

  return groups;
}

export function Column({
  state,
  tasks,
  onSelect,
  groupByProject = false,
  projectOrder = [],
}: {
  state: {
    id: string;
    key: string;
    name: string;
    color: string;
  };
  tasks: Task[];
  onSelect?: (taskId: string) => void;
  groupByProject?: boolean;
  projectOrder?: ProjectOption[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: state.id });
  const ids = tasks.map((t) => t.id);

  const groupedTasks = useMemo(() => {
    if (!groupByProject) return [];
    return groupTasksByProject(tasks, projectOrder);
  }, [groupByProject, projectOrder, tasks]);

  return (
    <div
      className={`flex flex-col rounded-themed-lg border border-edge border-t-4 bg-surface-alt ${
        isOver ? "ring-2 ring-ring bg-accent/5" : ""
      } min-w-[280px] w-[280px]`}
      style={{ borderTopColor: state.color }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-2 uppercase tracking-wide font-heading">
          {state.name}
        </h2>
        <span className="inline-flex items-center justify-center rounded-full bg-page px-2 py-0.5 text-xs font-medium text-ink-3 tabular-nums">
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 px-3 pb-3 space-y-2 min-h-[120px]">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {!groupByProject ? (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onSelect={onSelect} />
            ))
          ) : groupedTasks.length === 0 ? (
            <p className="px-2 py-4 text-xs text-ink-3">No tasks in this state.</p>
          ) : (
            groupedTasks.map((group) => (
              <div key={group.key} className="space-y-2 rounded-themed border border-edge bg-surface p-2">
                <div className="flex items-center gap-2 px-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: group.color }}
                  />
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {group.label}
                  </p>
                  <span className="ml-auto text-xs text-ink-3">{group.tasks.length}</span>
                </div>
                {group.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onSelect={onSelect} />
                ))}
              </div>
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
