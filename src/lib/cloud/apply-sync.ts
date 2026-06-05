import { parseBalanceOffsets } from "@/lib/balance-offsets";
import { defaultVehicleGaragePrefs, resolveRemoteGarage } from "@/lib/vehicle";
import { applyBalanceOffsetsFromCloud } from "@/lib/cloud/apply-balance-offsets";
import { applyGoalMonthlyToGoal } from "@/lib/planning/analytics";
import { mergeSyncPayload } from "@/lib/cloud/merge-sync";
import {
  cloudPushCategory,
  cloudPushCategoryBudget,
  cloudPushGoal,
  cloudPushRecurring,
  cloudPushTransaction,
} from "@/lib/cloud/push";
import type { SyncPayload } from "@/lib/household/types";
import { ensureCloudViewerUserId } from "@/lib/cloud/viewer-identity";
import { useCloudStore } from "@/store/useCloudStore";
import { useStore } from "@/store/useStore";

function emptyPlanningDefaults(sync: SyncPayload): SyncPayload {
  return {
    ...sync,
    memberUserIds: sync.memberUserIds ?? [],
    savingsGoals: sync.savingsGoals ?? [],
    categoryBudgets: sync.categoryBudgets ?? [],
    recurringTransactions: sync.recurringTransactions ?? [],
  };
}

/** Слияние с локальными данными — обновление приложения не затирает операции */
export function applyHouseholdSync(sync: SyncPayload, token: string) {
  const remote = emptyPlanningDefaults(sync);
  const local = useStore.getState();
  const cloud = useCloudStore.getState();
  const previouslySynced = new Set(cloud.lastSyncedRemoteTxIds);
  const previouslySyncedCategories = new Set(cloud.lastSyncedRemoteCategoryIds);
  const deletedRecurring = new Set(cloud.deletedRecurringIds ?? []);
  const deletedTransactions = new Set(cloud.deletedTransactionIds ?? []);
  const merged = mergeSyncPayload(
    local.transactions,
    local.categories,
    {
      savingsGoals: local.savingsGoals,
      categoryBudgets: local.categoryBudgets,
      recurringTransactions: local.recurringTransactions,
    },
    remote,
    previouslySynced,
    previouslySyncedCategories,
    undefined,
    deletedRecurring,
    deletedTransactions,
  );

  const remoteRecurringIds = new Set((remote.recurringTransactions ?? []).map((r) => r.id));
  const prunedDeletedRecurring = (cloud.deletedRecurringIds ?? []).filter((id) =>
    remoteRecurringIds.has(id),
  );
  if (prunedDeletedRecurring.length !== (cloud.deletedRecurringIds ?? []).length) {
    useCloudStore.getState().setDeletedRecurringIds(prunedDeletedRecurring);
  }

  const remoteTxIds = new Set(remote.transactions.map((t) => t.id));
  for (const tx of local.transactions) {
    if (previouslySynced.has(tx.id) && !remoteTxIds.has(tx.id)) {
      useCloudStore.getState().markTransactionDeleted(tx.id);
    }
  }
  const prunedDeletedTx = (cloud.deletedTransactionIds ?? []).filter((id) =>
    remoteTxIds.has(id),
  );
  if (prunedDeletedTx.length !== (cloud.deletedTransactionIds ?? []).length) {
    useCloudStore.getState().setDeletedTransactionIds(prunedDeletedTx);
  }

  const savingsGoals = merged.savingsGoals.map((g) => applyGoalMonthlyToGoal(g));

  useCloudStore.getState().setSession(token, remote.household);
  ensureCloudViewerUserId(remote.viewerUserId ?? undefined);
  if (remote.memberUserIds.length > 0) {
    useCloudStore.getState().setHouseholdMemberUserIds(remote.memberUserIds);
  }
  const remoteTxIdSet = new Set(remote.transactions.map((t) => t.id));
  useCloudStore.getState().setLastSyncedRemoteTxIds(
    merged.transactions.filter((t) => remoteTxIdSet.has(t.id)).map((t) => t.id),
  );
  useCloudStore.getState().setLastSyncedRemoteCategoryIds(remote.categories.map((c) => c.id));
  // Только id из ответа сервера: иначе локальная цель без успешного push
  // помечалась «синхронизированной» и пропадала при следующем pull.
  useCloudStore.getState().setLastSyncedRemoteGoalIds(
    (remote.savingsGoals ?? []).map((g) => g.id),
  );
  useCloudStore.getState().setLastSyncedRemoteBudgetCategoryIds(
    (remote.categoryBudgets ?? []).map((b) => b.categoryId),
  );
  useCloudStore.getState().setLastSyncedRemoteRecurringIds(
    (remote.recurringTransactions ?? []).map((r) => r.id),
  );

  const balanceOffsets = parseBalanceOffsets(remote.balanceOffsets);
  useCloudStore.getState().setBalanceOffsets(balanceOffsets);

  const garage = resolveRemoteGarage(
    remote,
    local.vehicles,
    local.vehiclePrefs ?? defaultVehicleGaragePrefs(),
  );

  useStore.setState({
    transactions: merged.transactions,
    categories: merged.categories,
    savingsGoals,
    categoryBudgets: merged.categoryBudgets,
    recurringTransactions: merged.recurringTransactions,
    vehicles: garage.vehicles,
    vehiclePrefs: garage.vehiclePrefs,
    // Имена в балансе (userName / partnerName) — только на этом телефоне, не из облака.
    // household.partnerLabel в БД общий для семьи и не подставляется в UI.
  });

  applyBalanceOffsetsFromCloud(balanceOffsets, remote.memberUserIds);

  for (const id of merged.localOnlyTransactionIds) {
    const tx = merged.transactions.find((t) => t.id === id);
    if (tx) void cloudPushTransaction(tx);
  }
  for (const cat of merged.localOnlyCategories) {
    void cloudPushCategory(cat);
  }
  for (const id of merged.localOnlyGoalIds) {
    const goal = savingsGoals.find((g) => g.id === id);
    if (goal) void cloudPushGoal(goal);
  }
  for (const categoryId of merged.localOnlyBudgetCategoryIds) {
    const budget = merged.categoryBudgets.find((b) => b.categoryId === categoryId);
    if (budget) void cloudPushCategoryBudget(budget);
  }
  for (const id of merged.localOnlyRecurringIds) {
    const item = merged.recurringTransactions.find((r) => r.id === id);
    if (item) void cloudPushRecurring(item);
  }
}
