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
import { useCloudStore } from "@/store/useCloudStore";
import { useStore } from "@/store/useStore";

function emptyPlanningDefaults(sync: SyncPayload): SyncPayload {
  return {
    ...sync,
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
  );

  const savingsGoals = merged.savingsGoals.map((g) => applyGoalMonthlyToGoal(g));

  useCloudStore.getState().setSession(token, remote.household);
  useCloudStore.getState().setLastSyncedRemoteTxIds(remote.transactions.map((t) => t.id));
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

  useStore.setState({
    transactions: merged.transactions,
    categories: merged.categories,
    savingsGoals,
    categoryBudgets: merged.categoryBudgets,
    recurringTransactions: merged.recurringTransactions,
    // Имена в балансе (userName / partnerName) — только на этом телефоне, не из облака.
    // household.partnerLabel в БД общий для семьи и не подставляется в UI.
  });

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
