import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { requireAgentCredential } from "@/lib/api/agentRequest";

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function GET(request: NextRequest) {
  await ensureSystemSetup();

  const hasAuthHeader = Boolean(request.headers.get("authorization"));
  const auth = await requireAgentCredential(request);
  if (!auth.ok && hasAuthHeader) return auth.response;

  const includeAll = request.nextUrl.searchParams.get("all") === "true";

  const actions = await prisma.agentActionRequest.findMany({
    where: {
      status: "pending",
      ...(includeAll || !auth.ok ? {} : { credentialId: auth.credential.id }),
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json(
    actions.map((action) => ({
      ...action,
      payload: tryParseJson(action.payload),
    }))
  );
}
