"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "./TaskCard";

type WorkflowState = {
  id: string;
  key: string;
  name: string;
  category: string;
  position: number;
  color: string;
};

type Project = {
  id: string;
  key: string;
  name: string;
  color: string;
  position: number;
};

type TaskHistoryPayload = {
  transitions: Array<{
    id: string;
    reason: string | null;
    actorType: string;
    actorId: string | null;
    createdAt: string;
    fromState: { id: string; name: string; key: string } | null;
    toState: { id: string; name: string; key: string };
  }>;
  comments: Array<{
    id: string;
    body: string;
    authorType: string;
    authorId: string | null;
    createdAt: string;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    title: string;
    value: string;
    createdAt: string;
  }>;
  jobs: Array<{
    id: string;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    createdAt: string;
    events: Array<{
      id: string;
      ts: string;
      level: string;
      type: string;
      message: string;
      data: unknown;
    }>;
  }>;
};

type AuditEntry = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
};

const priorityOptions = [
  { value: 0, label: "Low" },
  { value: 1, label: "Medium" },
  { value: 2, label: "High" },
  { value: 3, label: "Urgent" },
];

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

export function TaskDetail({
  taskId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  taskId: string;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [task, setTask] = useState<Task | null>(null);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [visible, setVisible] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [history, setHistory] = useState<TaskHistoryPayload | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/api/tasks/${taskId}`).then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch task");
        return response.json() as Promise<Task>;
      }),
      fetch("/api/workflow/states").then((r) => r.json() as Promise<WorkflowState[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
    ])
      .then(([taskData, stateData, projectData]) => {
        if (cancelled) return;
        setTask(taskData);
        setStates(stateData);
        setProjects(projectData);
        setTitle(taskData.title);
        setDescription(taskData.description ?? "");
        setCategory(taskData.category ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setTask(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    requestAnimationFrame(() => {
      if (!cancelled) setVisible(true);
    });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingDesc && descRef.current) descRef.current.focus();
  }, [editingDesc]);

  useEffect(() => {
    if (editingCategory && categoryRef.current) categoryRef.current.focus();
  }, [editingCategory]);

  const historyStats = useMemo(() => {
    if (!history) {
      return {
        transitions: 0,
        comments: 0,
        artifacts: 0,
        jobs: 0,
        events: 0,
      };
    }

    return {
      transitions: history.transitions.length,
      comments: history.comments.length,
      artifacts: history.artifacts.length,
      jobs: history.jobs.length,
      events: history.jobs.reduce((sum, job) => sum + job.events.length, 0),
    };
  }, [history]);

  async function loadHistory() {
    if (!task) return;
    if (history || historyLoading) return;

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const [historyRes, auditRes] = await Promise.all([
        fetch(`/api/tasks/${task.id}/history`),
        fetch(`/api/audit?entityType=task&entityId=${task.id}&limit=100`),
      ]);

      if (!historyRes.ok) {
        throw new Error("Failed to load task history");
      }
      if (!auditRes.ok) {
        throw new Error("Failed to load audit history");
      }

      const historyData = (await historyRes.json()) as TaskHistoryPayload;
      const auditData = (await auditRes.json()) as AuditEntry[];

      setHistory(historyData);
      setAudit(auditData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load activity history";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function toggleHistory() {
    const next = !historyExpanded;
    setHistoryExpanded(next);
    if (next) {
      await loadHistory();
    }
  }

  async function applyPatch(body: Record<string, unknown>) {
    if (!task) return;
    setSaving(true);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated: Task = await res.json();
      setTask(updated);
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setCategory(updated.category ?? "");
      onUpdated();
    }
    setSaving(false);
  }

  async function saveField(field: "title" | "description" | "category", value: string) {
    if (!task) return;

    const trimmed = value.trim();

    if (field === "title") {
      if (trimmed.length === 0 || trimmed === task.title) return;
      await applyPatch({ title: trimmed });
      return;
    }

    if (field === "description") {
      if (value === (task.description ?? "")) return;
      await applyPatch({ description: value === "" ? null : value.trim() });
      return;
    }

    if (field === "category") {
      if (value === (task.category ?? "")) return;
      await applyPatch({ category: value === "" ? null : value.trim() });
    }
  }

  async function handleDelete() {
    setSaving(true);
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted();
    }
    setSaving(false);
  }

  async function handleArchiveToggle() {
    if (!task) return;
    setSaving(true);
    const endpoint = task.archivedAt
      ? `/api/tasks/${taskId}/unarchive`
      : `/api/tasks/${taskId}/archive`;
    const res = await fetch(endpoint, { method: "POST" });
    if (res.ok) {
      const updated: Task = await res.json();
      setTask(updated);
      onUpdated();
    }
    setSaving(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-overlay transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh]">
        <div
          className={`w-full max-w-2xl rounded-themed-lg bg-surface shadow-themed-lg border border-edge flex flex-col max-h-[84vh] transition-all duration-200 ease-out ${
            visible ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-between border-b border-edge px-5 py-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-ink-3">Task Detail</span>
              {saving && <span className="text-xs text-accent">Saving...</span>}
            </div>
            <button
              onClick={handleClose}
              className="rounded-themed p-1 text-ink-3 hover:bg-surface-hover hover:text-ink-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-edge"
                  style={{ borderTopColor: "var(--th-accent)" }}
                />
              </div>
            ) : !task ? (
              <p className="text-sm text-ink-3">Task not found.</p>
            ) : (
              <>
                {editingTitle ? (
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      saveField("title", title);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setEditingTitle(false);
                        saveField("title", title);
                      }
                    }}
                    className="w-full text-lg font-semibold text-ink border-b-2 border-accent outline-none bg-transparent pb-1 font-heading"
                  />
                ) : (
                  <h2
                    onClick={() => setEditingTitle(true)}
                    className="text-lg font-semibold text-ink cursor-text hover:bg-surface-hover rounded-themed px-1 -mx-1 py-0.5 font-heading"
                  >
                    {task.title}
                  </h2>
                )}

                <div>
                  <label className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                    Description
                  </label>
                  {editingDesc ? (
                    <textarea
                      ref={descRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        setEditingDesc(false);
                        saveField("description", description);
                      }}
                      rows={4}
                      className="mt-1 w-full rounded-themed border border-edge px-3 py-2 text-sm text-ink bg-surface focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                    />
                  ) : (
                    <p
                      onClick={() => setEditingDesc(true)}
                      className="mt-1 text-sm text-ink-2 whitespace-pre-wrap cursor-text hover:bg-surface-hover rounded-themed px-2 py-1.5 -mx-2 min-h-[60px]"
                    >
                      {task.description || (
                        <span className="text-ink-3 italic">Click to add description...</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="task-project-select" className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Project
                    </label>
                    <select
                      id="task-project-select"
                      value={task.projectId ?? ""}
                      onChange={(e) =>
                        applyPatch({
                          projectId: e.target.value.length > 0 ? e.target.value : null,
                        })
                      }
                      className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
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
                    <label htmlFor="task-state-select" className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                      State
                    </label>
                    <select
                      id="task-state-select"
                      value={task.workflowStateId ?? ""}
                      onChange={(e) => applyPatch({ workflowStateId: e.target.value })}
                      className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="task-priority-select" className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Priority
                    </label>
                    <select
                      id="task-priority-select"
                      value={task.priority}
                      onChange={(e) => applyPatch({ priority: Number(e.target.value) })}
                      className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {priorityOptions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                    Category
                  </label>
                  {editingCategory ? (
                    <input
                      ref={categoryRef}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      onBlur={() => {
                        setEditingCategory(false);
                        saveField("category", category);
                      }}
                      className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  ) : (
                    <p
                      onClick={() => setEditingCategory(true)}
                      className="mt-1 text-sm text-ink-2 cursor-text hover:bg-surface-hover rounded-themed px-2 py-1.5 -mx-2"
                    >
                      {task.category || <span className="text-ink-3">None</span>}
                    </p>
                  )}
                </div>

                <div className="rounded-themed border border-edge bg-surface-alt p-3 space-y-2">
                  <button
                    onClick={toggleHistory}
                    className="flex w-full items-center justify-between rounded-themed px-2 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="text-sm font-medium text-ink">
                      Activity & Audit History
                    </span>
                    <span className="text-xs text-ink-3">
                      {historyExpanded ? "Hide" : "Show"}
                    </span>
                  </button>

                  {historyExpanded && (
                    <div className="space-y-2 border-t border-edge pt-3">
                      {historyLoading ? (
                        <p className="text-xs text-ink-3">Loading history...</p>
                      ) : historyError ? (
                        <p className="text-xs text-danger">{historyError}</p>
                      ) : !history ? (
                        <p className="text-xs text-ink-3">No history loaded.</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-xs text-ink-2">
                            <div className="rounded-themed border border-edge bg-surface px-2 py-1.5">
                              {historyStats.transitions} transitions
                            </div>
                            <div className="rounded-themed border border-edge bg-surface px-2 py-1.5">
                              {historyStats.comments} comments
                            </div>
                            <div className="rounded-themed border border-edge bg-surface px-2 py-1.5">
                              {historyStats.artifacts} artifacts
                            </div>
                          </div>

                          <details className="rounded-themed border border-edge bg-surface p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-ink-2">
                              State Transitions ({history.transitions.length})
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {history.transitions.length === 0 ? (
                                <p className="text-xs text-ink-3">No transitions.</p>
                              ) : (
                                history.transitions.map((transition) => (
                                  <details key={transition.id} className="rounded-themed border border-edge bg-page p-2">
                                    <summary className="cursor-pointer text-xs text-ink-2">
                                      {formatWhen(transition.createdAt)}: {transition.fromState?.name ?? "(none)"} -&gt; {transition.toState.name}
                                    </summary>
                                    <p className="mt-1 text-xs text-ink-3">
                                      Actor: {transition.actorType}
                                      {transition.actorId ? ` (${transition.actorId})` : ""}
                                      {transition.reason ? ` | Reason: ${transition.reason}` : ""}
                                    </p>
                                  </details>
                                ))
                              )}
                            </div>
                          </details>

                          <details className="rounded-themed border border-edge bg-surface p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-ink-2">
                              Comments ({history.comments.length})
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {history.comments.length === 0 ? (
                                <p className="text-xs text-ink-3">No comments.</p>
                              ) : (
                                history.comments.map((comment) => (
                                  <div key={comment.id} className="rounded-themed border border-edge bg-page p-2">
                                    <p className="text-xs text-ink-2 whitespace-pre-wrap">{comment.body}</p>
                                    <p className="mt-1 text-[11px] text-ink-3">
                                      {comment.authorType}
                                      {comment.authorId ? ` (${comment.authorId})` : ""} • {formatWhen(comment.createdAt)}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </details>

                          <details className="rounded-themed border border-edge bg-surface p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-ink-2">
                              Artifacts ({history.artifacts.length})
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {history.artifacts.length === 0 ? (
                                <p className="text-xs text-ink-3">No artifacts.</p>
                              ) : (
                                history.artifacts.map((artifact) => (
                                  <details key={artifact.id} className="rounded-themed border border-edge bg-page p-2">
                                    <summary className="cursor-pointer text-xs text-ink-2">
                                      {artifact.title} ({artifact.kind})
                                    </summary>
                                    <p className="mt-1 text-xs text-ink-3 break-all">{artifact.value}</p>
                                    <p className="mt-1 text-[11px] text-ink-3">{formatWhen(artifact.createdAt)}</p>
                                  </details>
                                ))
                              )}
                            </div>
                          </details>

                          <details className="rounded-themed border border-edge bg-surface p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-ink-2">
                              Jobs & Events ({historyStats.jobs} jobs / {historyStats.events} events)
                            </summary>
                            <div className="mt-2 space-y-2">
                              {history.jobs.length === 0 ? (
                                <p className="text-xs text-ink-3">No jobs.</p>
                              ) : (
                                history.jobs.map((job) => (
                                  <details key={job.id} className="rounded-themed border border-edge bg-page p-2">
                                    <summary className="cursor-pointer text-xs text-ink-2">
                                      Job {job.id.slice(-8)} • {job.status} • {formatWhen(job.createdAt)}
                                    </summary>
                                    <div className="mt-2 space-y-1.5">
                                      {job.events.length === 0 ? (
                                        <p className="text-xs text-ink-3">No events.</p>
                                      ) : (
                                        job.events.map((event) => (
                                          <details key={event.id} className="rounded-themed border border-edge bg-surface p-2">
                                            <summary className="cursor-pointer text-xs text-ink-2">
                                              [{event.level}] {event.type} • {formatWhen(event.ts)}
                                            </summary>
                                            <p className="mt-1 text-xs text-ink-3">{event.message}</p>
                                            {event.data !== null && event.data !== undefined && (
                                              <pre className="mt-1 max-h-28 overflow-auto rounded-themed border border-edge bg-page p-2 text-[11px] text-ink-2">
                                                {JSON.stringify(event.data, null, 2)}
                                              </pre>
                                            )}
                                          </details>
                                        ))
                                      )}
                                    </div>
                                  </details>
                                ))
                              )}
                            </div>
                          </details>

                          <details className="rounded-themed border border-edge bg-surface p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-ink-2">
                              Audit Log ({audit.length})
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              {audit.length === 0 ? (
                                <p className="text-xs text-ink-3">No audit entries.</p>
                              ) : (
                                audit.map((entry) => (
                                  <details key={entry.id} className="rounded-themed border border-edge bg-page p-2">
                                    <summary className="cursor-pointer text-xs text-ink-2">
                                      {entry.action} • {entry.actorType}
                                      {entry.actorId ? ` (${entry.actorId})` : ""} • {formatWhen(entry.createdAt)}
                                    </summary>
                                    {(entry.before !== null || entry.after !== null || entry.metadata !== null) && (
                                      <pre className="mt-1 max-h-36 overflow-auto rounded-themed border border-edge bg-surface p-2 text-[11px] text-ink-2">
                                        {JSON.stringify(
                                          {
                                            before: entry.before,
                                            after: entry.after,
                                            metadata: entry.metadata,
                                          },
                                          null,
                                          2
                                        )}
                                      </pre>
                                    )}
                                  </details>
                                ))
                              )}
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-edge">
                  <div>
                    <label className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Created
                    </label>
                    <p className="mt-0.5 text-xs text-ink-2">{formatWhen(task.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Updated
                    </label>
                    <p className="mt-0.5 text-xs text-ink-2">{formatWhen(task.updatedAt)}</p>
                  </div>
                </div>

                {task.archivedAt && (
                  <p className="text-xs text-warning">Archived {formatWhen(task.archivedAt)}</p>
                )}
              </>
            )}
          </div>

          {task && (
            <div className="border-t border-edge px-5 py-3 flex justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleArchiveToggle}
                  className="rounded-themed border border-edge px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-hover"
                >
                  {task.archivedAt ? "Unarchive" : "Archive"}
                </button>

                {confirmDelete ? (
                  <>
                    <span className="text-sm text-danger">Delete this task?</span>
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="rounded-themed px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--th-danger)", color: "#fff" }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-themed border border-edge px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-hover"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-themed border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-bg"
                    style={{ borderColor: "var(--th-danger-bg, var(--th-border))" }}
                  >
                    Delete
                  </button>
                )}
              </div>

              <button
                onClick={handleClose}
                className="rounded-themed border border-edge px-4 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-hover"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
