import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  await ensureSystemSetup();

  const [retention, rules] = await Promise.all([
    prisma.retentionPolicy.findUnique({ where: { id: "singleton" } }),
    prisma.agentPolicyRule.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);

  return NextResponse.json({
    retention,
    rules,
  });
}

export async function PATCH(request: NextRequest) {
  await ensureSystemSetup();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { retention, rules } = body as Record<string, unknown>;

  const previousRetention = await prisma.retentionPolicy.findUnique({ where: { id: "singleton" } });
  const previousRules = await prisma.agentPolicyRule.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  if (!previousRetention) {
    return NextResponse.json({ error: "Retention policy missing" }, { status: 500 });
  }

  const updates: Promise<unknown>[] = [];

  if (retention && typeof retention === "object" && !Array.isArray(retention)) {
    const ret = retention as Record<string, unknown>;
    const data: {
      archiveAfterDays?: number;
      purgeEventsAfterDays?: number;
      retainTasksForever?: boolean;
    } = {};

    if (ret.archiveAfterDays !== undefined) {
      if (
        typeof ret.archiveAfterDays !== "number" ||
        !Number.isInteger(ret.archiveAfterDays) ||
        ret.archiveAfterDays < 0
      ) {
        return NextResponse.json({ error: "archiveAfterDays must be an integer >= 0" }, { status: 400 });
      }
      data.archiveAfterDays = ret.archiveAfterDays;
    }

    if (ret.purgeEventsAfterDays !== undefined) {
      if (
        typeof ret.purgeEventsAfterDays !== "number" ||
        !Number.isInteger(ret.purgeEventsAfterDays) ||
        ret.purgeEventsAfterDays < 0
      ) {
        return NextResponse.json(
          { error: "purgeEventsAfterDays must be an integer >= 0" },
          { status: 400 }
        );
      }
      data.purgeEventsAfterDays = ret.purgeEventsAfterDays;
    }

    if (ret.retainTasksForever !== undefined) {
      data.retainTasksForever = Boolean(ret.retainTasksForever);
    }

    updates.push(
      prisma.retentionPolicy.update({
        where: { id: "singleton" },
        data,
      })
    );
  }

  if (Array.isArray(rules)) {
    for (const entry of rules) {
      if (!entry || typeof entry !== "object") continue;
      const rule = entry as Record<string, unknown>;
      if (typeof rule.id !== "string") continue;

      const data: {
        effect?: string;
        enabled?: boolean;
        position?: number;
        constraints?: string | null;
      } = {};

      if (rule.effect !== undefined) {
        if (
          typeof rule.effect !== "string" ||
          !["allow", "deny", "require_approval"].includes(rule.effect)
        ) {
          return NextResponse.json(
            { error: "rule effect must be allow|deny|require_approval" },
            { status: 400 }
          );
        }
        data.effect = rule.effect;
      }

      if (rule.enabled !== undefined) {
        data.enabled = Boolean(rule.enabled);
      }

      if (rule.position !== undefined) {
        if (typeof rule.position !== "number" || !Number.isInteger(rule.position) || rule.position < 0) {
          return NextResponse.json({ error: "rule position must be integer >= 0" }, { status: 400 });
        }
        data.position = rule.position;
      }

      if (rule.constraints !== undefined) {
        if (rule.constraints === null) {
          data.constraints = null;
        } else {
          data.constraints = JSON.stringify(rule.constraints);
        }
      }

      updates.push(
        prisma.agentPolicyRule.update({
          where: { id: rule.id },
          data,
        })
      );
    }
  }

  await Promise.all(updates);

  const [nextRetention, nextRules] = await Promise.all([
    prisma.retentionPolicy.findUnique({ where: { id: "singleton" } }),
    prisma.agentPolicyRule.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
  ]);

  await writeAuditLog({
    actorType: "human",
    action: "policy.update",
    entityType: "policy",
    entityId: "singleton",
    before: { retention: previousRetention, rules: previousRules },
    after: { retention: nextRetention, rules: nextRules },
    requestId: request.headers.get("x-clawpilot-request-id"),
  });

  return NextResponse.json({
    retention: nextRetention,
    rules: nextRules,
  });
}
