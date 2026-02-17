import { prisma } from "@/lib/prisma";

export type AuditInput = {
  actorType: "human" | "agent" | "system";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
  metadata?: unknown;
};

function stringify(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: stringify(input.before),
      after: stringify(input.after),
      requestId: input.requestId ?? null,
      metadata: stringify(input.metadata),
    },
  });
}
