"use client";

import { useCallback, useEffect, useState } from "react";
import { Board } from "@/components/Board";
import { TaskDetail } from "@/components/TaskDetail";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

type Project = {
  id: string;
  name: string;
};

export default function BacklogPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groupByProject, setGroupByProject] = useState(false);
  const [projectFilterId, setProjectFilterId] = useState<string>("all");

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json() as Promise<Project[]>)
      .then((data) => setProjects(data))
      .catch(() => setProjects([]));
  }, [refreshKey]);

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg font-semibold text-ink font-heading">Backlog</CardTitle>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={groupByProject ? "secondary" : "outline"}
              onClick={() => setGroupByProject((value) => !value)}
            >
              {groupByProject ? "Grouped by Project" : "Group by Project"}
            </Button>

            <Select
              value={projectFilterId}
              onChange={(e) => setProjectFilterId(e.target.value)}
              className="h-8 w-44 text-xs"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Board
        view="backlog"
        groupByProject={groupByProject}
        projectFilterId={projectFilterId}
        refreshKey={refreshKey}
        onSelect={(taskId) => setSelectedTaskId(taskId)}
      />

      {selectedTaskId && (
        <TaskDetail
          key={selectedTaskId}
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={refresh}
          onDeleted={() => {
            setSelectedTaskId(null);
            refresh();
          }}
        />
      )}

      {showCreate && (
        <CreateTaskDialog
          defaultStatus="backlog"
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </>
  );
}
