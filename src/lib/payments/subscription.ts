import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  subscriptionAmountRub,
  subscriptionEnforced,
  subscriptionPeriodDays,
} from "@/lib/payments/config";
import type { SubscriptionPublic } from "@/lib/payments/types";

function toPublic(
  status: SubscriptionStatus | null,
  currentPeriodEnd: Date | null,
): SubscriptionPublic {
  const enforced = subscriptionEnforced();
  const now = new Date();
  const active =
    enforced &&
    status === "active" &&
    currentPeriodEnd !== null &&
    currentPeriodEnd > now;

  return {
    active: enforced ? Boolean(active) : true,
    status: status ?? "none",
    expiresAt: currentPeriodEnd?.toISOString() ?? null,
    enforced,
    priceRub: subscriptionAmountRub(),
    periodDays: subscriptionPeriodDays(),
  };
}

export async function getSubscriptionForUser(userId: string): Promise<SubscriptionPublic> {
  try {
    const row = await prisma.subscription.findUnique({ where: { userId } });
    return toPublic(row?.status ?? null, row?.currentPeriodEnd ?? null);
  } catch {
    return toPublic(null, null);
  }
}

export async function assertActiveSubscription(userId: string): Promise<void> {
  if (!subscriptionEnforced()) return;

  const row = await prisma.subscription.findUnique({ where: { userId } });
  const now = new Date();
  if (
    !row ||
    row.status !== "active" ||
    !row.currentPeriodEnd ||
    row.currentPeriodEnd <= now
  ) {
    throw new Error("subscription_required");
  }
}

export async function activateSubscription(userId: string): Promise<void> {
  const days = subscriptionPeriodDays();
  const now = new Date();
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  const base =
    existing?.currentPeriodEnd && existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now;
  const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: "active", currentPeriodEnd: newEnd },
    update: { status: "active", currentPeriodEnd: newEnd },
  });
}
