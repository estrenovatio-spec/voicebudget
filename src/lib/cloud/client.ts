import type { HouseholdPublic, SyncPayload } from "@/lib/household/types";
import type { SubscriptionPublic } from "@/lib/payments/types";
import type { CategoryDefinition, Transaction } from "@/types";
import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";
import { fetchWithRetry } from "@/lib/fetch-retry";

export type CloudApiError =
  | "database_not_configured"
  | "invalid_init_data"
  | "unauthorized"
  | "bad_request"
  | string;

export interface BootstrapResponse {
  ok: boolean;
  configured?: boolean;
  user?: { id: string; firstName: string | null };
  household: HouseholdPublic | null;
  token: string | null;
  sync: SyncPayload | null;
  subscription?: SubscriptionPublic;
}

export interface HouseholdActionResponse {
  ok: boolean;
  household: HouseholdPublic;
  token: string;
  sync: SyncPayload;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetchWithRetry(url, init);
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `http_${res.status}`);
  }
  return data;
}

export type CloudAuthBody = {
  initData?: string;
  telegramLogin?: Record<string, string | number>;
};

export async function apiBootstrap(auth: CloudAuthBody): Promise<BootstrapResponse> {
  const res = await apiFetch("/api/household/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(auth),
  });
  if (res.status === 503) {
    return { ok: false, configured: false, household: null, token: null, sync: null };
  }
  return parseJson(res);
}

export async function apiCreateHousehold(
  body: CloudAuthBody & {
    name?: string;
    mode?: "solo" | "shared";
    partnerLabel?: string | null;
  },
): Promise<HouseholdActionResponse> {
  const res = await apiFetch("/api/household/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function apiJoinHousehold(auth: CloudAuthBody, inviteCode: string) {
  const res = await apiFetch("/api/household/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...auth, inviteCode }),
  });
  return parseJson<HouseholdActionResponse>(res);
}

export async function apiLeaveHousehold(token: string) {
  const res = await apiFetch("/api/household/leave", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<{ ok: boolean }>(res);
}

export async function apiSync(token: string) {
  const res = await apiFetch("/api/household/sync", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<{ ok: boolean; sync: SyncPayload }>(res);
}

export async function apiImportLocal(
  token: string,
  data: { transactions: Transaction[]; categories: CategoryDefinition[] },
) {
  const res = await apiFetch("/api/household/import", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return parseJson<{ ok: boolean; sync: SyncPayload }>(res);
}

export async function apiPatchPartnerLabel(token: string, partnerLabel: string | null) {
  const res = await apiFetch("/api/household/partner-label", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ partnerLabel }),
  });
  return parseJson<{ ok: boolean; sync: SyncPayload }>(res);
}

export async function apiCreateTransaction(token: string, tx: Transaction) {
  const res = await apiFetch("/api/household/transactions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tx),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiUpdateTransaction(
  token: string,
  id: string,
  patch: Partial<
    Pick<Transaction, "amount" | "categoryId" | "owner" | "type" | "goalId" | "goalAmount">
  >,
) {
  const res = await apiFetch(`/api/household/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiDeleteTransaction(token: string, id: string) {
  const res = await apiFetch(`/api/household/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiUpsertCategory(token: string, cat: CategoryDefinition) {
  const res = await apiFetch("/api/household/categories", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cat),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiDeleteCategory(token: string, id: string) {
  const res = await apiFetch(`/api/household/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiUpsertGoal(token: string, goal: SavingsGoal) {
  const res = await apiFetch("/api/household/goals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(goal),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiDeleteGoal(token: string, id: string) {
  const res = await apiFetch(`/api/household/goals/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiUpsertCategoryBudget(token: string, budget: CategoryBudget) {
  const res = await apiFetch("/api/household/category-budgets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(budget),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiDeleteCategoryBudget(token: string, categoryId: string) {
  const res = await apiFetch(
    `/api/household/category-budgets/${encodeURIComponent(categoryId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiUpsertRecurring(token: string, item: RecurringTransaction) {
  const res = await apiFetch("/api/household/recurring", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiDeleteRecurring(token: string, id: string) {
  const res = await apiFetch(`/api/household/recurring/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `http_${res.status}`);
  }
}

export async function apiCreateYookassaCheckout(token: string) {
  const res = await apiFetch("/api/payments/yookassa/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<{ ok: boolean; confirmationUrl: string; paymentId: string }>(res);
}

export async function apiSubscriptionStatus(token: string) {
  const res = await apiFetch("/api/payments/yookassa/create", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<{ ok: boolean; subscription: SubscriptionPublic; paymentsConfigured: boolean }>(
    res,
  );
}

export async function apiRedeemPromoCode(token: string, code: string) {
  const res = await apiFetch("/api/payments/promo/redeem", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
  return parseJson<{
    ok: boolean;
    bonusDays: number;
    expiresAt: string;
    label: string | null;
    subscription: SubscriptionPublic;
  }>(res);
}
