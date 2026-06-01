import { migrateCategoryId, sanitizeCategories } from "@/lib/categories";
import type { SyncPayload } from "@/lib/household/types";
import type { CategoryDefinition, Transaction } from "@/types";
import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";

function txTime(tx: Transaction): number {
  const updated = tx.updatedAt ? Date.parse(tx.updatedAt) : NaN;
  if (!Number.isNaN(updated)) return updated;
  const d = Date.parse(tx.date);
  return Number.isNaN(d) ? 0 : d;
}

function itemTime(item: { updatedAt?: string }): number {
  const updated = item.updatedAt ? Date.parse(item.updatedAt) : NaN;
  return Number.isNaN(updated) ? 0 : updated;
}

function normalizeTx(tx: Transaction): Transaction {
  return {
    ...tx,
    categoryId: migrateCategoryId(tx.categoryId),
    owner: tx.owner === "partner" ? "partner" : "me",
  };
}

export function mergeTransactions(
  local: Transaction[],
  remote: Transaction[],
  previouslySyncedRemoteIds?: ReadonlySet<string>,
): Transaction[] {
  const map = new Map<string, Transaction>();
  const remoteIds = new Set<string>();

  for (const raw of remote) {
    const tx = normalizeTx(raw);
    map.set(tx.id, tx);
    remoteIds.add(tx.id);
  }

  for (const raw of local) {
    const tx = normalizeTx(raw);
    const existing = map.get(tx.id);
    if (!existing) {
      if (previouslySyncedRemoteIds?.has(tx.id) && !remoteIds.has(tx.id)) {
        continue;
      }
      map.set(tx.id, tx);
      continue;
    }
    if (txTime(tx) >= txTime(existing)) {
      map.set(tx.id, tx);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });
}

export function mergeCategories(
  local: CategoryDefinition[],
  remote: CategoryDefinition[],
  previouslySyncedRemoteIds?: ReadonlySet<string>,
): CategoryDefinition[] {
  const remoteIds = new Set(remote.map((c) => c.id));
  const filteredLocal = local.filter((cat) => {
    if (previouslySyncedRemoteIds?.has(cat.id) && !remoteIds.has(cat.id)) {
      return false;
    }
    if (remoteIds.has(cat.id)) return false;
    return true;
  });
  return sanitizeCategories([...remote, ...filteredLocal]);
}

