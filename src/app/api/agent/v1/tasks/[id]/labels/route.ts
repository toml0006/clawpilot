import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";
import {
  ensureAgentMutation,
  evaluateOrQueueAgentAction,
  finalizeAgentMutation,
  requireAgentCredential,
} from "@/lib/api/agentRequest";

type RouteContext = { params: Promise<{ id: string }> };

const addLabelSchema = z.object({
  labelId: z.string().optional(),
  labelKey: z.string().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      labels: {
        include: { label: true },
        orderBy: { label: { position: "asc" } },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ items: task.labels.map((tl) => tl.label) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addLabelSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!parsed.data.labelId && !parsed.data.labelKey) {
    return NextResponse.json(
      { error: "Either labelId or labelKey is required" },
      { status: 400 }
    );
  }

  const mutation = await ensureAgentMutation(request, "agent.task.label.add", {
    taskId,
    ...parsed.data,
  });
  if (!mutation.ok) return mutation.response;

  const policy = await evaluateOrQueueAgentAction({
    action: "task.label.add",
    payload: { taskId, ...parsed.data },
    credentialId: auth.credential.id,
    taskId,
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: "agent.task.label.add",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  let label;
  if (parsed.data.labelId) {
    label = await prisma.label.findUnique({ where: { id: parsed.data.labelId } });
  } else if (parsed.data.labelKey) {
    label = await prisma.label.findUnique({ where: { key: parsed.data.labelKey } });
  }

  if (!label) {
    const body = { error: "Label not found" };
    await finalizeAgentMutation({
      scope: "agent.task.label.add",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  const existing = await prisma.taskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });

  if (existing) {
    const body = { error: "Label already attached" };
    await finalizeAgentMutation({
      scope: "agent.task.label.add",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 409,
      body,
    });
    return NextResponse.json(body, { status: 409 });
  }

  await prisma.taskLabel.create({
    data: { taskId, labelId: label.id },
  });

  await writeAuditLog({
    actorType: "agent",
    actorId: auth.credential.id,
    action: "task.label.add",
    entityType: "task",
    entityId: taskId,
    after: { labelId: label.id, labelKey: label.key },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  const labels = await prisma.taskLabel.findMany({
    where: { taskId },
    include: { label: true },
    orderBy: { label: { position: "asc" } },
  });

  const body = { items: labels.map((tl) => tl.label) };

  await finalizeAgentMutation({
    scope: "agent.task.label.add",
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 201,
    body,
  });

  return NextResponse.json(body, { status: 201 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addLabelSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!parsed.data.labelId && !parsed.data.labelKey) {
    return NextResponse.json(
      { error: "Either labelId or labelKey is required" },
      { status: 400 }
    );
  }

  const mutation = await ensureAgentMutation(request, "agent.task.label.remove", {
    taskId,
    ...parsed.data,
  });
  if (!mutation.ok) return mutation.response;

  const policy = await evaluateOrQueueAgentAction({
    action: "task.label.remove",
    payload: { taskId, ...parsed.data },
    credentialId: auth.credential.id,
    taskId,
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: "agent.task.label.remove",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  let label;
  if (parsed.data.labelId) {
    label = await prisma.label.findUnique({ where: { id: parsed.data.labelId } });
  } else if (parsed.data.labelKey) {
    label = await prisma.label.findUnique({ where: { key: parsed.data.labelKey } });
  }

  if (!label) {
    const body = { error: "Label not found" };
    await finalizeAgentMutation({
      scope: "agent.task.label.remove",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  const existing = await prisma.taskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });

  if (!existing) {
    const body = { error: "Label not attached to task" };
    await finalizeAgentMutation({
      scope: "agent.task.label.remove",
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  await prisma.taskLabel.delete({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });

  await writeAuditLog({
    actorType: "agent",
    actorId: auth.credential.id,
    action: "task.label.remove",
    entityType: "task",
    entityId: taskId,
    before: { labelId: label.id, labelKey: label.key },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  await finalizeAgentMutation({
    scope: "agent.task.label.remove",
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 204,
    body: null,
  });

  return new NextResponse(null, { status: 204 });
}
