"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { THEME_LIST, type ThemeId } from "@/lib/themes";
import { ColorModeToggle } from "@/components/ColorModeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AppSettings = {
  instanceName: string;
  defaultProjectId: string | null;
  boardDensity: string;
  openclawGatewayUrl: string;
  openclawApiTimeout: number;
  agentAutoApprove: boolean;
  agentMaxConcurrentJobs: number;
};

type Credential = {
  id: string;
  name: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  key: string;
  color: string;
  position: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectDraft = {
  name: string;
  key: string;
  color: string;
  position: number;
};

type NewProjectDraft = {
  name: string;
  key: string;
  color: string;
  position: number;
};

type Tab = "appearance" | "general" | "projects" | "openclaw";

const tabs: { key: Tab; label: string }[] = [
  { key: "appearance", label: "Appearance" },
  { key: "general", label: "General" },
  { key: "projects", label: "Projects" },
  { key: "openclaw", label: "OpenClaw" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("appearance");
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDrafts, setProjectDrafts] = useState<Record<string, ProjectDraft>>({});
  const [newProject, setNewProject] = useState<NewProjectDraft>({
    name: "",
    key: "",
    color: "#4f46e5",
    position: 999,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<AppSettings | null>(null);

  const [newTokenName, setNewTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const [settingsRes, projectsRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/projects?includeArchived=true"),
    ]);

    if (settingsRes.ok) {
      const data = await settingsRes.json();
      setSettings(data.app);
      setForm(data.app);
      setCredentials(data.credentials ?? []);
    }

    if (projectsRes.ok) {
      const projectData = (await projectsRes.json()) as Project[];
      setProjects(projectData);
      setProjectDrafts(
        Object.fromEntries(
          projectData.map((project) => [
            project.id,
            {
              name: project.name,
              key: project.key,
              color: project.color,
              position: project.position,
            },
          ])
        )
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  }

  function updateForm<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateProjectDraft(
    projectId: string,
    patch: Partial<ProjectDraft>
  ) {
    setProjectDrafts((prev) => {
      const current = prev[projectId];
      if (!current) return prev;
      return {
        ...prev,
        [projectId]: {
          ...current,
          ...patch,
        },
      };
    });
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: form }),
    });

    if (res.ok) {
      const data = await res.json();
      setSettings(data.app);
      setForm(data.app);
      showMessage("Settings saved");
    } else {
      const err = await res.json().catch(() => ({ error: "Failed to save" }));
      setMessage(err.error ?? "Failed to save");
    }

    setSaving(false);
  }

  async function createCredential() {
    if (!newTokenName.trim()) return;
    setCreatingToken(true);

    const res = await fetch("/api/settings/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTokenName.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      setRevealedToken(data.token);
      setNewTokenName("");
      await load();
      showMessage("Token created");
    } else {
      const err = await res.json().catch(() => ({ error: "Failed to create token" }));
      setMessage(err.error ?? "Failed to create token");
    }

    setCreatingToken(false);
  }

  async function revokeCredential(id: string) {
    const res = await fetch(`/api/settings/credentials/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      showMessage("Credential revoked");
    } else {
      setMessage("Failed to revoke credential");
    }
  }

  async function copyToken() {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function createProject() {
    const payload = {
      name: newProject.name.trim(),
      key: newProject.key.trim() || undefined,
      color: newProject.color,
      position: newProject.position,
    };

    if (!payload.name) {
      setMessage("Project name is required");
      return;
    }

    setCreatingProject(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setNewProject({
        name: "",
        key: "",
        color: "#4f46e5",
        position: 999,
      });
      await load();
      showMessage("Project created");
    } else {
      const err = await res.json().catch(() => ({ error: "Failed to create project" }));
      setMessage(err.error ?? "Failed to create project");
    }

    setCreatingProject(false);
  }

  function buildProjectPatch(
    project: Project,
    draft: ProjectDraft
  ): { patch: Record<string, unknown> } | { error: string } {
    const patch: Record<string, unknown> = {};

    const nextName = draft.name.trim();
    const nextKey = draft.key.trim();
    if (!nextName || !nextKey) {
      return { error: "Project name and key are required" } as const;
    }

    if (nextName !== project.name) patch.name = nextName;
    if (nextKey !== project.key) patch.key = nextKey;
    if (draft.color !== project.color) patch.color = draft.color;
    if (draft.position !== project.position) patch.position = draft.position;

    return { patch } as const;
  }

  async function saveProject(projectId: string) {
    const project = projects.find((entry) => entry.id === projectId);
    const draft = projectDrafts[projectId];
    if (!project || !draft) return;

    const prepared = buildProjectPatch(project, draft);
    if ("error" in prepared) {
      setMessage(prepared.error);
      return;
    }

    if (Object.keys(prepared.patch).length === 0) {
      return;
    }

    setSavingProjectId(projectId);

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepared.patch),
    });

    if (res.ok) {
      await load();
      showMessage("Project updated");
    } else {
      const err = await res.json().catch(() => ({ error: "Failed to update project" }));
      setMessage(err.error ?? "Failed to update project");
    }

    setSavingProjectId(null);
  }

  async function toggleProjectArchived(project: Project) {
    setSavingProjectId(project.id);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.archivedAt }),
    });

    if (res.ok) {
      await load();
      showMessage(project.archivedAt ? "Project restored" : "Project archived");
    } else {
      const err = await res.json().catch(() => ({ error: "Failed to update project" }));
      setMessage(err.error ?? "Failed to update project");
    }

    setSavingProjectId(null);
  }

  const hasChanges =
    form && settings && JSON.stringify(form) !== JSON.stringify(settings);

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt),
    [projects]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-edge"
          style={{ borderTopColor: "var(--th-accent)" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink font-heading">Settings</h2>
        {message && (
          <span
            className={`text-sm font-medium ${
              message.toLowerCase().includes("failed") ||
              message.toLowerCase().includes("required")
                ? "text-danger"
                : "text-accent"
            }`}
          >
            {message}
          </span>
        )}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="grid w-full grid-cols-4">
          {tabs.map((entry) => (
            <TabsTrigger key={entry.key} value={entry.key}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="appearance">
          <AppearanceTab theme={theme} setTheme={setTheme} />
        </TabsContent>

        <TabsContent value="general">
          {form && (
            <GeneralTab
              form={form}
              projects={activeProjects}
              updateForm={updateForm}
              hasChanges={Boolean(hasChanges)}
              saving={saving}
              onSave={save}
            />
          )}
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTab
            projects={projects}
            projectDrafts={projectDrafts}
            savingProjectId={savingProjectId}
            newProject={newProject}
            creatingProject={creatingProject}
            onCreateProject={createProject}
            onUpdateProjectDraft={updateProjectDraft}
            onUpdateNewProject={setNewProject}
            onSaveProject={saveProject}
            onToggleProjectArchived={toggleProjectArchived}
          />
        </TabsContent>

        <TabsContent value="openclaw">
          {form && (
            <OpenClawTab
              form={form}
              updateForm={updateForm}
              hasChanges={Boolean(hasChanges)}
              saving={saving}
              onSave={save}
              credentials={credentials}
              newTokenName={newTokenName}
              setNewTokenName={setNewTokenName}
              creatingToken={creatingToken}
              onCreateCredential={createCredential}
              revealedToken={revealedToken}
              onDismissToken={() => setRevealedToken(null)}
              onCopyToken={copyToken}
              copied={copied}
              onRevoke={revokeCredential}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppearanceTab({
  theme,
  setTheme,
}: {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose a visual theme for your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {THEME_LIST.map((entry) => {
              const active = theme === entry.id;
              return (
                <Button
                  key={entry.id}
                  variant="outline"
                  onClick={() => setTheme(entry.id)}
                  className={`h-auto flex-col items-start gap-2 rounded-themed-lg p-3.5 text-left ${
                    active
                      ? "border-accent bg-accent/5 ring-1 ring-ring"
                      : "border-edge hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {entry.colors.slice(0, 4).map((color, index) => (
                      <div
                        key={index}
                        className="h-4 w-4 rounded-sm"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">{entry.name}</div>
                    <div className="text-xs text-ink-3">{entry.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Mode</CardTitle>
          <CardDescription>Switch between light, dark, or system preference</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <ColorModeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralTab({
  form,
  projects,
  updateForm,
  hasChanges,
  saving,
  onSave,
}: {
  form: AppSettings;
  projects: Project[];
  updateForm: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>App Configuration</CardTitle>
          <CardDescription>General settings for your ClawPilot instance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Instance Name" hint="Displayed in the sidebar header">
            <Input
              type="text"
              value={form.instanceName}
              onChange={(e) => updateForm("instanceName", e.target.value)}
            />
          </Field>

          <Field
            label="Default Project"
            hint="Pre-selected project when creating new tasks"
          >
            <select
              value={form.defaultProjectId ?? ""}
              onChange={(e) =>
                updateForm(
                  "defaultProjectId",
                  e.target.value === "" ? null : e.target.value
                )
              }
              className="h-9 w-full rounded-themed border border-edge bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Board Density" hint="Card size on the task board">
            <div className="flex gap-2">
              {(["default", "compact"] as const).map((density) => (
                <Button
                  key={density}
                  type="button"
                  variant={form.boardDensity === density ? "default" : "outline"}
                  onClick={() => updateForm("boardDensity", density)}
                >
                  {density.charAt(0).toUpperCase() + density.slice(1)}
                </Button>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>

      <SaveBar hasChanges={hasChanges} saving={saving} onSave={onSave} />
    </div>
  );
}

function ProjectsTab({
  projects,
  projectDrafts,
  savingProjectId,
  newProject,
  creatingProject,
  onCreateProject,
  onUpdateProjectDraft,
  onUpdateNewProject,
  onSaveProject,
  onToggleProjectArchived,
}: {
  projects: Project[];
  projectDrafts: Record<string, ProjectDraft>;
  savingProjectId: string | null;
  newProject: NewProjectDraft;
  creatingProject: boolean;
  onCreateProject: () => void;
  onUpdateProjectDraft: (projectId: string, patch: Partial<ProjectDraft>) => void;
  onUpdateNewProject: (value: NewProjectDraft) => void;
  onSaveProject: (projectId: string) => void;
  onToggleProjectArchived: (project: Project) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Create Project</CardTitle>
          <CardDescription>
            Configure project grouping used across the board and filters.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={newProject.name}
              onChange={(e) =>
                onUpdateNewProject({
                  ...newProject,
                  name: e.target.value,
                })
              }
              placeholder="Project name"
            />
          </div>
          <div>
            <Label htmlFor="project-key">Key</Label>
            <Input
              id="project-key"
              value={newProject.key}
              onChange={(e) =>
                onUpdateNewProject({
                  ...newProject,
                  key: e.target.value,
                })
              }
              placeholder="Optional key"
            />
          </div>
          <div>
            <Label htmlFor="project-position">Position</Label>
            <Input
              id="project-position"
              type="number"
              value={newProject.position}
              onChange={(e) =>
                onUpdateNewProject({
                  ...newProject,
                  position: Number(e.target.value) || 0,
                })
              }
              min={0}
            />
          </div>
          <div>
            <Label htmlFor="project-color">Color</Label>
            <Input
              id="project-color"
              type="color"
              value={newProject.color}
              onChange={(e) =>
                onUpdateNewProject({
                  ...newProject,
                  color: e.target.value,
                })
              }
              className="h-9 p-1"
            />
          </div>
          <div className="md:col-span-3" />
          <div className="flex items-end justify-end">
            <Button onClick={onCreateProject} disabled={creatingProject || !newProject.name.trim()}>
              {creatingProject ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Projects</CardTitle>
          <CardDescription>Edit metadata, order, and archive state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.length === 0 ? (
            <p className="text-sm text-ink-3">No projects found.</p>
          ) : (
            projects.map((project) => {
              const draft = projectDrafts[project.id];
              if (!draft) return null;

              const dirty =
                draft.name.trim() !== project.name ||
                draft.key.trim() !== project.key ||
                draft.color !== project.color ||
                draft.position !== project.position;

              return (
                <div
                  key={project.id}
                  className="rounded-themed border border-edge bg-surface-alt p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <p className="text-sm font-medium text-ink">{project.name}</p>
                    {project.archivedAt ? (
                      <Badge variant="muted">Archived</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <Label htmlFor={`project-name-${project.id}`}>Name</Label>
                      <Input
                        id={`project-name-${project.id}`}
                        value={draft.name}
                        onChange={(e) =>
                          onUpdateProjectDraft(project.id, { name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`project-key-${project.id}`}>Key</Label>
                      <Input
                        id={`project-key-${project.id}`}
                        value={draft.key}
                        onChange={(e) =>
                          onUpdateProjectDraft(project.id, { key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`project-position-${project.id}`}>Position</Label>
                      <Input
                        id={`project-position-${project.id}`}
                        type="number"
                        value={draft.position}
                        min={0}
                        onChange={(e) =>
                          onUpdateProjectDraft(project.id, {
                            position: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`project-color-${project.id}`}>Color</Label>
                      <Input
                        id={`project-color-${project.id}`}
                        type="color"
                        value={draft.color}
                        onChange={(e) =>
                          onUpdateProjectDraft(project.id, { color: e.target.value })
                        }
                        className="h-9 p-1"
                      />
                    </div>
                    <div className="md:col-span-3" />
                    <div className="flex items-end justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => onToggleProjectArchived(project)}
                        disabled={savingProjectId === project.id}
                      >
                        {project.archivedAt ? "Restore" : "Archive"}
                      </Button>
                      <Button
                        onClick={() => onSaveProject(project.id)}
                        disabled={!dirty || savingProjectId === project.id}
                      >
                        {savingProjectId === project.id ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpenClawTab({
  form,
  updateForm,
  hasChanges,
  saving,
  onSave,
  credentials,
  newTokenName,
  setNewTokenName,
  creatingToken,
  onCreateCredential,
  revealedToken,
  onDismissToken,
  onCopyToken,
  copied,
  onRevoke,
}: {
  form: AppSettings;
  updateForm: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  credentials: Credential[];
  newTokenName: string;
  setNewTokenName: (v: string) => void;
  creatingToken: boolean;
  onCreateCredential: () => void;
  revealedToken: string | null;
  onDismissToken: () => void;
  onCopyToken: () => void;
  copied: boolean;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Gateway Connection</CardTitle>
          <CardDescription>
            Configure how ClawPilot connects to the OpenClaw gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Gateway URL" hint="Base URL of the OpenClaw gateway service">
            <Input
              type="url"
              value={form.openclawGatewayUrl}
              onChange={(e) => updateForm("openclawGatewayUrl", e.target.value)}
              placeholder="http://localhost:8080"
            />
          </Field>

          <Field label="API Timeout" hint="Maximum wait time for gateway responses (ms)">
            <Input
              type="number"
              value={form.openclawApiTimeout}
              onChange={(e) =>
                updateForm("openclawApiTimeout", parseInt(e.target.value, 10) || 30000)
              }
              min={1000}
              max={300000}
              step={1000}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Behavior</CardTitle>
          <CardDescription>Control how agents operate within ClawPilot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="Auto-Approve Actions"
            hint="Skip the approval queue for actions that require approval"
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={form.agentAutoApprove}
                onCheckedChange={(value) => updateForm("agentAutoApprove", value)}
              />
              {form.agentAutoApprove && (
                <span className="text-xs font-medium text-danger">
                  Agents will bypass the approval queue
                </span>
              )}
            </div>
          </Field>

          <Field
            label="Max Concurrent Jobs"
            hint="Maximum number of agent jobs running at once"
          >
            <Input
              type="number"
              value={form.agentMaxConcurrentJobs}
              onChange={(e) =>
                updateForm("agentMaxConcurrentJobs", parseInt(e.target.value, 10) || 3)
              }
              min={1}
              max={20}
            />
          </Field>
        </CardContent>
      </Card>

      <SaveBar hasChanges={hasChanges} saving={saving} onSave={onSave} />

      <Card>
        <CardHeader>
          <CardTitle>Agent Credentials</CardTitle>
          <CardDescription>
            Manage API tokens that agents use to authenticate with ClawPilot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {revealedToken && (
            <div className="rounded-themed border border-accent bg-accent/5 p-4 space-y-2">
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">
                New Token Created
              </p>
              <p className="text-xs text-ink-2">
                Copy this token now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-themed bg-surface-alt px-3 py-2 text-xs font-mono text-ink break-all">
                  {revealedToken}
                </code>
                <Button variant="outline" size="sm" onClick={onCopyToken}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={onDismissToken} className="px-0">
                Dismiss
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="Token name (e.g. 'My Agent')"
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateCredential();
              }}
            />
            <Button
              onClick={onCreateCredential}
              disabled={creatingToken || !newTokenName.trim()}
            >
              {creatingToken ? "Creating..." : "Generate Token"}
            </Button>
          </div>

          {credentials.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="pb-2 pr-4 text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="pb-2 pr-4 text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Created
                    </th>
                    <th className="pb-2 text-xs font-medium text-ink-3 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {credentials.map((cred) => (
                    <tr key={cred.id}>
                      <td className="py-2.5 pr-4 font-medium text-ink">{cred.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={cred.status === "active" ? "default" : "muted"}>
                          {cred.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-ink-2">
                        {new Date(cred.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5">
                        {cred.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger"
                            onClick={() => onRevoke(cred.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-3 italic">No credentials configured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SaveBar({
  hasChanges,
  saving,
  onSave,
}: {
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button onClick={onSave} disabled={!hasChanges || saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
