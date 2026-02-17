import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();

  const { id } = await params;

  const credential = await prisma.agentCredential.findUnique({ where: { id } });
  if (!credential) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  // Soft-delete: set status to revoked
  const updated = await prisma.agentCredential.update({
    where: { id },
    data: { status: "revoked" },
  });

  await writeAuditLog({
    actorType: "human",
    action: "credential.revoke",
    entityType: "agentCredential",
    entityId: id,
    before: { status: credential.status },
    after: { status: updated.status },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({ id, status: "revoked" });
}
