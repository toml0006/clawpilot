import { prisma } from "@/lib/prisma";

export type PolicyEffect = "allow" | "deny" | "require_approval";

export type PolicyDecision = {
  effect: PolicyEffect;
  ruleId: string | null;
  ruleName: string | null;
};

function parseConstraints(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function matchesConstraints(
  rawConstraints: string | null,
  context: Record<string, unknown>
): boolean {
  const constraints = parseConstraints(rawConstraints);
  if (!constraints) return true;

  for (const [key, expected] of Object.entries(constraints)) {
    if (context[key] !== expected) {
      return false;
    }
  }

  return true;
}

export async function evaluateAgentPolicy(
  action: string,
  context: Record<string, unknown> = {}
): Promise<PolicyDecision> {
  const rules = await prisma.agentPolicyRule.findMany({
    where: { enabled: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  for (const rule of rules) {
    const matchesAction = rule.action === action || rule.action === "*";
    if (!matchesAction) continue;
    if (!matchesConstraints(rule.constraints, context)) continue;

    const effect =
      rule.effect === "allow" || rule.effect === "require_approval"
        ? rule.effect
        : "deny";

    return {
      effect,
      ruleId: rule.id,
      ruleName: rule.name,
    };
  }

  return {
    effect: "deny",
    ruleId: null,
    ruleName: null,
  };
}

export async function queueApprovalRequest(input: {
  taskId?: string | null;
  credentialId?: string | null;
  action: string;
  payload: unknown;
}) {
  return prisma.agentActionRequest.create({
    data: {
      taskId: input.taskId ?? null,
      credentialId: input.credentialId ?? null,
      action: input.action,
      payload: JSON.stringify(input.payload),
      status: "pending",
    },
  });
}
