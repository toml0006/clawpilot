import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import {
  ACTIVE_VIEW_CATEGORIES,
  BACKLOG_VIEW_CATEGORIES,
  PAST_VIEW_CATEGORIES,
  isWorkflowCategory,
  mapTaskResponse,
} from "@/lib/workflow";
import { getDefaultWorkflowState, resolveWorkflowState } from "@/lib/tasks/taskMutations";
import { writeAuditLog } from "@/lib/audit";

type TaskView = "active" | "backlog" | "past";

function parsePriority(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseView(value: string | null): TaskView {
  if (value === "backlog" || value === "past") return value;
  return "active";
}

function parseBoolean(value: string | null): boolean | null {
  if (!value) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

async function resolveProjectId(input: {
  projectId?: unknown;
  projectKey?: unknown;
}): Promise<string | null | undefined> {
  if (input.projectId !== undefined) {
    if (input.projectId === null) return null;
    if (typeof input.projectId !== "string" || input.projectId.trim().length === 0) {
      throw new Error("projectId must be a non-empty string or null");
    }
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true },
    });
    if (!project) {
      throw new Error("projectId does not reference an existing project");
    }
    return project.id;
  }

  if (input.projectKey !== undefined) {
    if (input.projectKey === null) return null;
    if (typeof input.projectKey !== "string" || input.projectKey.trim().length === 0) {
      throw new Error("projectKey must be a non-empty string or null");
    }
    const project = await prisma.project.findUnique({
      where: { key: input.projectKey.trim().toLowerCase() },
      select: { id: true },
    });
    if (!project) {
      throw new Error("projectKey does not reference an existing project");
    }
    return project.id;
  }

  return undefined;
}

function categoriesForView(view: TaskView) {
  if (view === "backlog") return BACKLOG_VIEW_CATEGORIES;
  if (view === "past") return PAST_VIEW_CATEGORIES;
  return ACTIVE_VIEW_CATEGORIES;
}

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const { searchParams } = request.nextUrl;
  const view = parseView(searchParams.get("view"));
  const stateCategory = searchParams.get("stateCategory");
  const archivedFilter = parseBoolean(searchParams.get("archived"));
  const hasArtifactsFilter = parseBoolean(searchParams.get("hasArtifacts"));
  const projectId = searchParams.get("projectId");
  const projectKey = searchParams.get("projectKey");
  const q = searchParams.get("q")?.trim();
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? "120"), 250);

  if (stateCategory && !isWorkflowCategory(stateCategory)) {
    return NextResponse.json(
      { error: "stateCategory must be one of backlog|unstarted|started|completed|canceled" },
      { status: 400 }
    );
  }

  const where: Prisma.TaskWhereInput = {};

  if (stateCategory) {
    where.workflowState = { category: stateCategory };
  } else {
    where.workflowState = {
      category: {
        in: categoriesForView(view),
      },
    };
  }

  if (archivedFilter !== null) {
    where.archivedAt = archivedFilter ? { not: null } : null;
  } else if (view !== "past") {
    where.archivedAt = null;
  }

  if (hasArtifactsFilter !== null) {
    where.artifacts = hasArtifactsFilter ? { some: {} } : { none: {} };
  }

  if (projectId && projectId.trim().length > 0) {
    where.projectId = projectId.trim();
  } else if (projectKey && projectKey.trim().length > 0) {
    where.project = {
      key: projectKey.trim().toLowerCase(),
    };
  }

  if (q && q.length > 0) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { category: { contains: q } },
    ];
  }

  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    view === "past"
      ? [{ updatedAt: "desc" }]
      : [{ workflowState: { position: "asc" } }, { priority: "asc" }, { createdAt: "asc" }];

  const tasks = await prisma.task.findMany({
    where,
    include: {
      workflowState: true,
      project: true,
      labels: {
        include: { label: true },
        orderBy: { label: { position: "asc" } },
      },
    },
    orderBy,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: Number.isFinite(limit) && limit > 0 ? limit + 1 : 121,
  });

  const hasMore = tasks.length > (Number.isFinite(limit) && limit > 0 ? limit : 120);
  const slice = hasMore ? tasks.slice(0, limit) : tasks;

  return NextResponse.json({
    items: slice.map(mapTaskResponse),
    nextCursor: hasMore ? slice[slice.length - 1]?.id ?? null : null,
  });
}

export async function POST(request: NextRequest) {
  await ensureSystemSetup();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    title,
    description,
    category,
    status,
    workflowStateId,
    projectId,
    projectKey,
    priority,
    dueAt,
    source,
  } = body as Record<string, unknown>;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "title is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return NextResponse.json(
      { error: "description must be a string or null" },
      { status: 400 }
    );
  }

  if (category !== undefined && category !== null && typeof category !== "string") {
    return NextResponse.json(
      { error: "category must be a string or null" },
      { status: 400 }
    );
  }

  if (source !== undefined && source !== "human" && source !== "agent") {
    return NextResponse.json(
      { error: "source must be one of human|agent" },
      { status: 400 }
    );
  }

  let parsedPriority: number | undefined;
  if (priority !== undefined) {
    parsedPriority = parsePriority(priority) ?? undefined;
    if (parsedPriority === undefined) {
      return NextResponse.json(
        { error: "priority must be an integer >= 0" },
        { status: 400 }
      );
    }
  }

  let parsedDueAt: Date | undefined;
  if (dueAt !== undefined && dueAt !== null) {
    parsedDueAt = parseDate(dueAt) ?? undefined;
    if (!parsedDueAt) {
      return NextResponse.json({ error: "dueAt must be an ISO date string" }, { status: 400 });
    }
  }

  const defaultState = await getDefaultWorkflowState();
  const targetState = await resolveWorkflowState({
    workflowStateId: typeof workflowStateId === "string" ? workflowStateId : undefined,
    statusKey: typeof status === "string" ? status : undefined,
  });

  let resolvedProjectId: string | null | undefined;
  try {
    resolvedProjectId = await resolveProjectId({
      projectId,
      projectKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid project reference";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: title.trim(),
        description: description === undefined ? undefined : description,
        category: category === undefined ? undefined : category,
        priority: parsedPriority ?? 0,
        dueAt: parsedDueAt,
        source: source === "agent" ? "agent" : "human",
        workflowStateId: targetState.id,
        projectId: resolvedProjectId,
        status: targetState.key,
        revision: 1,
        startedAt: targetState.category === "started" ? new Date() : null,
        completedAt: targetState.category === "completed" ? new Date() : null,
        canceledAt: targetState.category === "canceled" ? new Date() : null,
      },
      include: { workflowState: true },
    });

    await tx.taskTransition.create({
      data: {
        taskId: created.id,
        toStateId: created.workflowStateId ?? defaultState.id,
        reason: "Task created",
        actorType: source === "agent" ? "agent" : "human",
      },
    });

    return created;
  });

  await writeAuditLog({
    actorType: source === "agent" ? "agent" : "human",
    action: "task.create",
    entityType: "task",
    entityId: task.id,
    after: mapTaskResponse(task),
  });

  const taskWithProject = await prisma.task.findUnique({
    where: { id: task.id },
    include: {
      workflowState: true,
      project: true,
      labels: {
        include: { label: true },
        orderBy: { label: { position: "asc" } },
      },
    },
  });

  if (!taskWithProject) {
    return NextResponse.json({ error: "Failed to load created task" }, { status: 500 });
  }

  return NextResponse.json(mapTaskResponse(taskWithProject), { status: 201 });
}
