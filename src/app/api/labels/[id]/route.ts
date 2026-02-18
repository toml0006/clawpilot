import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id } = await context.params;

  const label = await prisma.label.findUnique({
    where: { id },
    include: {
      tasks: {
        include: { task: { select: { id: true, title: true } } },
      },
    },
  });

  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...label,
    tasks: label.tasks.map((tl) => tl.task),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id } = await context.params;

  const label = await prisma.label.findUnique({ where: { id } });
  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, color, position } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    data.name = name.trim();
  }

  if (color !== undefined) {
    if (typeof color !== "string" || color.trim().length === 0) {
      return NextResponse.json({ error: "color must be a non-empty string" }, { status: 400 });
    }
    data.color = color.trim();
  }

  if (position !== undefined) {
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
      return NextResponse.json({ error: "position must be an integer >= 0" }, { status: 400 });
    }
    data.position = position;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(label);
  }

  const updated = await prisma.label.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorType: "human",
    action: "label.update",
    entityType: "label",
    entityId: id,
    before: label,
    after: updated,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id } = await context.params;

  const label = await prisma.label.findUnique({ where: { id } });
  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  await prisma.label.delete({ where: { id } });

  await writeAuditLog({
    actorType: "human",
    action: "label.delete",
    entityType: "label",
    entityId: id,
    before: label,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return new NextResponse(null, { status: 204 });
}
