import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { mapTaskResponse } from "@/lib/workflow";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSystemSetup();
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { workflowState: true, project: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.archivedAt) {
    return NextResponse.json({ error: "Task is already archived" }, { status: 409 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      revision: { increment: 1 },
    },
    include: { workflowState: true, project: true },
  });

  await writeAuditLog({
    actorType: "human",
    action: "task.archive",
    entityType: "task",
    entityId: id,
    before: mapTaskResponse(task),
    after: mapTaskResponse(updated),
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json(mapTaskResponse(updated));
}
