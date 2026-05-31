import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbUnavailable } from "@/lib/api/household-response";
import { isDatabaseConfigured } from "@/lib/db";
import { listPromoCodes, upsertPromoCode } from "@/lib/payments/promo";

export const dynamic = "force-dynamic";

function adminSecret(): string | undefined {
  return (
    process.env.CLOUD_WIPE_SECRET?.trim() ||
    process.env.HOUSEHOLD_SESSION_SECRET?.trim() ||
    process.env.RATE_LIMIT_SECRET?.trim()
  );
}

function checkAdmin(req: NextRequest): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return Boolean(token && token === secret);
}

const createSchema = z.object({
  code: z.string().min(2).max(64),
  bonusDays: z.number().int().positive(),
  label: z.string().max(120).optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
});

/** GET — list promo codes. POST — create/update. Authorization: Bearer <secret> */
export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const promos = await listPromoCodes();
    return NextResponse.json({ ok: true, promos });
  } catch (e) {
    console.error("[admin/promo GET]", e);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const promo = await upsertPromoCode({
      code: body.code,
      bonusDays: body.bonusDays,
      label: body.label,
      maxUses: body.maxUses ?? null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      active: body.active,
    });
    return NextResponse.json({ ok: true, promo });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    console.error("[admin/promo POST]", e);
    const msg = e instanceof Error ? e.message : "create_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
