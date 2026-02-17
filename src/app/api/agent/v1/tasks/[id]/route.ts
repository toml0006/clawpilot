import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";
import { buildTransitionPatch, isReopen } from "@/lib/tasks/transition";
import { resolveWorkflowState } from "@/lib/tasks/taskMutations";
import {
  ensureAgentMutation,
  evaluateOrQueueAgentAction,
  finalizeAgentMutation,
  requireAgentCredential,
} from "@/lib/api/agentRequest";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  projectKey: z.string().optional().nullable(),
  workflowStateId: z.string().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
  reason: z.string().trim().optional(),
  revision: z.number().int().min(0).optional(),
});

async function resolveProjectId(input: {
  projectId?: string | null;
  projectKey?: string | null;
}) {
  if (input.projectId !== undefined) {
    if (input.projectId === null) return null;
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true },
    });
    if (!project) throw new Error("projectId does not reference an existing project");
    return project.id;
  }

  if (input.projectKey !== undefined) {
    if (input.projectKey === null) return null;
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

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

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { workflowState: true, project: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.revision !== undefined && parsed.data.revision !== existing.revision) {
    return NextResponse.json(
      {
        error: "Revision mismatch",
        expectedRevision: existing.revision,
      },
      { status: 409 }
    );
  }

  const mutation = await ensureAgentMutation(request, `agent.tasks.${id}.patch`, parsed.data);
  if (!mutation.ok) return mutation.response;

  const targetState =
    parsed.data.workflowStateId || parsed.data.status
      ? await resolveWorkflowState({
          workflowStateId: parsed.data.workflowStateId,
          statusKey: parsed.data.status,
        })
      : null;

  let resolvedProjectId: string | null | undefined;
  try {
    resolvedProjectId = await resolveProjectId({
      projectId: parsed.data.projectId,
      projectKey: parsed.data.projectKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid project reference";
    const body = { error: message };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.patch`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 400,
      body,
    });
    return NextResponse.json(body, { status: 400 });
  }

  const action = targetState
    ? isReopen(existing.workflowState?.category, targetState.category)
      ? "task.reopen"
      : "task.transition"
    : "task.update";

  const policy = await evaluateOrQueueAgentAction({
    action,
    context: {
      fromCategory: existing.workflowState?.category ?? null,
      toCategory: targetState?.category ?? null,
    },
    taskId: existing.id,
    payload: parsed.data,
    credentialId: auth.credential.id,
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.patch`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  const data: {
    title?: string;
    description?: string | null;
    category?: string | null;
    priority?: number;
    dueAt?: Date | null;
    archivedAt?: Date | null;
    projectId?: string | null;
    status?: string;
    workflowStateId?: string;
    startedAt?: Date | null;
    completedAt?: Date | null;
    canceledAt?: Date | null;
    revision: { increment: number };
  } = {
    revision: { increment: 1 },
  };

  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.category !== undefined) data.category = parsed.data.category;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.dueAt !== undefined) data.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  if (parsed.data.archivedAt !== undefined) {
    data.archivedAt = parsed.data.archivedAt ? new Date(parsed.data.archivedAt) : null;
  }
  if (resolvedProjectId !== undefined) data.projectId = resolvedProjectId;

  if (targetState && targetState.id !== existing.workflowStateId) {
    Object.assign(data, buildTransitionPatch(existing, targetState));
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.task.update({
      where: { id },
      data,
      include: { workflowState: true, project: true },
    });

    if (targetState && targetState.id !== existing.workflowStateId) {
      await tx.taskTransition.create({
        data: {
          taskId: existing.id,
          fromStateId: existing.workflowStateId,
          toStateId: targetState.id,
          reason: parsed.data.reason ?? "Updated by agent",
          actorType: "agent",
          actorId: auth.credential.id,
          requestId: request.headers.get("x-clawpilot-request-id"),
        },
      });
    }

    return next;
  });

  await writeAuditLog({
    actorType: "agent",
    actorId: auth.credential.id,
    action,
    entityType: "task",
    entityId: id,
    before: mapTaskResponse(existing),
    after: mapTaskResponse(updated),
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  const body = mapTaskResponse(updated);
  await finalizeAgentMutation({
    scope: `agent.tasks.${id}.patch`,
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 200,
    body,
  });

  return NextResponse.json(body);
}
