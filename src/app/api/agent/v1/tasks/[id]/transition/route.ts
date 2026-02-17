import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";
import { isReopen } from "@/lib/tasks/transition";
import { transitionTask } from "@/lib/tasks/taskMutations";
import {
  ensureAgentMutation,
  evaluateOrQueueAgentAction,
  finalizeAgentMutation,
  requireAgentCredential,
} from "@/lib/api/agentRequest";

const schema = z.object({
  workflowStateId: z.string().optional(),
  status: z.string().optional(),
  reason: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const mutation = await ensureAgentMutation(request, `agent.tasks.${id}.transition`, parsed.data);
  if (!mutation.ok) return mutation.response;

  const task = await prisma.task.findUnique({ where: { id }, include: { workflowState: true } });
  if (!task) {
    const body = { error: "Task not found" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.transition`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  const targetState =
    parsed.data.workflowStateId
      ? await prisma.workflowState.findUnique({ where: { id: parsed.data.workflowStateId } })
      : parsed.data.status
        ? await prisma.workflowState.findUnique({
            where: { key: parsed.data.status.trim().toLowerCase() },
          })
        : null;

  if (!targetState) {
    const body = { error: "workflowStateId or status is required and must match a state" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.transition`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 400,
      body,
    });
    return NextResponse.json(body, { status: 400 });
  }

  if (targetState.category === "canceled" && !parsed.data.reason) {
    const body = { error: "reason is required when transitioning to canceled" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.transition`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 400,
      body,
    });
    return NextResponse.json(body, { status: 400 });
  }

  const action = isReopen(task.workflowState?.category, targetState.category)
    ? "task.reopen"
    : "task.transition";

  const policy = await evaluateOrQueueAgentAction({
    action,
    taskId: task.id,
    payload: parsed.data,
    credentialId: auth.credential.id,
    context: {
      fromCategory: task.workflowState?.category ?? null,
      toCategory: targetState.category,
    },
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.transition`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  const updated = await transitionTask({
    taskId: id,
    toStateId: targetState.id,
    reason: parsed.data.reason ?? "Transition by agent",
    actor: {
      actorType: "agent",
      actorId: auth.credential.id,
      requestId: request.headers.get("x-clawpilot-request-id"),
    },
  });

  const body = mapTaskResponse(updated);

  await finalizeAgentMutation({
    scope: `agent.tasks.${id}.transition`,
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 200,
    body,
  });

  return NextResponse.json(body);
}
