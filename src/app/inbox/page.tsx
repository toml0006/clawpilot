"use client";

import { useEffect, useState } from "react";

type PendingAction = {
  id: string;
  taskId: string | null;
  action: string;
  payload: unknown;
  status: string;
  createdAt: string;
  task?: {
    id: string;
    title: string;
    status: string;
  } | null;
};

export default function InboxPage() {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/v1/actions/pending?all=true");
      if (!res.ok) throw new Error("Failed to fetch pending actions");
      const data = (await res.json()) as PendingAction[];
      setActions(data);
    } catch {
      setActions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    await fetch(`/api/agent/v1/actions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolvedBy: "human", execute: true }),
    });
    await load();
  }

  async function reject(id: string) {
    const reason = rejectReason[id]?.trim();
    if (!reason) return;
    await fetch(`/api/agent/v1/actions/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolvedBy: "human", reason }),
    });
    setRejectReason((prev) => ({ ...prev, [id]: "" }));
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink font-heading">Approval Inbox</h2>
        <button
          onClick={load}
          className="rounded-themed border border-edge px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-hover"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-ink-3">Loading pending actions...</p>
        ) : actions.length === 0 ? (
          <p className="text-sm text-ink-3">No pending approvals.</p>
        ) : (
          actions.map((action) => (
            <div key={action.id} className="rounded-themed-lg border border-edge bg-surface p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{action.action}</p>
                  <p className="text-xs text-ink-3">
                    {action.task ? `${action.task.title} (${action.task.id})` : "No task attached"}
                  </p>
                </div>
                <p className="text-xs text-ink-3">{new Date(action.createdAt).toLocaleString()}</p>
              </div>

              <pre className="max-h-40 overflow-auto rounded-themed border border-edge bg-page p-2 text-xs text-ink-2">
                {JSON.stringify(action.payload, null, 2)}
              </pre>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => approve(action.id)}
                  className="rounded-themed bg-accent px-3 py-1.5 text-xs font-medium text-accent-text hover:bg-accent-hover"
                >
                  Approve
                </button>
                <input
                  placeholder="Reject reason"
                  value={rejectReason[action.id] ?? ""}
                  onChange={(e) =>
                    setRejectReason((prev) => ({
                      ...prev,
                      [action.id]: e.target.value,
                    }))
                  }
                  className="rounded-themed border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink"
                />
                <button
                  onClick={() => reject(action.id)}
                  className="rounded-themed border border-edge px-3 py-1.5 text-xs text-danger hover:bg-danger-bg"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
