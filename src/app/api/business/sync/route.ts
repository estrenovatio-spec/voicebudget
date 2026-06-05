import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  dbUnavailable,
  forbidden,
  mapCloudGuardError,
  unauthorized,
} from "@/lib/api/household-response";
import { requireSession } from "@/lib/api/household-auth";
import {
  fetchUserBusinessPayload,
  mergeBusinessPayload,
  saveUserBusinessPayload,
} from "@/lib/business/db";
import type { BusinessCloudPayload } from "@/lib/business/types";
import { isDatabaseConfigured } from "@/lib/db";
import { assertActiveSubscription } from "@/lib/payments/subscription";

const payloadSchema = z.object({
  version: z.literal(2),
  units: z.array(z.any()),
  transactions: z.array(z.any()),
  assets: z.array(z.any()),
  passiveReceipts: z.array(z.any()).optional(),
  taxRatePct: z.number().min(0).max(100).optional(),
});

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();
  const session = requireSession(req);
  if (!session) return unauthorized();

  try {
    await assertActiveSubscription(session.userId);
    const business = await fetchUserBusinessPayload(session.userId);
    return NextResponse.json({ ok: true, business });
  } catch (e) {
    const guard = mapCloudGuardError(e);
    if (guard) return guard;
    console.error("[business/sync GET]", e);
    return NextResponse.json({ ok: true, business: null });
  }
}

export async function PUT(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();
  const session = requireSession(req);
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    await assertActiveSubscription(session.userId);
    const incoming = parsed.data as BusinessCloudPayload;
    const existing = await fetchUserBusinessPayload(session.userId);
    let toSave = incoming;
    if (existing) {
      toSave = mergeBusinessPayload(incoming, existing);
      if (incoming.assets.length === 0 && existing.assets.length > 0) {
        toSave.assets = existing.assets;
      }
      if (
        (incoming.passiveReceipts?.length ?? 0) === 0 &&
        (existing.passiveReceipts?.length ?? 0) > 0
      ) {
        toSave.passiveReceipts = existing.passiveReceipts;
      }
    }
    const saved = await saveUserBusinessPayload(session.userId, toSave);
    return NextResponse.json({
      ok: true,
      cloudSaved: saved,
      ...(saved ? {} : { reason: "business_cloud_table_missing" }),
    });
  } catch (e) {
    const guard = mapCloudGuardError(e);
    if (guard) return guard;
    console.error("[business/sync PUT]", e);
    return forbidden();
  }
}
