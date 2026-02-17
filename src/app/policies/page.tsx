"use client";

import { useEffect, useState } from "react";

type RetentionPolicy = {
  id: string;
  archiveAfterDays: number;
  purgeEventsAfterDays: number;
  retainTasksForever: boolean;
};

type PolicyRule = {
  id: string;
  name: string;
  action: string;
  effect: "allow" | "deny" | "require_approval";
  enabled: boolean;
  position: number;
};

type CleanupRun = {
  id: string;
  dryRun: boolean;
  status: string;
  archivedTasks: number;
  purgedEvents: number;
  error: string | null;
  createdAt: string;
};

export default function PoliciesPage() {
  const [retention, setRetention] = useState<RetentionPolicy | null>(null);
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [runs, setRuns] = useState<CleanupRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [policiesRes, runsRes] = await Promise.all([
      fetch("/api/policies"),
      fetch("/api/cleanup/runs?limit=20"),
    ]);

    if (policiesRes.ok) {
      const data = await policiesRes.json();
      setRetention(data.retention);
      setRules(data.rules ?? []);
    }

    if (runsRes.ok) {
      const data = (await runsRes.json()) as CleanupRun[];
      setRuns(data);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => {
      setMessage("Failed to load policies");
    });
  }, []);

  async function savePolicies() {
    if (!retention) return;

    setSaving(true);
    setMessage("");

    const res = await fetch("/api/policies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention, rules }),
    });

    if (res.ok) {
      const data = await res.json();
      setRetention(data.retention);
      setRules(data.rules ?? []);
      setMessage("Policies saved");
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to save policies");
    }

    setSaving(false);
  }

  async function runCleanup(dryRun: boolean) {
    setRunningCleanup(true);
    setMessage("");

    const res = await fetch(`/api/cleanup/run?dryRun=${dryRun ? "true" : "false"}`, {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      setMessage(
        `${dryRun ? "Dry run" : "Cleanup"} finished: ${data.archivedTaskCount} tasks archived, ${data.purgedEventCount} events purged`
      );
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Cleanup failed");
    }

    setRunningCleanup(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink font-heading">Policies</h2>

      {message && <p className="text-sm text-ink-2">{message}</p>}

      <section className="rounded-themed-lg border border-edge bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink">Retention Settings</h3>

        {!retention ? (
          <p className="text-sm text-ink-3">Loading retention policy...</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-ink-2">
                Archive completed/canceled after days
                <input
                  type="number"
                  min={0}
                  value={retention.archiveAfterDays}
                  onChange={(e) =>
                    setRetention((prev) =>
                      prev
                        ? {
                            ...prev,
                            archiveAfterDays: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>

              <label className="text-sm text-ink-2">
                Purge events after days
                <input
                  type="number"
                  min={0}
                  value={retention.purgeEventsAfterDays}
                  onChange={(e) =>
                    setRetention((prev) =>
                      prev
                        ? {
                            ...prev,
                            purgeEventsAfterDays: Number(e.target.value),
                          }
                        : prev
                    )
                  }
                  className="mt-1 block w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink"
                />
              </label>

              <label className="text-sm text-ink-2 inline-flex items-end gap-2">
                <input
                  type="checkbox"
                  checked={retention.retainTasksForever}
                  onChange={(e) =>
                    setRetention((prev) =>
                      prev
                        ? {
                            ...prev,
                            retainTasksForever: e.target.checked,
                          }
                        : prev
                    )
                  }
                />
                Retain tasks forever
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={savePolicies}
                disabled={saving}
                className="rounded-themed bg-accent px-3 py-1.5 text-sm font-medium text-accent-text hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save policies"}
              </button>

              <button
                onClick={() => runCleanup(true)}
                disabled={runningCleanup}
                className="rounded-themed border border-edge px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-hover disabled:opacity-50"
              >
                Dry-run cleanup
              </button>

              <button
                onClick={() => runCleanup(false)}
                disabled={runningCleanup}
                className="rounded-themed border border-edge px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-hover disabled:opacity-50"
              >
                Run cleanup now
              </button>
            </div>
          </>
        )}
      </section>

      <section className="rounded-themed-lg border border-edge bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink">Agent Policy Rules</h3>

        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-themed border border-edge p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{rule.name}</p>
                  <p className="text-xs text-ink-3">{rule.action}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={rule.effect}
                    onChange={(e) =>
                      setRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                effect: e.target.value as PolicyRule["effect"],
                              }
                            : item
                        )
                      )
                    }
                    className="rounded-themed border border-edge bg-surface px-2 py-1 text-xs text-ink"
                  >
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                    <option value="require_approval">require_approval</option>
                  </select>

                  <label className="inline-flex items-center gap-1 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        setRules((prev) =>
                          prev.map((item) =>
                            item.id === rule.id
                              ? {
                                  ...item,
                                  enabled: e.target.checked,
                                }
                              : item
                          )
                        )
                      }
                    />
                    enabled
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-themed-lg border border-edge bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink">Cleanup Run History</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-ink-3">No cleanup runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ink-2">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">When</th>
                  <th className="px-2 py-1 text-left font-medium">Mode</th>
                  <th className="px-2 py-1 text-left font-medium">Status</th>
                  <th className="px-2 py-1 text-left font-medium">Archived</th>
                  <th className="px-2 py-1 text-left font-medium">Purged events</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-edge">
                    <td className="px-2 py-1.5 text-ink-2">{new Date(run.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-ink-2">{run.dryRun ? "Dry run" : "Live"}</td>
                    <td className="px-2 py-1.5 text-ink-2">{run.status}</td>
                    <td className="px-2 py-1.5 text-ink-2">{run.archivedTasks}</td>
                    <td className="px-2 py-1.5 text-ink-2">{run.purgedEvents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
