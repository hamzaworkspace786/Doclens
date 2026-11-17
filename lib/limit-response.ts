import { NextResponse } from "next/server";
import type { UsageResult } from "@/lib/usage";

/** The 429 answer for a request that went over a fair-use limit. */
export function limitResponse(result: Extract<UsageResult, { ok: false }>) {
  return NextResponse.json(
    { error: result.message },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
