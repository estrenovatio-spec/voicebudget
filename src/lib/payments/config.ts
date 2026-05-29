export function isPaymentsConfigured(): boolean {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secret = process.env.YOOKASSA_SECRET_KEY?.trim();
  return Boolean(shopId && secret);
}

/** When false — cloud works without paywall (dev or keys not set yet). */
export function subscriptionEnforced(): boolean {
  if (!isPaymentsConfigured()) return false;
  if (process.env.YOOKASSA_SUBSCRIPTION_DISABLED === "true") return false;
  return true;
}

export function subscriptionAmountRub(): number {
  const raw = process.env.YOOKASSA_SUBSCRIPTION_AMOUNT?.trim();
  const n = raw ? Number.parseFloat(raw) : 299;
  return Number.isFinite(n) && n > 0 ? n : 299;
}

export function subscriptionPeriodDays(): number {
  const raw = process.env.YOOKASSA_SUBSCRIPTION_DAYS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function yookassaReturnUrl(): string {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://voicebudget.vercel.app";
  return `${site}/?payment=done`;
}

export function yookassaCredentials(): { shopId: string; secretKey: string } | null {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim();
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim();
  if (!shopId || !secretKey) return null;
  return { shopId, secretKey };
}
