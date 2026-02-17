import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  if (!token || token.trim().length === 0) return null;
  return token.trim();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticateAgent(request: Request) {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Missing bearer token" }, { status: 401 }),
    };
  }

  const tokenHash = hashToken(token);

  const credential = await prisma.agentCredential.findFirst({
    where: {
      tokenHash,
      status: "active",
    },
  });

  if (!credential) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Invalid credentials" }, { status: 401 }),
    };
  }

  await prisma.agentCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    ok: true as const,
    credential,
  };
}