function mergeByKey<T extends { updatedAt?: string }>(
  local: T[],
  remote: T[],
  getKey: (item: T) => string,
  previouslySynced?: ReadonlySet<string>,
): T[] {
  const map = new Map<string, T>();
  const remoteKeys = new Set(remote.map(getKey));

  for (const item of remote) {
    map.set(getKey(item), item);
  }

  for (const item of local) {
    const key = getKey(item);
    const existing = map.get(key);
    if (!existing) {
      if (previouslySynced?.has(key) && !remoteKeys.has(key)) continue;
      map.set(key, item);
      continue;
    }
    if (itemTime(item) >= itemTime(existing)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

/** Цели, лимиты, регулярные: локальное не удаляем, если в облаке пусто или push не дошёл. */
function mergePlanningByKey<T extends { updatedAt?: string }>(
  local: T[],
  remote: T[],
  getKey: (item: T) => string,
): T[] {
  const map = new Map<string, T>();

  for (const item of remote) {
    map.set(getKey(item), item);
  }

  for (const item of local) {
    const key = getKey(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    if (itemTime(item) >= itemTime(existing)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

export function mergeSavingsGoals(
  local: SavingsGoal[],
  remote: SavingsGoal[],
  _previouslySynced?: ReadonlySet<string>,
): SavingsGoal[] {
  return mergePlanningByKey(local, remote, (g) => g.id);
}

export function mergeCategoryBudgets(
  local: CategoryBudget[],
  remote: CategoryBudget[],
  _previouslySynced?: ReadonlySet<string>,
): CategoryBudget[] {
  return mergePlanningByKey(
    local.map((b) => ({ ...b, categoryId: migrateCategoryId(b.categoryId) })),
    remote.map((b) => ({ ...b, categoryId: migrateCategoryId(b.categoryId) })),
    (b) => b.categoryId,
  );
}

export function mergeRecurringTransactions(
  local: RecurringTransaction[],
  remote: RecurringTransaction[],
  _previouslySynced?: ReadonlySet<string>,
): RecurringTransaction[] {
  return mergePlanningByKey(
    local.map((r) => ({ ...r, categoryId: migrateCategoryId(r.categoryId) })),
    remote.map((r) => ({ ...r, categoryId: migrateCategoryId(r.categoryId) })),
    (r) => r.id,
  );
}

export interface MergedSyncResult {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
  localOnlyTransactionIds: string[];
  localOnlyCategories: CategoryDefinition[];
  localOnlyGoalIds: string[];
  localOnlyBudgetCategoryIds: string[];
  localOnlyRecurringIds: string[];
}

export interface PlanningLocalState {
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
}

export interface PreviouslySyncedPlanning {
  goalIds?: ReadonlySet<string>;
  budgetCategoryIds?: ReadonlySet<string>;
  recurringIds?: ReadonlySet<string>;
}

export function mergeSyncPayload(
  localTransactions: Transaction[],
  localCategories: CategoryDefinition[],
  localPlanning: PlanningLocalState,
  remote: SyncPayload,
  previouslySyncedRemoteIds?: ReadonlySet<string>,
  previouslySyncedRemoteCategoryIds?: ReadonlySet<string>,
  previouslySyncedPlanning?: PreviouslySyncedPlanning,
): MergedSyncResult {
  const remoteTxIds = new Set(remote.transactions.map((t) => t.id));
  const remoteCategoryIds = new Set(remote.categories.map((c) => c.id));
  const remoteGoalIds = new Set((remote.savingsGoals ?? []).map((g) => g.id));
  const remoteBudgetIds = new Set((remote.categoryBudgets ?? []).map((b) => b.categoryId));
  const remoteRecurringIds = new Set((remote.recurringTransactions ?? []).map((r) => r.id));

  const transactions = mergeTransactions(
    localTransactions,
    remote.transactions,
    previouslySyncedRemoteIds,
  );
  const categories = mergeCategories(
    localCategories,
    remote.categories,
    previouslySyncedRemoteCategoryIds,
  );
  const savingsGoals = mergeSavingsGoals(
    localPlanning.savingsGoals,
    remote.savingsGoals ?? [],
    previouslySyncedPlanning?.goalIds,
  );
  const categoryBudgets = mergeCategoryBudgets(
    localPlanning.categoryBudgets,
    remote.categoryBudgets ?? [],
    previouslySyncedPlanning?.budgetCategoryIds,
  );
  const recurringTransactions = mergeRecurringTransactions(
    localPlanning.recurringTransactions,
    remote.recurringTransactions ?? [],
    previouslySyncedPlanning?.recurringIds,
  );

  const localOnlyTransactionIds = localTransactions
    .map((t) => t.id)
    .filter((id) => !remoteTxIds.has(id))
    .filter((id) => !previouslySyncedRemoteIds?.has(id));
  const localOnlyCategories = localCategories.filter(
    (c) => !remoteCategoryIds.has(c.id) && !previouslySyncedRemoteCategoryIds?.has(c.id),
  );
  const localOnlyGoalIds = localPlanning.savingsGoals
    .map((g) => g.id)
    .filter((id) => !remoteGoalIds.has(id));
  const localOnlyBudgetCategoryIds = localPlanning.categoryBudgets
    .map((b) => b.categoryId)
    .filter((id) => !remoteBudgetIds.has(id));
  const localOnlyRecurringIds = localPlanning.recurringTransactions
    .map((r) => r.id)
    .filter((id) => !remoteRecurringIds.has(id));

  return {
    transactions,
    categories,
    savingsGoals,
    categoryBudgets,
    recurringTransactions,
    localOnlyTransactionIds,
    localOnlyCategories,
    localOnlyGoalIds,
    localOnlyBudgetCategoryIds,
    localOnlyRecurringIds,
  };
}
