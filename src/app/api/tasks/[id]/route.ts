import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";
import { buildTransitionPatch } from "@/lib/tasks/transition";
import { resolveWorkflowState } from "@/lib/tasks/taskMutations";
import { writeAuditLog } from "@/lib/audit";

function parsePriority(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    if (!project) throw new Error("projectId does not reference an existing project");
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
    if (!project) throw new Error("projectKey does not reference an existing project");
    return project.id;
  }

  return undefined;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { workflowState: true, project: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(mapTaskResponse(task));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { workflowState: true, project: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

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
    archivedAt,
    dueAt,
    revision,
  } = body as Record<string, unknown>;

  if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
    return NextResponse.json(
      { error: "title must be a non-empty string" },
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

  let parsedDueAt: Date | null | undefined;
  if (dueAt !== undefined) {
    if (dueAt === null) {
      parsedDueAt = null;
    } else {
      parsedDueAt = parseDate(dueAt);
      if (!parsedDueAt) {
        return NextResponse.json(
          { error: "dueAt must be a valid ISO date string" },
          { status: 400 }
        );
      }
    }
  }

  let parsedArchivedAt: Date | null | undefined;
  if (archivedAt !== undefined) {
    if (archivedAt === null) {
      parsedArchivedAt = null;
    } else {
      parsedArchivedAt = parseDate(archivedAt);
      if (!parsedArchivedAt) {
        return NextResponse.json(
          { error: "archivedAt must be a valid ISO date string or null" },
          { status: 400 }
        );
      }
    }
  }

  if (revision !== undefined) {
    if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
      return NextResponse.json(
        { error: "revision must be an integer >= 0" },
        { status: 400 }
      );
    }

    if (existing.revision !== revision) {
      return NextResponse.json(
        {
          error: "Revision mismatch",
          expectedRevision: existing.revision,
        },
        { status: 409 }
      );
    }
  }

  const targetState =
    workflowStateId !== undefined || status !== undefined
      ? await resolveWorkflowState({
          workflowStateId: typeof workflowStateId === "string" ? workflowStateId : undefined,
          statusKey: typeof status === "string" ? status : undefined,
        })
      : null;

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

  const data: {
    title?: string;
    description?: string | null;
    category?: string | null;
    priority?: number;
    archivedAt?: Date | null;
    dueAt?: Date | null;
    projectId?: string | null;
    revision: { increment: number };
    workflowStateId?: string;
    status?: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    canceledAt?: Date | null;
  } = {
    revision: { increment: 1 },
  };

  if (title !== undefined) data.title = String(title).trim();
  if (description !== undefined) data.description = description === null ? null : String(description);
  if (category !== undefined) data.category = category === null ? null : String(category);
  if (parsedPriority !== undefined) data.priority = parsedPriority;
  if (parsedArchivedAt !== undefined) data.archivedAt = parsedArchivedAt;
  if (parsedDueAt !== undefined) data.dueAt = parsedDueAt;
  if (resolvedProjectId !== undefined) data.projectId = resolvedProjectId;

  if (targetState && targetState.id !== existing.workflowStateId) {
    Object.assign(data, buildTransitionPatch(existing, targetState));
  }

  if (Object.keys(data).length === 1) {
    return NextResponse.json(
      { error: "At least one updatable field is required" },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.task.update({
      where: { id },
      data,
      include: { workflowState: true, project: true },
    });

    if (targetState && existing.workflowStateId !== targetState.id) {
      await tx.taskTransition.create({
        data: {
          taskId: id,
          fromStateId: existing.workflowStateId,
          toStateId: targetState.id,
          reason: "Task updated",
          actorType: "human",
        },
      });
    }

    return next;
  });

  await writeAuditLog({
    actorType: "human",
    action: "task.update",
    entityType: "task",
    entityId: id,
    before: mapTaskResponse(existing),
    after: mapTaskResponse(updated),
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json(mapTaskResponse(updated));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { workflowState: true, project: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });

  await writeAuditLog({
    actorType: "human",
    action: "task.delete",
    entityType: "task",
    entityId: id,
    before: mapTaskResponse(existing),
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ ok: true });
}
