import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";
import { transitionTask } from "@/lib/tasks/taskMutations";
import {
  ensureAgentMutation,
  evaluateOrQueueAgentAction,
  finalizeAgentMutation,
  requireAgentCredential,
} from "@/lib/api/agentRequest";

const schema = z.object({
  reason: z.string().trim().optional(),
  summary: z.string().trim().optional(),
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
    json = {};
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const mutation = await ensureAgentMutation(request, `agent.tasks.${id}.complete`, parsed.data);
  if (!mutation.ok) return mutation.response;

  const task = await prisma.task.findUnique({ where: { id }, include: { workflowState: true } });
  if (!task) {
    const body = { error: "Task not found" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.complete`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  const doneState =
    (await prisma.workflowState.findUnique({ where: { key: "done" } })) ||
    (await prisma.workflowState.findFirst({ where: { category: "completed" } }));

  if (!doneState) {
    const body = { error: "No completed workflow state configured" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.complete`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 500,
      body,
    });
    return NextResponse.json(body, { status: 500 });
  }

  const policy = await evaluateOrQueueAgentAction({
    action: "task.complete",
    taskId: task.id,
    payload: parsed.data,
    credentialId: auth.credential.id,
    context: {
      fromCategory: task.workflowState?.category ?? null,
      toCategory: doneState.category,
    },
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.complete`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  const updated = await transitionTask({
    taskId: id,
    toStateId: doneState.id,
    reason: parsed.data.reason ?? "Completed by agent",
    actor: {
      actorType: "agent",
      actorId: auth.credential.id,
      requestId: request.headers.get("x-clawpilot-request-id"),
    },
  });

  if (parsed.data.summary && parsed.data.summary.length > 0) {
    await prisma.taskComment.create({
      data: {
        taskId: id,
        body: parsed.data.summary,
        authorType: "agent",
        authorId: auth.credential.id,
        requestId: request.headers.get("x-clawpilot-request-id"),
      },
    });
  }

  const body = mapTaskResponse(updated);

  await finalizeAgentMutation({
    scope: `agent.tasks.${id}.complete`,
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 200,
    body,
  });

  return NextResponse.json(body);
}
