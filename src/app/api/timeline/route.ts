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

  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "250");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 250;

  const taskId = request.nextUrl.searchParams.get("taskId");
  const level = request.nextUrl.searchParams.get("level");

  const events = await prisma.event.findMany({
    where: {
      ...(taskId ? { taskId } : {}),
      ...(level ? { level } : {}),
    },
    include: {
      job: {
        select: {
          id: true,
          status: true,
          taskId: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { ts: "desc" },
    take: limit,
  });

  return NextResponse.json(
    events.map((event) => ({
      ...event,
      data: tryParseJson(event.data),
    }))
  );
}
