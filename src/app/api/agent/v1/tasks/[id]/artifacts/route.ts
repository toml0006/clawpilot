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
  kind: z.enum(["url", "file", "diff", "note"]),
  title: z.string().trim().min(1),
  value: z.string().trim().min(1),
  jobId: z.string().optional(),
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

  const mutation = await ensureAgentMutation(request, `agent.tasks.${id}.artifacts.create`, parsed.data);
  if (!mutation.ok) return mutation.response;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    const body = { error: "Task not found" };
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.artifacts.create`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: 404,
      body,
    });
    return NextResponse.json(body, { status: 404 });
  }

  if (parsed.data.jobId) {
    const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId } });
    if (!job || job.taskId !== id) {
      const body = { error: "jobId does not belong to this task" };
      await finalizeAgentMutation({
        scope: `agent.tasks.${id}.artifacts.create`,
        idempotencyKey: mutation.idempotencyKey,
        hash: mutation.hash,
        statusCode: 400,
        body,
      });
      return NextResponse.json(body, { status: 400 });
    }
  }

  const policy = await evaluateOrQueueAgentAction({
    action: "task.artifact",
    taskId: task.id,
    payload: parsed.data,
    credentialId: auth.credential.id,
  });

  if (policy.type === "deny" || policy.type === "approval") {
    await finalizeAgentMutation({
      scope: `agent.tasks.${id}.artifacts.create`,
      idempotencyKey: mutation.idempotencyKey,
      hash: mutation.hash,
      statusCode: policy.response.status,
      body: await policy.response.clone().json(),
    });
    return policy.response;
  }

  const artifact = await prisma.artifact.create({
    data: {
      taskId: id,
      jobId: parsed.data.jobId ?? null,
      kind: parsed.data.kind,
      title: parsed.data.title,
      value: parsed.data.value,
    },
  });

  await writeAuditLog({
    actorType: "agent",
    actorId: auth.credential.id,
    action: "task.artifact",
    entityType: "artifact",
    entityId: artifact.id,
    after: artifact,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  await finalizeAgentMutation({
    scope: `agent.tasks.${id}.artifacts.create`,
    idempotencyKey: mutation.idempotencyKey,
    hash: mutation.hash,
    statusCode: 201,
    body: artifact,
  });

  return NextResponse.json(artifact, { status: 201 });
}
