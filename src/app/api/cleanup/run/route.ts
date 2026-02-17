import { NextRequest, NextResponse } from "next/server";
import { runCleanup } from "@/lib/cleanup/cleanupService";

export async function POST(request: NextRequest) {
  const dryRunRaw = request.nextUrl.searchParams.get("dryRun");
  const dryRun = dryRunRaw !== "false";

  try {
    const result = await runCleanup(dryRun);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
