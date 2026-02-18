import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  await ensureSystemSetup();
  const { id } = await context.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      task: {
        select: { id: true, title: true },
      },
      events: {
        orderBy: { ts: "desc" },
        take: 50,
      },
      artifacts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}
