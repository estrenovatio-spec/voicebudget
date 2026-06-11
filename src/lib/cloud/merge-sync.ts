import { migrateCategoryId, sanitizeCategories } from "@/lib/categories";
import type { SyncPayload } from "@/lib/household/types";
import type { CategoryDefinition, Transaction } from "@/types";
import type { CategoryBudget, DebtItem, RecurringTransaction, SavingsGoal } from "@/types/planning";

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
    confirmed: tx.confirmed !== false,
    recurringId: tx.recurringId ?? null,
  };
}

export function mergeTransactions(
  local: Transaction[],
  remote: Transaction[],
  previouslySyncedRemoteIds?: ReadonlySet<string>,
  deletedTransactionIds?: ReadonlySet<string>,
  pendingTransactionUpdateIds?: ReadonlySet<string>,
): Transaction[] {
  const map = new Map<string, Transaction>();
  const remoteIds = new Set<string>();
  const localIds = new Set(local.map((t) => t.id));

  for (const raw of remote) {
    const tx = normalizeTx(raw);
    if (deletedTransactionIds?.has(tx.id)) continue;
    // Локально удалили, в pull ещё есть — не поднимать с облака.
    if (!localIds.has(tx.id) && previouslySyncedRemoteIds?.has(tx.id)) continue;
    map.set(tx.id, tx);
    remoteIds.add(tx.id);
  }

  for (const raw of local) {
    const tx = normalizeTx(raw);
    if (deletedTransactionIds?.has(tx.id)) continue;
    // Партнёр удалил в облаке — не держим локальную копию и не воскрешаем push'ем.
    if (previouslySyncedRemoteIds?.has(tx.id) && !remoteIds.has(tx.id)) continue;
    const existing = map.get(tx.id);
    if (!existing) {
      // Локальная операция ещё не на сервере (новая запись на этом устройстве).
      map.set(tx.id, tx);
      continue;
    }
    if (pendingTransactionUpdateIds?.has(tx.id)) {
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
  const localById = new Map(local.map((c) => [c.id, c]));
  const merged: CategoryDefinition[] = [];

  for (const remoteCat of remote) {
    const localCat = localById.get(remoteCat.id);
    if (!localCat) {
      merged.push(remoteCat);
      continue;
    }
    merged.push({
      ...remoteCat,
      labels: {
        ru: localCat.labels.ru?.trim() || remoteCat.labels.ru,
        en: localCat.labels.en?.trim() || remoteCat.labels.en,
      },
      keywords: [...new Set([...(remoteCat.keywords ?? []), ...(localCat.keywords ?? [])])],
      isSystem: remoteCat.isSystem ?? localCat.isSystem,
    });
  }

  for (const localCat of local) {
    if (remoteIds.has(localCat.id)) continue;
    if (previouslySyncedRemoteIds?.has(localCat.id)) continue;
    merged.push(localCat);
  }

  return sanitizeCategories(merged);
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
  previouslySynced?: ReadonlySet<string>,
  deletedIds?: ReadonlySet<string>,
): RecurringTransaction[] {
  const merged = mergeByKey(
    local.map((r) => ({ ...r, categoryId: migrateCategoryId(r.categoryId) })),
    remote.map((r) => ({ ...r, categoryId: migrateCategoryId(r.categoryId) })),
    (r) => r.id,
    previouslySynced,
  );
  if (!deletedIds?.size) return merged;
  return merged.filter((r) => !deletedIds.has(r.id));
}

export function mergeDebts(
  local: DebtItem[],
  remote: DebtItem[],
  previouslySynced?: ReadonlySet<string>,
  deletedIds?: ReadonlySet<string>,
): DebtItem[] {
  const merged = mergeByKey(local, remote, (d) => d.id, previouslySynced);
  if (!deletedIds?.size) return merged;
  return merged.filter((d) => !deletedIds.has(d.id));
}

export interface MergedSyncResult {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
  debts: DebtItem[];
  localOnlyTransactionIds: string[];
  localOnlyCategories: CategoryDefinition[];
  localOnlyGoalIds: string[];
  localOnlyBudgetCategoryIds: string[];
  localOnlyRecurringIds: string[];
  localOnlyDebtIds: string[];
}

export interface PlanningLocalState {
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
  debts: DebtItem[];
}

export interface PreviouslySyncedPlanning {
  goalIds?: ReadonlySet<string>;
  budgetCategoryIds?: ReadonlySet<string>;
  recurringIds?: ReadonlySet<string>;
  debtIds?: ReadonlySet<string>;
}

export function mergeSyncPayload(
  localTransactions: Transaction[],
  localCategories: CategoryDefinition[],
  localPlanning: PlanningLocalState,
  remote: SyncPayload,
  previouslySyncedRemoteIds?: ReadonlySet<string>,
  previouslySyncedRemoteCategoryIds?: ReadonlySet<string>,
  previouslySyncedPlanning?: PreviouslySyncedPlanning,
  deletedRecurringIds?: ReadonlySet<string>,
  deletedTransactionIds?: ReadonlySet<string>,
  deletedDebtIds?: ReadonlySet<string>,
  pendingTransactionUpdateIds?: ReadonlySet<string>,
): MergedSyncResult {
  const remoteTxIds = new Set(remote.transactions.map((t) => t.id));
  const remoteCategoryIds = new Set(remote.categories.map((c) => c.id));
  const remoteGoalIds = new Set((remote.savingsGoals ?? []).map((g) => g.id));
  const remoteBudgetIds = new Set((remote.categoryBudgets ?? []).map((b) => b.categoryId));
  const remoteRecurringIds = new Set((remote.recurringTransactions ?? []).map((r) => r.id));
  const remoteDebtIds = new Set((remote.debts ?? []).map((d) => d.id));

  const transactions = mergeTransactions(
    localTransactions,
    remote.transactions,
    previouslySyncedRemoteIds,
    deletedTransactionIds,
    pendingTransactionUpdateIds,
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
    deletedRecurringIds,
  );
  const debts = mergeDebts(
    localPlanning.debts,
    remote.debts ?? [],
    previouslySyncedPlanning?.debtIds,
    deletedDebtIds,
  );

  const localOnlyTransactionIds = localTransactions
    .map((t) => t.id)
    .filter((id) => {
      if (remoteTxIds.has(id)) return false;
      // Была в облаке, в pull уже нет — удаление на другом устройстве, не создаём снова.
      if (previouslySyncedRemoteIds?.has(id)) return false;
      if (deletedTransactionIds?.has(id)) return false;
      return true;
    });
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
    .filter((id) => {
      if (remoteRecurringIds.has(id)) return false;
      if (previouslySyncedPlanning?.recurringIds?.has(id)) return false;
      if (deletedRecurringIds?.has(id)) return false;
      return true;
    });
  const localOnlyDebtIds = localPlanning.debts
    .map((d) => d.id)
    .filter((id) => {
      if (remoteDebtIds.has(id)) return false;
      if (previouslySyncedPlanning?.debtIds?.has(id)) return false;
      if (deletedDebtIds?.has(id)) return false;
      return true;
    });

  return {
    transactions,
    categories,
    savingsGoals,
    categoryBudgets,
    recurringTransactions,
    debts,
    localOnlyTransactionIds,
    localOnlyCategories,
    localOnlyGoalIds,
    localOnlyBudgetCategoryIds,
    localOnlyRecurringIds,
    localOnlyDebtIds,
  };
}
