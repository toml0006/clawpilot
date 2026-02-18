import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

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

  return NextResponse.json(task.labels.map((tl) => tl.label));
}

export async function POST(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { labelId, labelKey } = body as Record<string, unknown>;

  let label;
  if (typeof labelId === "string") {
    label = await prisma.label.findUnique({ where: { id: labelId } });
  } else if (typeof labelKey === "string") {
    label = await prisma.label.findUnique({ where: { key: labelKey } });
  }

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  // Check if already attached
  const existing = await prisma.taskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });

  if (existing) {
    return NextResponse.json({ error: "Label already attached" }, { status: 409 });
  }

  await prisma.taskLabel.create({
    data: { taskId, labelId: label.id },
  });

  await writeAuditLog({
    actorType: "human",
    action: "task.label.add",
    entityType: "task",
    entityId: taskId,
    after: { labelId: label.id, labelKey: label.key },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  // Return updated labels list
  const labels = await prisma.taskLabel.findMany({
    where: { taskId },
    include: { label: true },
    orderBy: { label: { position: "asc" } },
  });

  return NextResponse.json(labels.map((tl) => tl.label), { status: 201 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id: taskId } = await context.params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { labelId, labelKey } = body as Record<string, unknown>;

  let label;
  if (typeof labelId === "string") {
    label = await prisma.label.findUnique({ where: { id: labelId } });
  } else if (typeof labelKey === "string") {
    label = await prisma.label.findUnique({ where: { key: labelKey } });
  }

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  const existing = await prisma.taskLabel.findUnique({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Label not attached to task" }, { status: 404 });
  }

  await prisma.taskLabel.delete({
    where: { taskId_labelId: { taskId, labelId: label.id } },
  });

  await writeAuditLog({
    actorType: "human",
    action: "task.label.remove",
    entityType: "task",
    entityId: taskId,
    before: { labelId: label.id, labelKey: label.key },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return new NextResponse(null, { status: 204 });
}
