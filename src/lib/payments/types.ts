export interface SubscriptionPublic {
  active: boolean;
  status: "active" | "expired" | "canceled" | "none";
  expiresAt: string | null;
  enforced: boolean;
  priceRub: number;
  periodDays: number;
  trialDays: number;
}

export interface YookassaPaymentObject {
  id: string;
  status: string;
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
  created_at?: string;
  captured_at?: string;
}

export interface YookassaNotification {
  type: string;
  event: string;
  object: YookassaPaymentObject;
}
