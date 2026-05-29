import { NextRequest, NextResponse } from "next/server";
import { dbUnavailable } from "@/lib/api/household-response";
import { isDatabaseConfigured } from "@/lib/db";
import { householdAuthSchema } from "@/lib/household/auth-body";
import { mapHouseholdApiError } from "@/lib/household/api-errors";
import { requireTelegramUser } from "@/lib/household/require-telegram-user";
import { signHouseholdSession } from "@/lib/household/token";
import {
  buildSyncPayload,
  getUserMembership,
  upsertTelegramUser,
} from "@/lib/household/service";
import { getSubscriptionForUser } from "@/lib/payments/subscription";

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return dbUnavailable();

  let auth;
  try {
    auth = householdAuthSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const tgUser = requireTelegramUser(auth);
  if (!tgUser) return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });

  try {
    const user = await upsertTelegramUser(tgUser);
    const subscription = await getSubscriptionForUser(user.id);
    const membership = await getUserMembership(user.id);

    if (!membership) {
      return NextResponse.json({
        ok: true,
        user: { id: user.id, firstName: user.firstName },
        household: null,
        token: null,
        sync: null,
        subscription,
      });
    }

    const token = signHouseholdSession({
      userId: user.id,
      householdId: membership.householdId,
    });

    if (subscription.enforced && !subscription.active) {
      const householdRow = await buildSyncPayload(membership.householdId);
      return NextResponse.json({
        ok: true,
        user: { id: user.id, firstName: user.firstName },
        household: householdRow.household,
        token,
        sync: null,
        subscription,
      });
    }

    const sync = await buildSyncPayload(membership.householdId);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, firstName: user.firstName },
      household: sync.household,
      token,
      sync,
      subscription,
    });
  } catch (e) {
    console.error("[household/bootstrap]", e);
    const { code, status } = mapHouseholdApiError(e);
    return NextResponse.json({ error: code }, { status });
  }
}
