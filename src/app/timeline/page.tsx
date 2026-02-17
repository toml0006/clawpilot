"use client";

import { useCallback, useEffect, useState } from "react";

type TimelineEvent = {
  id: string;
  ts: string;
  level: string;
  type: string;
  message: string;
  data: unknown;
  task?: {
    id: string;
    title: string;
  } | null;
  job?: {
    id: string;
    status: string;
    taskId: string;
  } | null;
};

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [level, setLevel] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "250" });
    if (level !== "all") params.set("level", level);

    try {
      const res = await fetch(`/api/timeline?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as TimelineEvent[];
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink font-heading">Timeline</h2>
        <div className="flex items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-themed border border-edge bg-surface px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="all">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={load}
            className="rounded-themed border border-edge px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-hover"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-ink-3">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-3">No events yet.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="rounded-themed border border-edge bg-surface p-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">
                  [{event.level}] {event.type}
                </p>
                <p className="text-xs text-ink-3">{new Date(event.ts).toLocaleString()}</p>
              </div>
              <p className="text-sm text-ink-2">{event.message}</p>
              {(event.task || event.job) && (
                <p className="text-xs text-ink-3">
                  {event.task ? `Task: ${event.task.title}` : ""}
                  {event.task && event.job ? " | " : ""}
                  {event.job ? `Job: ${event.job.id} (${event.job.status})` : ""}
                </p>
              )}
              {event.data !== null && event.data !== undefined && (
                <pre className="max-h-32 overflow-auto rounded-themed border border-edge bg-page p-2 text-xs text-ink-2">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
