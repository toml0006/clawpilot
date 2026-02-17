import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import {
  ensureAgentMutation,
  evaluateOrQueueAgentAction,
  finalizeAgentMutation,
  requireAgentCredential,
} from "@/lib/api/agentRequest";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  body: z.string().trim().min(1),
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

  const mutation = await ensureAgentMutation(request, `agent.tasks.${id}.comments.create`, parsed.data);
  if (!mutation.ok) return mutation.response;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    const body = { error: "Task not found" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.comments.create`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  const policy = await evaluateOrQueueAgentAction({
    action: "task.comment",
    taskId: task.id,
    payload: parsed.data,
    credentialId: auth.credential.id,
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.comments.create`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId: id,
      body: parsed.data.body,
      authorType: "agent",
      authorId: auth.credential.id,
      requestId: request.headers.get("x-clawpilot-request-id"),
    },
  });

  await writeAuditLog({
    actorType: "agent",
    actorId: auth.credential.id,
    action: "task.comment",
    entityType: "task_comment",
    entityId: comment.id,
    after: comment,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  await finalizeAgentMutation({
    scope: `agent.tasks.${id}.comments.create`,
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 201,
    body: comment,
  });

  return NextResponse.json(comment, { status: 201 });
}
