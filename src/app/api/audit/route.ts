import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";

function tryParseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
  const entityType = request.nextUrl.searchParams.get("entityType")?.trim();
  const entityId = request.nextUrl.searchParams.get("entityId")?.trim();
  const action = request.nextUrl.searchParams.get("action")?.trim();

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(
    logs.map((log) => ({
      ...log,
      before: tryParseJson(log.before),
      after: tryParseJson(log.after),
      metadata: tryParseJson(log.metadata),
    }))
  );
}
