import { NextRequest, NextResponse } from "next/server";
import { dbUnavailable } from "@/lib/api/household-response";
import { isDatabaseConfigured } from "@/lib/db";
import { mapHouseholdApiError } from "@/lib/household/api-errors";
import { wipeAllCloudData } from "@/lib/household/wipe-cloud";
import { isAdminAuthorized, requireAdminSecrets } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** POST with header: Authorization: Bearer <HOUSEHOLD_SESSION_SECRET or CLOUD_WIPE_SECRET> */
export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();

  if (!requireAdminSecrets()) {
    return NextResponse.json({ error: "wipe_not_configured" }, { status: 503 });
  }

  if (!isAdminAuthorized(req)) {
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
