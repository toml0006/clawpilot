import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";
import { resolveWorkflowState } from "@/lib/tasks/taskMutations";
import { writeAuditLog } from "@/lib/audit";
import {
  ensureAgentMutation,
  evaluateOrQueueAgentAction,
  finalizeAgentMutation,
  requireAgentCredential,
} from "@/lib/api/agentRequest";

const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  projectKey: z.string().optional().nullable(),
  workflowStateId: z.string().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).optional(),
  dueAt: z.string().datetime().optional().nullable(),
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

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const view = request.nextUrl.searchParams.get("view") ?? "active";
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();

  const where = {
    archivedAt: null,
    ...(view === "past"
      ? { workflowState: { category: { in: ["completed", "canceled"] } } }
      : view === "backlog"
        ? { workflowState: { category: "backlog" } }
        : { workflowState: { category: { in: ["unstarted", "started"] } } }),
    ...(q && q.length > 0
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { category: { contains: q } },
          ],
        }
      : {}),
    ...(projectId ? { projectId } : {}),
  };

  const tasks = await prisma.task.findMany({
    where,
    include: { workflowState: true, project: true },
    orderBy: [{ workflowState: { position: "asc" } }, { priority: "asc" }, { createdAt: "asc" }],
    take: 300,
  });

  return NextResponse.json({
    items: tasks.map(mapTaskResponse),
  });
}

export async function POST(request: NextRequest) {
  await ensureSystemSetup();

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const mutation = await ensureAgentMutation(request, "agent.tasks.create", parsed.data);
  if (!mutation.ok) return mutation.response;

  const policy = await evaluateOrQueueAgentAction({
    action: "task.create",
    payload: parsed.data,
    credentialId: auth.credential.id,
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: "agent.tasks.create",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  const state = await resolveWorkflowState({
    workflowStateId: parsed.data.workflowStateId,
    statusKey: parsed.data.status,
  });

  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  let projectId: string | null | undefined;
  try {
    projectId = await resolveProjectId({
      projectId: parsed.data.projectId,
      projectKey: parsed.data.projectKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid project reference";
    const body = { error: message };
    await finalizeAgentMutation({
      scope: "agent.tasks.create",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 400,
      body,
    });
    return NextResponse.json(body, { status: 400 });
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        category: parsed.data.category ?? null,
        priority: parsed.data.priority ?? 0,
        dueAt,
        projectId,
        source: "agent",
        status: state.key,
        workflowStateId: state.id,
        revision: 1,
        startedAt: state.category === "started" ? new Date() : null,
        completedAt: state.category === "completed" ? new Date() : null,
        canceledAt: state.category === "canceled" ? new Date() : null,
      },
      include: { workflowState: true, project: true },
    });

    await tx.taskTransition.create({
      data: {
        taskId: created.id,
        toStateId: state.id,
        reason: "Created by agent",
        actorType: "agent",
        actorId: auth.credential.id,
        requestId: request.headers.get("x-clawpilot-request-id"),
      },
    });

    return created;
  });

  await writeAuditLog({
    actorType: "agent",
    actorId: auth.credential.id,
    action: "task.create",
    entityType: "task",
    entityId: task.id,
    after: mapTaskResponse(task),
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  const body = mapTaskResponse(task);

  await finalizeAgentMutation({
    scope: "agent.tasks.create",
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 201,
    body,
  });

  return NextResponse.json(body, { status: 201 });
}
