import { NextResponse } from "next/server";
import { ensureSystemSetup } from "@/lib/bootstrap";
import { openclaw } from "@/lib/openclaw";

export async function GET() {
  await ensureSystemSetup();

  const result = await openclaw.healthCheck();

  return NextResponse.json({
    status: result.ok ? "connected" : "disconnected",
    error: result.error,
  });
}
