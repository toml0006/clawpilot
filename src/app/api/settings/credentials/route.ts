import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  await ensureSystemSetup();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const tokenRaw = randomBytes(32).toString("hex");
  const token = `cp_${tokenRaw}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const credential = await prisma.agentCredential.create({
    data: {
      name: name.trim(),
      tokenHash,
      scopes: JSON.stringify(["*"]),
      status: "active",
    },
  });

  await writeAuditLog({
    actorType: "human",
    action: "credential.create",
    entityType: "agentCredential",
    entityId: credential.id,
    after: { id: credential.id, name: credential.name },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({
    id: credential.id,
    name: credential.name,
    token,
    createdAt: credential.createdAt,
  });
}
