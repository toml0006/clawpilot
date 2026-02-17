import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { requireAgentCredential } from "@/lib/api/agentRequest";

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const auth = await requireAgentCredential(request);
  if (!auth.ok) return auth.response;

  const states = await prisma.workflowState.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(states);
}
