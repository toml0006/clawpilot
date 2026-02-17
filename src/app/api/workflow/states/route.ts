import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { displayStateName, isWorkflowCategory, normalizeStateKey } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const category = request.nextUrl.searchParams.get("category");
  if (category && !isWorkflowCategory(category)) {
    return NextResponse.json(
      { error: "category must be one of backlog|unstarted|started|completed|canceled" },
      { status: 400 }
    );
  }

  const states = await prisma.workflowState.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(states);
}

export async function POST(request: NextRequest) {
  await ensureSystemSetup();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    key,
    name,
    category,
    position,
    color,
    isDefault,
  } = body as Record<string, unknown>;

  if (category === undefined || typeof category !== "string" || !isWorkflowCategory(category)) {
    return NextResponse.json(
      { error: "category is required and must be backlog|unstarted|started|completed|canceled" },
      { status: 400 }
    );
  }

  const normalizedKey =
    typeof key === "string" && key.trim().length > 0
      ? normalizeStateKey(key)
      : typeof name === "string" && name.trim().length > 0
        ? normalizeStateKey(name)
        : "";

  if (!normalizedKey) {
    return NextResponse.json({ error: "key or name is required" }, { status: 400 });
  }

  const finalName =
    typeof name === "string" && name.trim().length > 0 ? name.trim() : displayStateName(normalizedKey);

  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    return NextResponse.json({ error: "position must be an integer >= 0" }, { status: 400 });
  }

  if (color !== undefined && (typeof color !== "string" || color.trim().length === 0)) {
    return NextResponse.json({ error: "color must be a non-empty string when provided" }, { status: 400 });
  }

  const state = await prisma.workflowState.create({
    data: {
      key: normalizedKey,
      name: finalName,
      category,
      position,
      color: typeof color === "string" ? color : "#64748b",
      isDefault: Boolean(isDefault),
    },
  });

  if (state.isDefault) {
    await prisma.workflowState.updateMany({
      where: { id: { not: state.id } },
      data: { isDefault: false },
    });
  }

  await writeAuditLog({
    actorType: "human",
    action: "workflow_state.create",
    entityType: "workflow_state",
    entityId: state.id,
    after: state,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json(state, { status: 201 });
}
