import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  await ensureSystemSetup();

  const labels = await prisma.label.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(labels);
}

export async function POST(request: NextRequest) {
  await ensureSystemSetup();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, name, color, position } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const normalizedKey =
    typeof key === "string" && key.trim().length > 0
      ? normalizeKey(key)
      : normalizeKey(name);

  if (!normalizedKey) {
    return NextResponse.json({ error: "Unable to derive label key" }, { status: 400 });
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
    const label = await prisma.label.create({
      data: {
        key: normalizedKey.slice(0, 48),
        name: name.trim(),
        color: typeof color === "string" ? color.trim() : "#6b7280",
        position: typeof position === "number" ? position : 999,
      },
    });

    await writeAuditLog({
      actorType: "human",
      action: "label.create",
      entityType: "label",
      entityId: label.id,
      after: label,
      requestId: request.headers.get("x-clawpilot-request-id"),
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create label";
    if (message.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "Label key already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
