import { NextRequest, NextResponse } from "next/server";
import { dbUnavailable, unauthorized } from "@/lib/api/household-response";
import { requireSession } from "@/lib/api/household-auth";
import { isDatabaseConfigured } from "@/lib/db";
import { householdAuthSchema } from "@/lib/household/auth-body";
import { requireTelegramUser } from "@/lib/household/require-telegram-user";
import { upsertTelegramUser } from "@/lib/household/service";
import { isPaymentsConfigured } from "@/lib/payments/config";
import { getSubscriptionForUser } from "@/lib/payments/subscription";
import { createYookassaCheckout } from "@/lib/payments/yookassa";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const session = requireSession(req);
  if (session) return session.userId;

  try {
    const auth = householdAuthSchema.parse(await req.json());
    const tgUser = requireTelegramUser(auth);
    if (!tgUser) return null;
    const user = await upsertTelegramUser(tgUser);
    return user.id;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();
  if (!isPaymentsConfigured()) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }

  const userId = await resolveUserId(req);
  if (!userId) return unauthorized();

  const sub = await getSubscriptionForUser(userId);
  if (sub.active) {
    return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
  }

  try {
    const { confirmationUrl, paymentId } = await createYookassaCheckout(userId);
    return NextResponse.json({ ok: true, confirmationUrl, paymentId });
  } catch (e) {
    console.error("[payments/yookassa/create]", e);
    const msg = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();

  const session = requireSession(req);
  if (!session) return unauthorized();

  const subscription = await getSubscriptionForUser(session.userId);
  return NextResponse.json({ ok: true, subscription, paymentsConfigured: isPaymentsConfigured() });
}
