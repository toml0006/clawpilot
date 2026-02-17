import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { normalizeProjectKey } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true";

  const projects = await prisma.project.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(projects);
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
    color,
    position,
  } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const normalizedKey =
    typeof key === "string" && key.trim().length > 0
      ? normalizeProjectKey(key)
      : normalizeProjectKey(name);

  if (!normalizedKey) {
    return NextResponse.json({ error: "Unable to derive project key" }, { status: 400 });
  }

  if (color !== undefined && (typeof color !== "string" || color.trim().length === 0)) {
    return NextResponse.json({ error: "color must be a non-empty string" }, { status: 400 });
  }

  if (
    position !== undefined &&
    (typeof position !== "number" || !Number.isInteger(position) || position < 0)
  ) {
    return NextResponse.json({ error: "position must be an integer >= 0" }, { status: 400 });
  }

  try {
    const project = await prisma.project.create({
      data: {
        key: normalizedKey.slice(0, 48),
        name: name.trim(),
        color: typeof color === "string" ? color.trim() : "#4f46e5",
        position: typeof position === "number" ? position : 999,
      },
    });

    await writeAuditLog({
      actorType: "human",
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      after: project,
      requestId: request.headers.get("x-clawpilot-request-id"),
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create project";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "Project key already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
