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
import { applyHouseholdSync } from "@/lib/cloud/apply-sync";
import {
  apiDeleteGarage,
  apiPatchBalanceOffset,
  apiPutGarage,
  apiSync,
} from "@/lib/cloud/client";
import type { Vehicle, VehicleGaragePrefs } from "@/types/vehicle";
import { isSubscriptionSyncError } from "@/lib/cloud/sync-errors";
import { decodeUserIdFromHouseholdToken } from "@/lib/cloud/viewer-identity";
import { useCloudStore } from "@/store/useCloudStore";
import type { BudgetOwner, CategoryDefinition, Transaction, TxType } from "@/types";

function noteCloudWriteError(message: string): void {
  useCloudStore.getState().setLastWriteError(message);
}

function token(): string | null {
  const { token: t, household } = useCloudStore.getState();
  return t && household ? t : null;
}

export function isCloudSyncActive(): boolean {
  return Boolean(token());
}

async function pullCloudAfterWrite(): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    const res = await apiSync(t);
    applyHouseholdSync(res.sync, t);
    useCloudStore.getState().touchSync();
  } catch {
    /* retry on next poll */
  }
}

export async function cloudPushTransaction(
  tx: Transaction,
  opts?: { skipPull?: boolean },
): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiCreateTransaction(t, tx);
    useCloudStore.getState().setLastWriteError(null);
    if (!opts?.skipPull) await pullCloudAfterWrite();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync_failed";
    noteCloudWriteError(isSubscriptionSyncError(e) ? "subscription_required" : msg);
    /* локальная операция остаётся; apply-sync дотолкнет localOnly */
  }
}

/** Пара переводов — один pull после обеих записей, чтобы не затереть createdBy партнёра. */
export async function cloudPushPartnerTransferPair(
  expense: Transaction,
  income: Transaction,
): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiCreateTransaction(t, expense);
    await apiCreateTransaction(t, income);
    await pullCloudAfterWrite();
  } catch {
    /* offline */
  }
}

export async function cloudPushTransactionUpdate(
  id: string,
  patch: Partial<
    Pick<
      Transaction,
      | "amount"
      | "categoryId"
      | "owner"
      | "createdBy"
      | "type"
      | "goalId"
      | "goalAmount"
      | "odometerKm"
      | "vehicleId"
      | "note"
    >
  >,
): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiUpdateTransaction(t, id, patch);
    await pullCloudAfterWrite();
  } catch {
    /* ignore */
  }
}

export async function cloudPushTransactionDelete(id: string): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    await apiDeleteTransaction(t, id);
    useCloudStore.getState().removeFromLastSyncedRemoteTxIds(id);
    useCloudStore.getState().setLastWriteError(null);
    await pullCloudAfterWrite();
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
    await pullCloudAfterWrite();
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
    await pullCloudAfterWrite();
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

export async function cloudPushGarage(
  vehicles: Vehicle[],
  vehiclePrefs: VehicleGaragePrefs,
): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    const res = await apiPutGarage(t, vehicles, vehiclePrefs);
    applyHouseholdSync(res.sync, t);
    useCloudStore.getState().touchSync();
  } catch {
    /* offline */
  }
}

export async function cloudDeleteGarage(): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    const res = await apiDeleteGarage(t);
    applyHouseholdSync(res.sync, t);
    useCloudStore.getState().touchSync();
  } catch {
    /* offline */
  }
}

/** Синхронизация «реально в кармане» с партнёром (по userId в облаке). */
export async function cloudPushBalanceOffset(
  owner: BudgetOwner,
  offset: number,
): Promise<void> {
  const t = token();
  if (!t) return;
  const cloud = useCloudStore.getState();
  const viewerId = decodeUserIdFromHouseholdToken(t) ?? cloud.cloudUserId;
  if (!viewerId) return;
  const partnerId = cloud.householdMemberUserIds.find((id) => id !== viewerId);
  const targetUserId = owner === "me" ? viewerId : partnerId;
  if (!targetUserId) return;
  try {
    await apiPatchBalanceOffset(t, targetUserId, offset);
    await pullCloudAfterWrite();
  } catch {
    /* колонка balanceOffsets ещё не в БД — см. prisma/migrate-planning-and-balance.sql */
  }
}

export type { BudgetOwner, TxType };
