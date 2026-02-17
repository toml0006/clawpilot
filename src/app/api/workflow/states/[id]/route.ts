import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { isWorkflowCategory, normalizeStateKey } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  const existing = await prisma.workflowState.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Workflow state not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, name, category, position, color, isDefault } = body as Record<string, unknown>;

  if (category !== undefined && (typeof category !== "string" || !isWorkflowCategory(category))) {
    return NextResponse.json(
      { error: "category must be backlog|unstarted|started|completed|canceled" },
      { status: 400 }
    );
  }

  if (position !== undefined && (typeof position !== "number" || !Number.isInteger(position) || position < 0)) {
    return NextResponse.json(
      { error: "position must be an integer >= 0" },
      { status: 400 }
    );
  }

  if (color !== undefined && (typeof color !== "string" || color.trim().length === 0)) {
    return NextResponse.json({ error: "color must be a non-empty string" }, { status: 400 });
  }

  const data: {
    key?: string;
    name?: string;
    category?: string;
    position?: number;
    color?: string;
    isDefault?: boolean;
  } = {};

  if (key !== undefined) {
    if (typeof key !== "string" || key.trim().length === 0) {
      return NextResponse.json({ error: "key must be a non-empty string" }, { status: 400 });
    }
    data.key = normalizeStateKey(key);
  }

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    data.name = name.trim();
  }

  if (category !== undefined) data.category = category;
  if (position !== undefined) data.position = position;
  if (color !== undefined) data.color = color.trim();
  if (isDefault !== undefined) data.isDefault = Boolean(isDefault);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
  }

  const updated = await prisma.workflowState.update({
    where: { id },
    data,
  });

  if (updated.isDefault) {
    await prisma.workflowState.updateMany({
      where: { id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  await writeAuditLog({
    actorType: "human",
    action: "workflow_state.update",
    entityType: "workflow_state",
    entityId: id,
    before: existing,
    after: updated,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json(updated);
}
