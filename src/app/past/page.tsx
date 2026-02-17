"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/components/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type WorkflowState = {
  id: string;
  key: string;
  name: string;
  category: string;
  position: number;
  isDefault: boolean;
};

type Project = {
  id: string;
  name: string;
};

type TaskListResponse = {
  items: Task[];
  nextCursor: string | null;
};

type PastTab = "completed" | "canceled" | "archived";

function durationLabel(task: Task) {
  if (!task.startedAt) return "-";
  const end = task.completedAt ?? task.canceledAt;
  if (!end) return "-";
  const diffMs = new Date(end).getTime() - new Date(task.startedAt).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "<1m";
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function PastPage() {
  const [tab, setTab] = useState<PastTab>("completed");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [source, setSource] = useState("all");
  const [projectFilterId, setProjectFilterId] = useState("all");
  const [hasArtifacts, setHasArtifacts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const params = new URLSearchParams({ view: "past", limit: "300" });
    if (tab === "completed") params.set("stateCategory", "completed");
    if (tab === "canceled") params.set("stateCategory", "canceled");
    if (tab === "archived") params.set("archived", "true");
    if (search.trim().length > 0) params.set("q", search.trim());
    if (hasArtifacts) params.set("hasArtifacts", "true");
    if (projectFilterId !== "all") params.set("projectId", projectFilterId);

    Promise.all([
      fetch(`/api/tasks?${params.toString()}`).then((r) => r.json() as Promise<TaskListResponse>),
      fetch("/api/workflow/states").then((r) => r.json() as Promise<WorkflowState[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
    ])
      .then(([taskData, stateData, projectData]) => {
        if (cancelled) return;
        setTasks(taskData.items ?? []);
        setStates(stateData);
        setProjects(projectData);
      })
      .catch(() => {
        if (cancelled) return;
        setTasks([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, search, hasArtifacts, projectFilterId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (source !== "all" && task.source !== source) return false;

      if (fromDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        if (new Date(task.updatedAt) < from) return false;
      }

      if (toDate) {
        const to = new Date(`${toDate}T23:59:59`);
        if (new Date(task.updatedAt) > to) return false;
      }

      return true;
    });
  }, [tasks, source, fromDate, toDate]);

  const reopenState =
    states.find((state) => state.key === "todo") ??
    states.find((state) => state.category === "unstarted") ??
    states.find((state) => state.category === "backlog") ??
    null;

  async function reopenTask(taskId: string) {
    if (!reopenState) return;
    await fetch(`/api/tasks/${taskId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowStateId: reopenState.id, reason: "Reopened from past" }),
    });
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }

  async function toggleArchive(task: Task) {
    const endpoint = task.archivedAt
      ? `/api/tasks/${task.id}/unarchive`
      : `/api/tasks/${task.id}/archive`;
    const res = await fetch(endpoint, { method: "POST" });
    if (!res.ok) return;
    const updated: Task = await res.json();
    setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink font-heading">Past Tasks</h2>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <Tabs value={tab} onValueChange={(value) => setTab(value as PastTab)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              {(["completed", "canceled", "archived"] as PastTab[]).map((entry) => (
                <TabsTrigger key={entry} value={entry}>
                  {entry.charAt(0).toUpperCase() + entry.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid gap-3 md:grid-cols-5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title/description/category"
              className="md:col-span-2"
            />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">All sources</option>
              <option value="human">Human</option>
              <option value="agent">Agent</option>
            </Select>
            <Select
              value={projectFilterId}
              onChange={(e) => setProjectFilterId(e.target.value)}
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="inline-flex items-center gap-2">
            <Switch checked={hasArtifacts} onCheckedChange={setHasArtifacts} />
            <Label className="normal-case tracking-normal text-sm text-ink-2">
              Has artifacts
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-ink-2">
            {tab === "completed" && "Completed tasks"}
            {tab === "canceled" && "Canceled tasks"}
            {tab === "archived" && "Archived tasks"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt text-ink-2">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Title</th>
              <th className="px-3 py-2 text-left font-medium">Final State</th>
              <th className="px-3 py-2 text-left font-medium">Cycle Time</th>
              <th className="px-3 py-2 text-left font-medium">Updated</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-3">
                  Loading...
                </td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-3">
                  No past tasks match these filters.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.id} className="border-t border-edge">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{task.title}</div>
                    <div className="text-xs text-ink-3 flex flex-wrap gap-2">
                      {task.project?.name && <Badge variant="secondary">{task.project.name}</Badge>}
                      {task.category && <span>{task.category}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-ink-2">{task.workflowState?.name ?? task.status}</td>
                  <td className="px-3 py-2 text-ink-2">{durationLabel(task)}</td>
                  <td className="px-3 py-2 text-ink-2">{new Date(task.updatedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {reopenState && (
                        <Button
                          onClick={() => reopenTask(task.id)}
                          variant="outline"
                          size="sm"
                        >
                          Reopen
                        </Button>
                      )}
                      <Button
                        onClick={() => toggleArchive(task)}
                        variant="outline"
                        size="sm"
                      >
                        {task.archivedAt ? "Unarchive" : "Archive"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </CardContent>
      </Card>
    </div>
  );
}
