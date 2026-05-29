import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  subscriptionAmountRub,
  yookassaCredentials,
  yookassaReturnUrl,
} from "@/lib/payments/config";
import { activateSubscription } from "@/lib/payments/subscription";
import type { YookassaNotification, YookassaPaymentObject } from "@/lib/payments/types";

const API_BASE = "https://api.yookassa.ru/v3";

function basicAuth(): string {
  const creds = yookassaCredentials();
  if (!creds) throw new Error("yookassa_not_configured");
  return Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString("base64");
}

async function yookassaFetch<T>(
  path: string,
  init?: RequestInit & { idempotenceKey?: string },
): Promise<T> {
  const { idempotenceKey, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    Authorization: `Basic ${basicAuth()}`,
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (idempotenceKey) headers["Idempotence-Key"] = idempotenceKey;

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  const data = (await res.json()) as T & { description?: string; code?: string };
  if (!res.ok) {
    const msg = (data as { description?: string }).description ?? `yookassa_http_${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function createYookassaCheckout(userId: string): Promise<{
  paymentId: string;
  confirmationUrl: string;
}> {
  const amount = subscriptionAmountRub();
  const returnUrl = yookassaReturnUrl();

  const payment = await yookassaFetch<YookassaPaymentObject>("/payments", {
    method: "POST",
    idempotenceKey: randomUUID(),
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: `VoiceBudget — облако и бот, ${process.env.YOOKASSA_SUBSCRIPTION_DAYS ?? 30} дн.`,
      metadata: { userId },
    }),
  });

  await prisma.payment.create({
    data: {
      userId,
      yookassaPaymentId: payment.id,
      amount,
      currency: "RUB",
      status: payment.status,
    },
  });

  const confirmationUrl = payment.confirmation?.confirmation_url;
  if (!confirmationUrl) throw new Error("yookassa_no_confirmation_url");

  return { paymentId: payment.id, confirmationUrl };
}

export async function fetchYookassaPayment(paymentId: string): Promise<YookassaPaymentObject> {
  return yookassaFetch<YookassaPaymentObject>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function handleYookassaNotification(body: YookassaNotification): Promise<void> {
  if (body.type !== "notification") return;

  const paymentId = body.object?.id;
  if (!paymentId) return;

  const verified = await fetchYookassaPayment(paymentId);
  const userId = verified.metadata?.userId;
  if (!userId) {
    console.warn("[yookassa/webhook] payment without userId metadata", paymentId);
    return;
  }

  const existing = await prisma.payment.findUnique({
    where: { yookassaPaymentId: paymentId },
  });

  if (verified.status === "succeeded" && verified.paid) {
    await prisma.payment.upsert({
      where: { yookassaPaymentId: paymentId },
      create: {
        userId,
        yookassaPaymentId: paymentId,
        amount: Number.parseFloat(verified.amount.value),
        currency: verified.amount.currency,
        status: "succeeded",
        paidAt: verified.captured_at ? new Date(verified.captured_at) : new Date(),
      },
      update: {
        status: "succeeded",
        paidAt: verified.captured_at ? new Date(verified.captured_at) : new Date(),
      },
    });

    if (!existing || existing.status !== "succeeded") {
      await activateSubscription(userId);
    }
    return;
  }

  if (existing) {
    await prisma.payment.update({
      where: { yookassaPaymentId: paymentId },
      data: { status: verified.status },
    });
  }
}
