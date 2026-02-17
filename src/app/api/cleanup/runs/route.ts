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
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const runs = await prisma.cleanupRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(
    runs.map((run) => ({
      ...run,
      summary: tryParseJson(run.summary),
    }))
  );
}
