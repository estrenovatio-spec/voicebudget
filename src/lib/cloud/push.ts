import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";
import {
  apiCreateTransaction,
  apiDeleteCategory,
  apiDeleteCategoryBudget,
  apiDeleteGoal,
  apiDeleteRecurring,
  apiDeleteTransaction,
  apiPatchPartnerLabel,
  apiUpdateTransaction,
  apiUpsertCategory,
  apiUpsertCategoryBudget,
  apiUpsertGoal,
  apiUpsertRecurring,
} from "@/lib/cloud/client";
import { useCloudStore } from "@/store/useCloudStore";
import type { BudgetOwner, CategoryDefinition, Transaction, TxType } from "@/types";

function token(): string | null {
  const { token: t, household } = useCloudStore.getState();
  return t && household ? t : null;
}

export function isCloudSyncActive(): boolean {
  return Boolean(token());
}

export async function cloudPushTransaction(tx: Transaction): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiCreateTransaction(t, tx);
  } catch {
    /* offline / retry later via manual sync */
  }
}

export async function cloudPushTransactionUpdate(
  id: string,
  patch: Partial<
    Pick<Transaction, "amount" | "categoryId" | "owner" | "type" | "goalId" | "goalAmount">
  >,
): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiUpdateTransaction(t, id, patch);
  } catch {
    /* ignore */
  }
}

export async function cloudPushTransactionDelete(id: string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiDeleteTransaction(t, id);
  } catch {
    /* ignore */
  }
}

export async function cloudPushPartnerLabel(name: string | null): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiPatchPartnerLabel(t, name);
  } catch {
    /* ignore */
  }
}

export async function cloudPushCategory(cat: CategoryDefinition): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiUpsertCategory(t, cat);
  } catch {
    /* offline / retry on next pull */
  }
}

export async function cloudPushCategoryDelete(id: string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiDeleteCategory(t, id);
  } catch {
    /* ignore */
  }
}

export async function cloudPushGoal(goal: SavingsGoal): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiUpsertGoal(t, goal);
  } catch {
    /* ignore — цель остаётся локально, push повторится как localOnly */
  }
}

export async function cloudPushGoalDelete(id: string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiDeleteGoal(t, id);
  } catch {
    /* ignore */
  }
}

export async function cloudPushCategoryBudget(budget: CategoryBudget): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiUpsertCategoryBudget(t, budget);
  } catch {
    /* ignore */
  }
}

export async function cloudPushCategoryBudgetDelete(categoryId: string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiDeleteCategoryBudget(t, categoryId);
  } catch {
    /* ignore */
  }
}

export async function cloudPushRecurring(item: RecurringTransaction): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiUpsertRecurring(t, item);
  } catch {
    /* ignore */
  }
}

export async function cloudPushRecurringDelete(id: string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiDeleteRecurring(t, id);
  } catch {
    /* ignore */
  }
}

export type { BudgetOwner, TxType };
