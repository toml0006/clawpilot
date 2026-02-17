import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api/agentAuth";
import {
  checkIdempotency,
  getIdempotencyKey,
  requestHash,
  storeIdempotencyResult,
} from "@/lib/api/idempotency";
import { evaluateAgentPolicy, queueApprovalRequest } from "@/lib/policy/agentPolicy";

type MutationCheckResult =
  | {
      ok: true;
      idempotencyKey: string;
      hash: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAgentCredential(request: Request) {
  const auth = await authenticateAgent(request);
  if (!auth.ok) {
    return {
      ok: false as const,
      response: auth.response,
    };
  }

  return {
    ok: true as const,
    credential: auth.credential,
  };
}

export async function ensureAgentMutation(
  request: Request,
  scope: string,
  payload: unknown
): Promise<MutationCheckResult> {
  const key = getIdempotencyKey(request);
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Idempotency-Key header is required" }, { status: 400 }),
    };
  }

  const hash = requestHash(payload);
  const check = await checkIdempotency({ scope, key, hash });

  if (check.type === "conflict") {
    return {
      ok: false,
      response: check.response,
    };
  }

  if (check.type === "replay") {
    return {
      ok: false,
      response: check.response,
    };
  }

  return {
    ok: true,
    idempotencyKey: key,
    hash,
  };
}

export async function finalizeAgentMutation(input: {
  scope: string;
  idempotencyKey: string;
  hash: string;
  statusCode: number;
  body: unknown;
}) {
  await storeIdempotencyResult({
    scope: input.scope,
    key: input.idempotencyKey,
    hash: input.hash,
    statusCode: input.statusCode,
    responseBody: input.body,
  });
}

export async function evaluateOrQueueAgentAction(input: {
  action: string;
  context?: Record<string, unknown>;
  taskId?: string | null;
  payload: unknown;
  credentialId: string;
}) {
  const decision = await evaluateAgentPolicy(input.action, input.context ?? {});

  if (decision.effect === "deny") {
    return {
      type: "deny" as const,
      response: NextResponse.json(
        {
          error: "Forbidden by policy",
          policyRuleId: decision.ruleId,
          policyRuleName: decision.ruleName,
        },
        { status: 403 }
      ),
    };
  }

  if (decision.effect === "require_approval") {
    const request = await queueApprovalRequest({
      taskId: input.taskId ?? null,
      credentialId: input.credentialId,
      action: input.action,
      payload: input.payload,
    });

    return {
      type: "approval" as const,
      request,
      response: NextResponse.json(
        {
          status: "pending_approval",
          actionRequestId: request.id,
          policyRuleId: decision.ruleId,
          policyRuleName: decision.ruleName,
        },
        { status: 202 }
      ),
    };
  }

  return {
    type: "allow" as const,
    decision,
  };
}
