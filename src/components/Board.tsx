"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Column } from "./Column";
import { TaskCard, type Task } from "./TaskCard";

type BoardView = "active" | "backlog";

type WorkflowState = {
  id: string;
  key: string;
  name: string;
  category: string;
  position: number;
  color: string;
  isDefault: boolean;
};

type Project = {
  id: string;
  key: string;
  name: string;
  color: string;
  position: number;
  archivedAt: string | null;
};

type TaskListResponse = {
  items: Task[];
  nextCursor: string | null;
};

const viewCategories: Record<BoardView, string[]> = {
  active: ["unstarted", "started"],
  backlog: ["backlog"],
};

function sortByPriority(a: Task, b: Task) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.createdAt.localeCompare(b.createdAt);
}

type BoardProps = {
  onSelect?: (taskId: string) => void;
  refreshKey?: number;
  view?: BoardView;
  groupByProject?: boolean;
  projectFilterId?: string | null;
};

export function Board({
  onSelect,
  refreshKey = 0,
  view = "active",
  groupByProject = false,
  projectFilterId = null,
}: BoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visibleStates = useMemo(
    () => states.filter((state) => viewCategories[view].includes(state.category)),
    [states, view]
  );

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const taskParams = new URLSearchParams({ view });
    if (projectFilterId && projectFilterId !== "all") {
      taskParams.set("projectId", projectFilterId);
    }

    Promise.all([
      fetch("/api/workflow/states").then((r) => r.json() as Promise<WorkflowState[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
      fetch(`/api/tasks?${taskParams.toString()}`).then(
        (r) => r.json() as Promise<TaskListResponse>
      ),
    ])
      .then(([stateData, projectData, taskData]) => {
        if (cancelled) return;
        setStates(stateData);
        setProjects(projectData);
        setTasks(taskData.items ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setStates([]);
        setProjects([]);
        setTasks([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, view, projectFilterId]);

  const tasksByState = useCallback(
    (stateId: string) => tasks.filter((t) => t.workflowStateId === stateId).sort(sortByPriority),
    [tasks]
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const movedTask = tasks.find((task) => task.id === activeId);
    if (!movedTask) return;

    const overTask = tasks.find((task) => task.id === overId);
    const directState = visibleStates.find((state) => state.id === overId);
    const targetStateId = directState?.id ?? overTask?.workflowStateId ?? movedTask.workflowStateId;

    if (!targetStateId) return;

    if (overId === activeId && targetStateId === movedTask.workflowStateId) {
      return;
    }

    const targetState = states.find((state) => state.id === targetStateId);
    if (!targetState) return;

    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const columns = new Map<string, string[]>();

    for (const state of visibleStates) {
      const ids = tasks
        .filter((task) => task.workflowStateId === state.id)
        .sort(sortByPriority)
        .map((task) => task.id);
      columns.set(state.id, ids);
    }

    for (const [stateId, ids] of columns.entries()) {
      const idx = ids.indexOf(activeId);
      if (idx >= 0) {
        ids.splice(idx, 1);
      }
      columns.set(stateId, ids);
    }

    const targetColumn = columns.get(targetStateId) ?? [];
    let insertAt = targetColumn.length;
    if (overTask && overId !== activeId) {
      const overIdx = targetColumn.indexOf(overId);
      if (overIdx >= 0) insertAt = overIdx;
    }
    targetColumn.splice(insertAt, 0, activeId);
    columns.set(targetStateId, targetColumn);

    const nextTasks: Task[] = [];
    for (const state of visibleStates) {
      const ids = columns.get(state.id) ?? [];
      ids.forEach((taskId, priority) => {
        const previous = taskById.get(taskId);
        if (!previous) return;
        nextTasks.push({
          ...previous,
          status: state.key,
          workflowStateId: state.id,
          workflowState: state,
          stateCategory: state.category,
          priority,
        });
      });
    }

    const visibleStateIds = new Set(visibleStates.map((state) => state.id));
    nextTasks.push(
      ...tasks.filter(
        (task) => !task.workflowStateId || !visibleStateIds.has(task.workflowStateId)
      )
    );

    const changed = nextTasks.some((task) => {
      const previous = taskById.get(task.id);
      return previous
        ? previous.workflowStateId !== task.workflowStateId || previous.priority !== task.priority
        : false;
    });

    if (!changed) return;

    setTasks(nextTasks);

    const orderedIds = nextTasks
      .filter((task) => task.workflowStateId === targetStateId)
      .sort(sortByPriority)
      .map((task) => task.id);

    fetch(`/api/tasks/${activeId}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowStateId: targetStateId, orderedIds }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to persist task order");
        }
      })
      .catch(() => {
        const params = new URLSearchParams({ view });
        if (projectFilterId && projectFilterId !== "all") {
          params.set("projectId", projectFilterId);
        }
        fetch(`/api/tasks?${params.toString()}`)
          .then((r) => r.json() as Promise<TaskListResponse>)
          .then((data) => setTasks(data.items ?? []));
      });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-edge"
          style={{ borderTopColor: "var(--th-accent)" }}
        />
      </div>
    );
  }

  if (visibleStates.length === 0) {
    return <p className="text-sm text-ink-3">No workflow states configured for this view.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {visibleStates.map((state) => (
          <Column
            key={state.id}
            state={state}
            tasks={tasksByState(state.id)}
            groupByProject={groupByProject}
            projectOrder={projects.map((project) => ({
              id: project.id,
              name: project.name,
              color: project.color,
            }))}
            onSelect={onSelect}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="rotate-2 scale-105">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
