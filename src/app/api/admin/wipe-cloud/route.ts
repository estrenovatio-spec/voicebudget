import { NextRequest, NextResponse } from "next/server";
import { dbUnavailable } from "@/lib/api/household-response";
import { isDatabaseConfigured } from "@/lib/db";
import { mapHouseholdApiError } from "@/lib/household/api-errors";
import { wipeAllCloudData } from "@/lib/household/wipe-cloud";

export const dynamic = "force-dynamic";

function adminSecret(): string | undefined {
  return (
    process.env.CLOUD_WIPE_SECRET?.trim() ||
    process.env.HOUSEHOLD_SESSION_SECRET?.trim() ||
    process.env.RATE_LIMIT_SECRET?.trim()
  );
}

/** POST with header: Authorization: Bearer <HOUSEHOLD_SESSION_SECRET or CLOUD_WIPE_SECRET> */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();

  const secret = adminSecret();
  if (!secret) {
    return NextResponse.json({ error: "wipe_not_configured" }, { status: 503 });
  }

  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const wiped = await wipeAllCloudData();
    return NextResponse.json({ ok: true, wiped });
  } catch (e) {
    console.error("[admin/wipe-cloud]", e);
    const { code, status } = mapHouseholdApiError(e);
    return NextResponse.json({ error: code }, { status });
  }
}
