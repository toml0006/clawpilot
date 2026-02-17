import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { normalizeProjectKey } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();
  const { id } = await params;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    key,
    name,
    color,
    position,
    archived,
  } = body as Record<string, unknown>;

  const data: {
    key?: string;
    name?: string;
    color?: string;
    position?: number;
    archivedAt?: Date | null;
  } = {};

  if (key !== undefined) {
    if (typeof key !== "string" || key.trim().length === 0) {
      return NextResponse.json({ error: "key must be non-empty string" }, { status: 400 });
    }
    data.key = normalizeProjectKey(key).slice(0, 48);
  }

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name must be non-empty string" }, { status: 400 });
    }
    data.name = name.trim();
  }

  if (color !== undefined) {
    if (typeof color !== "string" || color.trim().length === 0) {
      return NextResponse.json({ error: "color must be non-empty string" }, { status: 400 });
    }
    data.color = color.trim();
  }

  if (position !== undefined) {
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
      return NextResponse.json({ error: "position must be integer >= 0" }, { status: 400 });
    }
    data.position = position;
  }

  if (archived !== undefined) {
    data.archivedAt = Boolean(archived) ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
  }

  try {
    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actorType: "human",
      action: "project.update",
      entityType: "project",
      entityId: id,
      before: existing,
      after: updated,
      requestId: request.headers.get("x-clawpilot-request-id"),
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "Project key already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
