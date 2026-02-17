"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WorkflowState = {
  id: string;
  key: string;
  name: string;
  category: string;
  isDefault: boolean;
};

type Project = {
  id: string;
  key: string;
  name: string;
  color: string;
  archivedAt: string | null;
};

export function CreateTaskDialog({
  onClose,
  onCreated,
  defaultStatus,
}: {
  onClose: () => void;
  onCreated: () => void;
  defaultStatus?: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workflowStateId, setWorkflowStateId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 150);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    requestAnimationFrame(() => setVisible(true));
    titleRef.current?.focus();

    Promise.all([
      fetch("/api/workflow/states").then((r) => r.json() as Promise<WorkflowState[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
    ])
      .then(([stateData, projectData]) => {
        if (cancelled) return;
        setStates(stateData);
        setProjects(projectData);

        const byStatus = defaultStatus
          ? stateData.find((state) => state.key === defaultStatus)
          : null;
        const fallback =
          byStatus ?? stateData.find((state) => state.isDefault) ?? stateData[0] ?? null;
        setWorkflowStateId(fallback?.id ?? "");

        const defaultProject = projectData.find((project) => project.key === "general") ?? projectData[0] ?? null;
        setProjectId(defaultProject?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setStates([]);
        setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultStatus]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!workflowStateId) {
      setError("Workflow state is required");
      return;
    }

    setSubmitting(true);
    setError("");

    const body: Record<string, string | null> = {
      title: title.trim(),
      workflowStateId,
      projectId: projectId.length > 0 ? projectId : null,
    };
    if (description.trim()) body.description = description.trim();
    if (category.trim()) body.category = category.trim();

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      onCreated();
      handleClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create task");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-overlay transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`w-full max-w-md rounded-themed-lg bg-surface shadow-themed-lg transition-all duration-150 ${
            visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <form onSubmit={handleSubmit}>
            <div className="border-b border-edge px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink font-heading">New Task</h3>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-themed p-1 text-ink-3 hover:bg-surface-hover hover:text-ink-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-sm font-medium text-ink-2">
                  Title <span className="text-danger">*</span>
                </label>
                <input
                  ref={titleRef}
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink shadow-themed focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-project" className="block text-sm font-medium text-ink-2">
                    Project
                  </label>
                  <select
                    id="task-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink shadow-themed focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">No Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-state" className="block text-sm font-medium text-ink-2">
                    State
                  </label>
                  <select
                    id="task-state"
                    value={workflowStateId}
                    onChange={(e) => setWorkflowStateId(e.target.value)}
                    className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink shadow-themed focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {states.map((state) => (
                      <option key={state.id} value={state.id}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="task-desc" className="block text-sm font-medium text-ink-2">
                  Description
                </label>
                <textarea
                  id="task-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional details..."
                  className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink shadow-themed focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>

              <div>
                <label htmlFor="task-cat" className="block text-sm font-medium text-ink-2">
                  Category
                </label>
                <input
                  id="task-cat"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Optional tag or lane"
                  className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink shadow-themed focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
            </div>

            <div className="border-t border-edge px-5 py-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-themed border border-edge px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-themed bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:bg-accent-hover disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
