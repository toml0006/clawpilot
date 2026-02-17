import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  await ensureSystemSetup();

  const [app, credentials, projects] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.agentCredential.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
      },
    }),
    prisma.project.findMany({
      where: { archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true, key: true },
    }),
  ]);

  return NextResponse.json({ app, credentials, projects });
}

const ALLOWED_FIELDS: Record<string, "string" | "number" | "boolean"> = {
  instanceName: "string",
  defaultProjectId: "string",
  boardDensity: "string",
  openclawGatewayUrl: "string",
  openclawApiTimeout: "number",
  agentAutoApprove: "boolean",
  agentMaxConcurrentJobs: "number",
};

export async function PATCH(request: NextRequest) {
  await ensureSystemSetup();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { app } = body as Record<string, unknown>;

  if (!app || typeof app !== "object" || Array.isArray(app)) {
    return NextResponse.json({ error: "Missing app object" }, { status: 400 });
  }

  const previous = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!previous) {
    return NextResponse.json({ error: "Settings not initialized" }, { status: 500 });
  }

  const data: Record<string, string | number | boolean | null> = {};
  const input = app as Record<string, unknown>;

  for (const [key, value] of Object.entries(input)) {
    if (!(key in ALLOWED_FIELDS)) continue;

    // Allow null for nullable fields
    if (value === null && key === "defaultProjectId") {
      data[key] = null;
      continue;
    }

    const expected = ALLOWED_FIELDS[key];
    if (typeof value !== expected) {
      return NextResponse.json(
        { error: `${key} must be a ${expected}` },
        { status: 400 }
      );
    }

    // Extra validation
    if (key === "boardDensity" && !["default", "compact"].includes(value as string)) {
      return NextResponse.json(
        { error: "boardDensity must be 'default' or 'compact'" },
        { status: 400 }
      );
    }
    if (key === "openclawApiTimeout") {
      const n = value as number;
      if (!Number.isInteger(n) || n < 1000 || n > 300000) {
        return NextResponse.json(
          { error: "openclawApiTimeout must be an integer between 1000 and 300000" },
          { status: 400 }
        );
      }
    }
    if (key === "agentMaxConcurrentJobs") {
      const n = value as number;
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        return NextResponse.json(
          { error: "agentMaxConcurrentJobs must be an integer between 1 and 20" },
          { status: 400 }
        );
      }
    }

    data[key] = value as string | number | boolean;
  }

  const updated = await prisma.appSettings.update({
    where: { id: "singleton" },
    data,
  });

  await writeAuditLog({
    actorType: "human",
    action: "settings.update",
    entityType: "appSettings",
    entityId: "singleton",
    before: previous,
    after: updated,
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ app: updated });
}
