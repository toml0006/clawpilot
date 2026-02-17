import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function getIdempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key");
  if (!value || value.trim().length === 0) return null;
  return value.trim();
}

export function requestHash(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  return createHash("sha256").update(serialized).digest("hex");
}

export async function checkIdempotency(input: {
  scope: string;
  key: string;
  hash: string;
}) {
  const existing = await prisma.idempotencyRecord.findUnique({
    where: {
      scope_idempotencyKey: {
        scope: input.scope,
        idempotencyKey: input.key,
      },
    },
  });

  if (!existing) {
    return { type: "miss" as const };
  }

  if (existing.requestHash !== input.hash) {
    return {
      type: "conflict" as const,
      response: NextResponse.json(
        { error: "Idempotency key already used with different payload" },
        { status: 409 }
      ),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(existing.responseBody);
  } catch {
    parsed = { raw: existing.responseBody };
  }

  return {
    type: "replay" as const,
    response: NextResponse.json(parsed, {
      status: existing.statusCode,
      headers: {
        "x-idempotent-replay": "true",
      },
    }),
  };
}

export async function storeIdempotencyResult(input: {
  scope: string;
  key: string;
  hash: string;
  statusCode: number;
  responseBody: unknown;
}) {
  await prisma.idempotencyRecord.upsert({
    where: {
      scope_idempotencyKey: {
        scope: input.scope,
        idempotencyKey: input.key,
      },
    },
    create: {
      scope: input.scope,
      idempotencyKey: input.key,
      requestHash: input.hash,
      statusCode: input.statusCode,
      responseBody: JSON.stringify(input.responseBody),
      expiresAt: null,
    },
    update: {
      requestHash: input.hash,
      statusCode: input.statusCode,
      responseBody: JSON.stringify(input.responseBody),
      expiresAt: null,
    },
  });
}
