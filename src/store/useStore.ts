import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import {
  type CategoryDefinition,
  getDefaultCategories,
  getFallbackCategoryId,
  getCategoryLabel,
  matchCategoryIdFromText,
  normalizeParsedCategory,
  migrateCategoryId,
  sanitizeCategories,
  slugifyCategoryId,
} from "@/lib/categories";
import { getTrackingStartDate } from "@/lib/budget-analytics";
import { clampMonthStartDay, getCurrentBudgetPeriod, isDateInBudgetPeriod } from "@/lib/budget-period";
import { applyDetectedOwner } from "@/lib/detect-owner";
import { hasPartnerBudget } from "@/lib/owner-labels";
import { buildGoalDepositTransaction } from "@/lib/planning/goal-transfer";
import { normalizeAppCurrency } from "@/lib/app-currency";
import { roundMoneyUp } from "@/lib/format-money";
import {
  cloudPushCategory,
  cloudPushCategoryBudget,
  cloudPushCategoryBudgetDelete,
  cloudPushCategoryDelete,
  cloudPushGoal,
  cloudPushGoalDelete,
  cloudPushRecurring,
  cloudPushRecurringDelete,
  cloudPushTransaction,
  cloudPushTransactionDelete,
  cloudPushTransactionUpdate,
} from "@/lib/cloud/push";
import {
  applyGoalDelta,
  normalizeGoalAmount,
  revertTransactionGoal,
} from "@/lib/goal-from-transaction";
import {
  defaultEmergencyGoal,
  todayIso,
  advanceRecurringDate,
} from "@/lib/planning/analytics";
import {
  recurringToParsedTransaction,
} from "@/lib/planning/recurring-run";
import { useCloudStore } from "@/store/useCloudStore";
import { resolveTransactionAmount } from "@/lib/parse-amount";
import type {
  BudgetOwner,
  HouseholdFilter,
  Locale,
  ParsedTransaction,
  Transaction,
  TxType,
} from "@/types";
import type {
  CategoryBudget,
  RecurringFrequency,
  RecurringTransaction,
  SavingsGoal,
} from "@/types/planning";
import { EMERGENCY_GOAL_ID } from "@/types/planning";

interface StoreState {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  isRecording: boolean;
  locale: Locale;
  userName: string | null;
  /** Пользователь вручную задал «моё имя» — не перезаписывать из Telegram */
  userNameCustomized: boolean;
  partnerName: string | null;
  /** Пользователь вручную задал имя партнёра в балансе */
  partnerNameCustomized: boolean;
  entryOwner: BudgetOwner;
  householdFilter: HouseholdFilter;
  trackingStartedAt: string | null;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderWindowStart: string;
  reminderWindowEnd: string;
  reminderLastShownDate: string | null;
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
  /** День начала бюджетного месяца (1 = календарный, 25 = с 25-го по 24-е) */
  budgetMonthStartDay: number;
  /** Блок «Цели и планирование» свёрнут */
  planningPanelCollapsed: boolean;
  setPlanningPanelCollapsed: (collapsed: boolean) => void;
  addTransaction: (data: ParsedTransaction, transcript?: string) => void;
  updateTransaction: (
    id: string,
    patch: {
      amount?: number;
      categoryId?: string;
      owner?: BudgetOwner;
      type?: TxType;
      goalId?: string | null;
      goalAmount?: number | null;
    },
  ) => void;
  deleteTransaction: (id: string) => void;
  setLocale: (locale: Locale) => void;
  setIsRecording: (value: boolean) => void;
  setUserName: (name: string | null) => void;
  setPartnerName: (name: string | null) => void;
  setEntryOwner: (owner: BudgetOwner) => void;
  setHouseholdFilter: (filter: HouseholdFilter) => void;
  /** Корректировка: «реально в кармане» минус сумма по операциям */
  cashOffsetMe: number;
  cashOffsetPartner: number;
  setActualCash: (owner: BudgetOwner, actualAmount: number) => void;
  setBudgetMonthStartDay: (day: number) => void;
  addCategory: (type: TxType, labelRu: string, labelEn: string, keywords?: string[]) => string | null;
  updateCategory: (
    id: string,
    patch: Partial<Pick<CategoryDefinition, "labels" | "keywords">>,
  ) => void;
  removeCategory: (id: string) => boolean;
  restoreDefaultCategories: () => void;
  clearAll: () => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setReminderWindowStart: (time: string) => void;
  setReminderWindowEnd: (time: string) => void;
  markReminderShownToday: () => void;
  /** Дата первого входа / начала учёта (для месячного разбора) */
  ensureTrackingStarted: () => void;
  addGoal: (name: string, targetAmount: number, deadline?: string | null) => string;
  updateGoal: (
    id: string,
    patch: { name?: string; targetAmount?: number; deadline?: string | null },
  ) => boolean;
  depositGoal: (id: string, amount: number) => boolean;
  removeGoal: (id: string) => boolean;
  enableEmergencyFund: (months: 3 | 6) => void;
  setEmergencyMonths: (months: 3 | 6) => void;
  setCategoryBudget: (categoryId: string, monthlyLimit: number) => void;
  removeCategoryBudget: (categoryId: string) => void;
  addRecurring: (
    data: Omit<RecurringTransaction, "id" | "enabled" | "updatedAt">,
  ) => string;
  updateRecurring: (
    id: string,
    patch: Partial<Omit<RecurringTransaction, "id">>,
  ) => void;
  removeRecurring: (id: string) => void;
  processRecurringDue: () => void;
  applyPlanningInput: (
    action: import("@/types/planning").PlanningInputAction,
  ) => boolean;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function withOwner(tx: Transaction): Transaction {
  return { ...tx, owner: tx.owner ?? "me" };
}

function filterByHousehold(transactions: Transaction[], filter: HouseholdFilter): Transaction[] {
  const list = transactions.map(withOwner);
  if (filter === "all") return list;
  return list.filter((tx) => tx.owner === filter);
}

function calcBalance(transactions: Transaction[]): number {
  return transactions.reduce((acc, tx) => {
    if (tx.type === "income") {
      const toGoal = normalizeGoalAmount(tx.goalAmount);
      return acc + tx.amount - toGoal;
    }
    return acc - tx.amount;
  }, 0);
}

function normalizeIncoming(
  data: ParsedTransaction,
  categories: CategoryDefinition[],
  locale: Locale,
  transcript?: string,
): ParsedTransaction {
  const categoryId = normalizeParsedCategory(
    data.categoryId,
    transcript ?? data.note,
    data.type,
    categories,
  );
  const raw = transcript
    ? resolveTransactionAmount(transcript, data.amount, locale)
    : data.amount;
  return {
    ...data,
    categoryId,
    amount: roundMoneyUp(raw),
    currency: normalizeAppCurrency(data.currency),
  };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      categories: getDefaultCategories(),
      isRecording: false,
      locale: "ru",
      userName: null,
      userNameCustomized: false,
      partnerName: null,
      partnerNameCustomized: false,
      entryOwner: "me",
      householdFilter: "all",
      trackingStartedAt: null,
      reminderEnabled: false,
      reminderTime: "20:00",
      reminderWindowStart: "18:00",
      reminderWindowEnd: "22:00",
      reminderLastShownDate: null,
      savingsGoals: [],
      categoryBudgets: [],
      recurringTransactions: [],
      budgetMonthStartDay: 1,
      planningPanelCollapsed: false,
      setPlanningPanelCollapsed: (collapsed) => set({ planningPanelCollapsed: collapsed }),
      cashOffsetMe: 0,
      cashOffsetPartner: 0,
      addTransaction: (data, transcript) => {
        const newId = makeId();
        set((state) => {
          const normalized = normalizeIncoming(
            data,
            state.categories,
            state.locale,
            transcript,
          );
          const withOwner = applyDetectedOwner(
            normalized,
            transcript ?? normalized.note,
            {
              partnerName: state.partnerName,
              myName: state.userName,
              locale: state.locale,
              hasPartner: hasPartnerBudget(state.partnerName),
            },
            data.owner ?? state.entryOwner,
          );
          const owner = withOwner.owner ?? state.entryOwner;
          let goalId = data.goalId ?? null;
          let goalAmount = normalizeGoalAmount(data.goalAmount);
          if (!goalId || goalAmount <= 0) {
            goalId = null;
            goalAmount = 0;
          }
          if (goalAmount > normalized.amount) {
            goalAmount = normalized.amount;
          }
          const isGoalTransfer =
            normalized.type === "expense" &&
            goalId &&
            goalAmount > 0 &&
            (normalized.categoryId === "goal_jar" || data.goalId);
          if (normalized.type === "income") {
            /* часть дохода в копилку */
          } else if (!isGoalTransfer) {
            goalId = null;
            goalAmount = 0;
          } else if (goalAmount < normalized.amount) {
            goalAmount = normalized.amount;
          }
          const created: Transaction = {
            id: newId,
            owner,
            ...normalized,
            goalId: goalId && goalAmount ? goalId : null,
            goalAmount: goalId && goalAmount ? goalAmount : null,
          };
          let savingsGoals = state.savingsGoals;
          if (created.goalId && created.goalAmount) {
            savingsGoals = applyGoalDelta(savingsGoals, created.goalId, created.goalAmount);
          }
          return {
            trackingStartedAt: state.trackingStartedAt ?? new Date().toISOString(),
            reminderLastShownDate: new Date().toISOString().slice(0, 10),
            transactions: [created, ...state.transactions],
            savingsGoals,
          };
        });
        const created = get().transactions.find((t) => t.id === newId) ?? null;
        if (created) {
          void cloudPushTransaction(created);
          if (created.goalId && created.goalAmount) {
            const goal = get().savingsGoals.find((g) => g.id === created.goalId);
            if (goal) void cloudPushGoal(goal);
          }
        }
      },
      updateTransaction: (id, patch) => {
        const prev = get().transactions.find((t) => t.id === id);
        let updated: Transaction | null = null;
        set((state) => {
          const categories = state.categories;
          let savingsGoals = state.savingsGoals;
          if (prev) {
            savingsGoals = revertTransactionGoal(
              savingsGoals,
              prev.goalId,
              prev.goalAmount,
            );
          }
          const transactions = state.transactions.map((tx) => {
            if (tx.id !== id) return tx;
            const amount =
              patch.amount !== undefined && patch.amount > 0
                ? roundMoneyUp(patch.amount)
                : tx.amount;
            const type = patch.type ?? tx.type;
            let categoryId = patch.categoryId ?? tx.categoryId;
            const valid = categories.some((c) => c.id === categoryId && c.type === type);
            if (!valid) {
              categoryId = getFallbackCategoryId(type);
            }
            const owner = patch.owner ?? tx.owner;
            const goalId = patch.goalId !== undefined ? patch.goalId : tx.goalId ?? null;
            let goalAmount =
              patch.goalAmount !== undefined ? patch.goalAmount : tx.goalAmount ?? null;
            goalAmount = normalizeGoalAmount(goalAmount);
            if (!goalId || goalAmount <= 0) {
              goalAmount = null;
            }
            if (goalAmount && goalAmount > amount) {
              goalAmount = amount;
            }
            updated = {
              ...tx,
              amount,
              categoryId,
              type,
              owner,
              goalId: goalId && goalAmount ? goalId : null,
              goalAmount: goalId && goalAmount ? goalAmount : null,
            };
            return updated;
          });
          if (updated?.goalId && updated.goalAmount) {
            savingsGoals = applyGoalDelta(savingsGoals, updated.goalId, updated.goalAmount);
          }
          return { transactions, savingsGoals };
        });
        const after = get().transactions.find((t) => t.id === id);
        if (after) {
          const goalIds = new Set<string>();
          if (prev?.goalId) goalIds.add(prev.goalId);
          if (after.goalId) goalIds.add(after.goalId);
          void cloudPushTransactionUpdate(id, {
            amount: after.amount,
            categoryId: after.categoryId,
            owner: after.owner,
            type: after.type,
            goalId: after.goalId,
            goalAmount: after.goalAmount,
          });
          for (const gid of goalIds) {
            const goal = get().savingsGoals.find((g) => g.id === gid);
            if (goal) void cloudPushGoal(goal);
          }
        }
      },
      deleteTransaction: (id) => {
        const tx = get().transactions.find((t) => t.id === id);
        let goalAfterDelete: SavingsGoal | null = null;
        set((state) => {
          const savingsGoals = revertTransactionGoal(
            state.savingsGoals,
            tx?.goalId,
            tx?.goalAmount,
          );
          if (tx?.goalId) {
            goalAfterDelete = savingsGoals.find((g) => g.id === tx.goalId) ?? null;
          }
          return {
            transactions: state.transactions.filter((t) => t.id !== id),
            savingsGoals,
          };
        });
        if (goalAfterDelete) void cloudPushGoal(goalAfterDelete);
        useCloudStore.getState().removeFromLastSyncedRemoteTxIds(id);
        void cloudPushTransactionDelete(id);
      },
      setLocale: (locale) => set({ locale }),
      setIsRecording: (isRecording) => set({ isRecording }),
      setUserName: (userName) =>
        set({
          userName: userName?.trim() || null,
          userNameCustomized: true,
        }),
      setPartnerName: (partnerName) => {
        const trimmed = partnerName?.trim() || null;
        set({
          partnerName: trimmed,
          partnerNameCustomized: true,
          entryOwner: "me",
          householdFilter: "all",
        });
      },
      setEntryOwner: (entryOwner) => set({ entryOwner }),
      setHouseholdFilter: (householdFilter) => set({ householdFilter }),
      setBudgetMonthStartDay: (day) => set({ budgetMonthStartDay: clampMonthStartDay(day) }),
      setActualCash: (owner, actualAmount) => {
        if (!Number.isFinite(actualAmount)) return;
        const actual = Math.round(actualAmount);
        const txs = filterByHousehold(get().transactions, owner);
        const computed = calcBalance(txs);
        const offset = actual - computed;
        if (owner === "me") set({ cashOffsetMe: offset });
        else set({ cashOffsetPartner: offset });
      },
      addCategory: (type, labelRu, labelEn, keywords = []) => {
        const ru = labelRu.trim();
        const en = labelEn.trim() || ru;
        if (!ru) return null;
        let id = slugifyCategoryId(ru);
        const { categories } = get();
        if (categories.some((c) => c.id === id)) {
          id = `${id}-${Date.now().toString(36).slice(-4)}`;
        }
        const item: CategoryDefinition = {
          id,
          type,
          labels: { ru, en },
          keywords: keywords.map((k) => k.trim().toLowerCase()).filter(Boolean),
          isSystem: false,
        };
        set({ categories: [...categories, item] });
        void cloudPushCategory(item);
        return id;
      },
      updateCategory: (id, patch) => {
        let updated: CategoryDefinition | null = null;
        set((state) => ({
          categories: state.categories.map((c) => {
            if (c.id !== id) return c;
            updated = {
              ...c,
              labels: patch.labels ? { ...c.labels, ...patch.labels } : c.labels,
              keywords: patch.keywords ?? c.keywords,
            };
            return updated;
          }),
        }));
        if (updated) void cloudPushCategory(updated);
      },
      removeCategory: (id) => {
        const cat = get().categories.find((c) => c.id === id);
        if (!cat) return false;
        const fallback = getFallbackCategoryId(cat.type);
        if (cat.id === fallback) return false;
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          transactions: state.transactions.map((tx) =>
            tx.categoryId === id ? { ...tx, categoryId: fallback } : tx,
          ),
        }));
        useCloudStore.getState().removeFromLastSyncedRemoteCategoryIds(id);
        void cloudPushCategoryDelete(id);
        return true;
      },
      restoreDefaultCategories: () => {
        const defaults = getDefaultCategories();
        const defaultIds = new Set(defaults.map((c) => c.id));
        const prev = get().categories;
        set((state) => ({
          categories: defaults.map((c) => ({ ...c, keywords: [...c.keywords] })),
          transactions: state.transactions.map((tx) =>
            defaultIds.has(tx.categoryId) ? tx : { ...tx, categoryId: getFallbackCategoryId(tx.type) },
          ),
        }));
        for (const cat of defaults) void cloudPushCategory(cat);
        for (const cat of prev) {
          if (!defaultIds.has(cat.id)) void cloudPushCategoryDelete(cat.id);
        }
      },
      clearAll: () => set({ transactions: [], trackingStartedAt: null }),
      setReminderEnabled: (reminderEnabled) => set({ reminderEnabled }),
      setReminderTime: (reminderTime) => set({ reminderTime }),
      setReminderWindowStart: (reminderWindowStart) => set({ reminderWindowStart }),
      setReminderWindowEnd: (reminderWindowEnd) => set({ reminderWindowEnd }),
      markReminderShownToday: () =>
        set({ reminderLastShownDate: new Date().toISOString().slice(0, 10) }),
      ensureTrackingStarted: () => {
        const state = get();
        if (state.trackingStartedAt) return;
        const fromTx = getTrackingStartDate(null, state.transactions);
        set({
          trackingStartedAt: (fromTx ?? new Date()).toISOString(),
        });
      },
      addGoal: (name, targetAmount, deadline = null) => {
        const trimmed = name.trim();
        let id = slugifyCategoryId(trimmed) || `goal-${Date.now().toString(36)}`;
        const { savingsGoals } = get();
        if (savingsGoals.some((g) => g.id === id)) {
          id = `${id}-${Date.now().toString(36).slice(-4)}`;
        }
        const goal: SavingsGoal = {
          id,
          name: trimmed,
          targetAmount: roundMoneyUp(targetAmount),
          savedAmount: 0,
          deadline,
          kind: "custom",
          emergencyMonths: null,
          updatedAt: new Date().toISOString(),
        };
        set({ savingsGoals: [...savingsGoals, goal] });
        void cloudPushGoal(goal);
        return id;
      },
      updateGoal: (id, patch) => {
        const existing = get().savingsGoals.find((g) => g.id === id);
        if (!existing || existing.kind === "emergency") return false;
        let updated: SavingsGoal | null = null;
        set((state) => ({
          savingsGoals: state.savingsGoals.map((g) => {
            if (g.id !== id) return g;
            updated = {
              ...g,
              name: patch.name?.trim() || g.name,
              targetAmount:
                patch.targetAmount !== undefined
                  ? roundMoneyUp(Math.max(0, patch.targetAmount))
                  : g.targetAmount,
              deadline: patch.deadline !== undefined ? patch.deadline : g.deadline,
              updatedAt: new Date().toISOString(),
            };
            return updated;
          }),
        }));
        if (updated) void cloudPushGoal(updated);
        return Boolean(updated);
      },
      depositGoal: (id, amount) => {
        const amt = roundMoneyUp(amount);
        if (amt <= 0) return false;
        const goal = get().savingsGoals.find((g) => g.id === id);
        if (!goal) return false;
        const before = get().transactions.length;
        get().addTransaction(buildGoalDepositTransaction(goal, amt, get().entryOwner));
        return get().transactions.length > before;
      },
      removeGoal: (id) => {
        const goal = get().savingsGoals.find((g) => g.id === id);
        if (!goal || goal.kind === "emergency") return false;
        set((state) => ({
          savingsGoals: state.savingsGoals.filter((g) => g.id !== id),
        }));
        useCloudStore.getState().removeFromLastSyncedRemoteGoalIds(id);
        void cloudPushGoalDelete(id);
        return true;
      },
      enableEmergencyFund: (months) => {
        const existing = get().savingsGoals.find((g) => g.id === EMERGENCY_GOAL_ID);
        const goal: SavingsGoal = existing
          ? { ...existing, emergencyMonths: months, kind: "emergency", updatedAt: new Date().toISOString() }
          : { ...defaultEmergencyGoal(months), updatedAt: new Date().toISOString() };
        set((state) => ({
          savingsGoals: existing
            ? state.savingsGoals.map((g) => (g.id === EMERGENCY_GOAL_ID ? goal : g))
            : [...state.savingsGoals, goal],
        }));
        void cloudPushGoal(goal);
      },
      setEmergencyMonths: (months) => {
        get().enableEmergencyFund(months);
      },
      setCategoryBudget: (categoryId, monthlyLimit) => {
        const limit = roundMoneyUp(monthlyLimit);
        if (limit <= 0) return;
        const budget: CategoryBudget = {
          categoryId,
          monthlyLimit: limit,
          updatedAt: new Date().toISOString(),
        };
        set((state) => {
          const rest = state.categoryBudgets.filter((b) => b.categoryId !== categoryId);
          return { categoryBudgets: [...rest, budget] };
        });
        void cloudPushCategoryBudget(budget);
      },
      removeCategoryBudget: (categoryId) => {
        set((state) => ({
          categoryBudgets: state.categoryBudgets.filter((b) => b.categoryId !== categoryId),
        }));
        useCloudStore.getState().removeFromLastSyncedRemoteBudgetCategoryIds(categoryId);
        void cloudPushCategoryBudgetDelete(categoryId);
      },
      addRecurring: (data) => {
        const id = makeId();
        const item: RecurringTransaction = {
          ...data,
          id,
          enabled: true,
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          recurringTransactions: [...state.recurringTransactions, item],
        }));
        void cloudPushRecurring(item);
        return id;
      },
      updateRecurring: (id, patch) => {
        let updated: RecurringTransaction | null = null;
        set((state) => ({
          recurringTransactions: state.recurringTransactions.map((r) => {
            if (r.id !== id) return r;
            updated = { ...r, ...patch, updatedAt: new Date().toISOString() };
            return updated;
          }),
        }));
        if (updated) void cloudPushRecurring(updated);
      },
      removeRecurring: (id) => {
        set((state) => ({
          recurringTransactions: state.recurringTransactions.filter((r) => r.id !== id),
        }));
        useCloudStore.getState().removeFromLastSyncedRemoteRecurringIds(id);
        void cloudPushRecurringDelete(id);
      },
      processRecurringDue: () => {
        const state = get();
        const today = todayIso();
        for (const item of state.recurringTransactions) {
          if (!item.enabled || item.nextRunDate > today) continue;
          let runDate = item.nextRunDate;
          while (runDate <= today) {
            get().addTransaction(recurringToParsedTransaction(item, runDate));
            runDate = advanceRecurringDate(runDate, item.frequency, item.dayOfMonth);
          }
          if (runDate !== item.nextRunDate) {
            get().updateRecurring(item.id, { nextRunDate: runDate });
          }
        }
      },
      applyPlanningInput: (action) => {
        if (action.kind === "goal_create") {
          get().addGoal(action.name, action.targetAmount, action.deadline ?? null);
          return true;
        }
        if (action.kind === "goal_deposit") {
          return get().depositGoal(action.goalId, action.amount);
        }
        if (action.kind === "goal_deposit_by_name") {
          const q = action.goalName.trim().toLowerCase();
          if (!q) return false;
          const goals = get().savingsGoals;
          const goal =
            goals.find((g) => g.name.toLowerCase() === q) ??
            goals.find((g) => g.name.toLowerCase().includes(q)) ??
            goals.find((g) => q.includes(g.name.toLowerCase()));
          if (goal) return get().depositGoal(goal.id, action.amount);
          const newId = get().addGoal(action.goalName.trim(), 0);
          return get().depositGoal(newId, action.amount);
        }
        if (action.kind === "income_with_goal") {
          let goalId = action.goalId;
          if (!goalId) {
            const goals = get().savingsGoals;
            const q = action.goalName.toLowerCase();
            const existing =
              goals.find((g) => g.name.toLowerCase() === q) ??
              goals.find((g) => g.name.toLowerCase().includes(q));
            if (existing) {
              goalId = existing.id;
            } else {
              goalId = get().addGoal(action.goalName, 0);
            }
          }
          const categories = get().categories;
          const categoryId =
            matchCategoryIdFromText(action.sourceText, "income", categories) ??
            getFallbackCategoryId("income");
          get().addTransaction(
            {
              amount: action.incomeAmount,
              type: "income",
              categoryId,
              currency: normalizeAppCurrency(),
              note: action.sourceText.slice(0, 120),
              date: new Date().toISOString().slice(0, 10),
              goalId,
              goalAmount: action.goalAmount,
            },
            action.sourceText,
          );
          return true;
        }
        return false;
      },
    }),
    {
      name: "voicebudget-store",
      version: 17,
      migrate: (persisted, version) => {
        const raw = (persisted ?? {}) as Record<string, unknown>;
        const categories = sanitizeCategories(raw.categories);
        const rawTx = Array.isArray(raw.transactions) ? raw.transactions : [];

        const transactions = rawTx.map((item) => {
          const tx = item as Transaction & { category?: string };
          const type = (tx.type ?? "expense") as TxType;
          let categoryId = tx.categoryId ? migrateCategoryId(tx.categoryId) : undefined;
          if (!categoryId) {
            const legacy = tx.category ?? "";
            categoryId = legacy
              ? matchCategoryIdFromText(legacy, type, categories)
              : getFallbackCategoryId(type);
          }
          return {
            id: String(tx.id ?? `${Date.now()}`),
            amount: roundMoneyUp(Number(tx.amount) || 0),
            type,
            categoryId,
            currency: normalizeAppCurrency(tx.currency),
            note: String(tx.note ?? ""),
            date: String(tx.date ?? new Date().toISOString().slice(0, 10)),
            owner: (tx.owner ?? "me") as BudgetOwner,
          };
        });

        return {
          transactions,
          categories,
          isRecording: false,
          locale: (raw.locale === "en" ? "en" : "ru") as Locale,
          userName: typeof raw.userName === "string" ? raw.userName : null,
          userNameCustomized:
            Boolean(raw.userNameCustomized) ||
            (typeof raw.userName === "string" && raw.userName.trim().length > 0),
          partnerName: typeof raw.partnerName === "string" ? raw.partnerName : null,
          partnerNameCustomized:
            Boolean(raw.partnerNameCustomized) ||
            (typeof raw.partnerName === "string" && raw.partnerName.trim().length > 0),
          entryOwner: raw.entryOwner === "partner" ? "partner" : "me",
          householdFilter:
            raw.householdFilter === "me" || raw.householdFilter === "partner"
              ? raw.householdFilter
              : "all",
          trackingStartedAt:
            typeof raw.trackingStartedAt === "string" ? raw.trackingStartedAt : null,
          reminderEnabled: Boolean(raw.reminderEnabled),
          reminderTime:
            typeof raw.reminderTime === "string" && /^\d{2}:\d{2}$/.test(raw.reminderTime)
              ? raw.reminderTime
              : "20:00",
          reminderWindowStart:
            typeof raw.reminderWindowStart === "string" &&
            /^\d{2}:\d{2}$/.test(raw.reminderWindowStart)
              ? raw.reminderWindowStart
              : "18:00",
          reminderWindowEnd:
            typeof raw.reminderWindowEnd === "string" && /^\d{2}:\d{2}$/.test(raw.reminderWindowEnd)
              ? raw.reminderWindowEnd
              : "22:00",
          reminderLastShownDate:
            typeof raw.reminderLastShownDate === "string" ? raw.reminderLastShownDate : null,
          savingsGoals: Array.isArray(raw.savingsGoals) ? (raw.savingsGoals as SavingsGoal[]) : [],
          categoryBudgets: Array.isArray(raw.categoryBudgets)
            ? (raw.categoryBudgets as CategoryBudget[])
            : [],
          recurringTransactions: Array.isArray(raw.recurringTransactions)
            ? (raw.recurringTransactions as RecurringTransaction[])
            : [],
          budgetMonthStartDay: clampMonthStartDay(
            typeof raw.budgetMonthStartDay === "number" ? raw.budgetMonthStartDay : 1,
          ),
          cashOffsetMe: typeof raw.cashOffsetMe === "number" ? raw.cashOffsetMe : 0,
          cashOffsetPartner:
            typeof raw.cashOffsetPartner === "number" ? raw.cashOffsetPartner : 0,
          planningPanelCollapsed:
            typeof raw.planningPanelCollapsed === "boolean" ? raw.planningPanelCollapsed : false,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[voicebudget-store] rehydrate failed, keeping cloud session", error);
        } else if (state) {
          if (typeof window !== "undefined") {
            try {
              if (
                localStorage.getItem("voicebudget-planning-panel-hidden") === "1" &&
                !state.planningPanelCollapsed
              ) {
                state.planningPanelCollapsed = true;
              }
              localStorage.removeItem("voicebudget-planning-panel-hidden");
            } catch {
              /* ignore */
            }
          }
          state.categories = sanitizeCategories(state.categories);
          state.transactions = (state.transactions ?? []).map((tx) => {
            const withO = withOwner(tx);
            return {
              ...withO,
              categoryId: migrateCategoryId(withO.categoryId),
            };
          });
        }
      },
    },
  ),
);

export const useTransactions = () => useStore((s) => s.transactions);
export const useCategories = () => useStore((s) => s.categories);

export function useComputedBalance(owner: "me" | "partner" | "all" = "all"): number {
  return useStore((s) => {
    if (owner === "all") return calcBalance(s.transactions);
    return calcBalance(filterByHousehold(s.transactions, owner));
  });
}

export const useBalance = (ownerFilter?: HouseholdFilter) =>
  useStore((s) => {
    const filter = ownerFilter ?? s.householdFilter;
    const txs = filterByHousehold(s.transactions, filter);
    const base = calcBalance(txs);
    if (filter === "me") return base + s.cashOffsetMe;
    if (filter === "partner") return base + s.cashOffsetPartner;
    return base + s.cashOffsetMe + s.cashOffsetPartner;
  });

export function useHouseholdBalances() {
  return useStore(
    useShallow((s) => {
      const me = calcBalance(filterByHousehold(s.transactions, "me")) + s.cashOffsetMe;
      const partner =
        calcBalance(filterByHousehold(s.transactions, "partner")) + s.cashOffsetPartner;
      return {
        all: me + partner,
        me,
        partner,
      };
    }),
  );
}

export type OwnerTypeTotals = {
  me: { income: number; expense: number };
  partner: { income: number; expense: number };
};

export function useOwnerTypeTotals(days = 30): OwnerTypeTotals {
  const transactions = useTransactions();

  return useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const totals: OwnerTypeTotals = {
      me: { income: 0, expense: 0 },
      partner: { income: 0, expense: 0 },
    };

    transactions.map(withOwner).forEach((tx) => {
      if (new Date(tx.date).getTime() < cutoff) return;
      const bucket = totals[tx.owner];
      if (tx.type === "income") bucket.income += tx.amount;
      else bucket.expense += tx.amount;
    });

    return totals;
  }, [transactions, days]);
}

export function useBudgetPeriod() {
  const monthStartDay = useStore((s) => s.budgetMonthStartDay);
  return useMemo(() => getCurrentBudgetPeriod(monthStartDay), [monthStartDay]);
}

export function usePeriodOwnerTotals(): OwnerTypeTotals {
  const transactions = useTransactions();
  const period = useBudgetPeriod();

  return useMemo(() => {
    const totals: OwnerTypeTotals = {
      me: { income: 0, expense: 0 },
      partner: { income: 0, expense: 0 },
    };

    transactions.map(withOwner).forEach((tx) => {
      if (!isDateInBudgetPeriod(tx.date, period)) return;
      const bucket = totals[tx.owner];
      if (tx.type === "income") bucket.income += tx.amount;
      else bucket.expense += tx.amount;
    });

    return totals;
  }, [transactions, period]);
}

export function usePeriodTypeCategoryBreakdown(
  type: TxType,
): { category: string; value: number }[] {
  const transactions = useTransactions();
  const categories = useCategories();
  const locale = useStore((s) => s.locale);
  const period = useBudgetPeriod();

  return useMemo(() => {
    const map = new Map<string, number>();

    transactions.map(withOwner).forEach((tx) => {
      if (tx.type !== type) return;
      if (!isDateInBudgetPeriod(tx.date, period)) return;
      const label = getCategoryLabel(tx.categoryId, categories, locale);
      map.set(label, (map.get(label) ?? 0) + tx.amount);
    });

    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale, period, type]);
}

export function usePeriodCategoryBreakdown(): { category: string; value: number }[] {
  const transactions = useTransactions();
  const categories = useCategories();
  const locale = useStore((s) => s.locale);
  const householdFilter = useStore((s) => s.householdFilter);
  const period = useBudgetPeriod();

  return useMemo(() => {
    const map = new Map<string, number>();
    const list = filterByHousehold(transactions, householdFilter);

    list.forEach((tx) => {
      if (tx.type !== "expense") return;
      if (!isDateInBudgetPeriod(tx.date, period)) return;
      const label = getCategoryLabel(tx.categoryId, categories, locale);
      map.set(label, (map.get(label) ?? 0) + tx.amount);
    });

    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale, householdFilter, period]);
}

export function usePeriodOwnerExpenseBreakdown(
  owner: BudgetOwner,
): { category: string; value: number }[] {
  const transactions = useTransactions();
  const categories = useCategories();
  const locale = useStore((s) => s.locale);
  const period = useBudgetPeriod();

  return useMemo(() => {
    const map = new Map<string, number>();

    transactions
      .map(withOwner)
      .filter(
        (tx) =>
          tx.owner === owner &&
          tx.type === "expense" &&
          isDateInBudgetPeriod(tx.date, period),
      )
      .forEach((tx) => {
        const label = getCategoryLabel(tx.categoryId, categories, locale);
        map.set(label, (map.get(label) ?? 0) + tx.amount);
      });

    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale, period, owner]);
}

export function useTypeCategoryBreakdown(
  days: number,
  type: TxType,
): { category: string; value: number }[] {
  const transactions = useTransactions();
  const categories = useCategories();
  const locale = useStore((s) => s.locale);

  return useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const map = new Map<string, number>();

    transactions.map(withOwner).forEach((tx) => {
      if (tx.type !== type) return;
      if (new Date(tx.date).getTime() < cutoff) return;
      const label = getCategoryLabel(tx.categoryId, categories, locale);
      map.set(label, (map.get(label) ?? 0) + tx.amount);
    });

    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale, days, type]);
}

export function useOwnerExpenseBreakdown(
  days: number,
  owner: BudgetOwner,
): { category: string; value: number }[] {
  const transactions = useTransactions();
  const categories = useCategories();
  const locale = useStore((s) => s.locale);

  return useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const map = new Map<string, number>();

    transactions
      .map(withOwner)
      .filter(
        (tx) =>
          tx.owner === owner &&
          tx.type === "expense" &&
          new Date(tx.date).getTime() >= cutoff,
      )
      .forEach((tx) => {
        const label = getCategoryLabel(tx.categoryId, categories, locale);
        map.set(label, (map.get(label) ?? 0) + tx.amount);
      });

    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale, days, owner]);
}

export function useCategoryBreakdown(days = 30): { category: string; value: number }[] {
  const transactions = useTransactions();
  const categories = useCategories();
  const locale = useStore((s) => s.locale);
  const householdFilter = useStore((s) => s.householdFilter);

  return useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const map = new Map<string, number>();

    filterByHousehold(transactions, householdFilter)
      .filter((tx) => tx.type === "expense" && new Date(tx.date).getTime() >= cutoff)
      .forEach((tx) => {
        const label = getCategoryLabel(tx.categoryId, categories, locale);
        map.set(label, (map.get(label) ?? 0) + tx.amount);
      });

    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale, householdFilter, days]);
}

export function useFilteredTransactions(filter: "all" | TxType): Transaction[] {
  const transactions = useTransactions();
  const householdFilter = useStore((s) => s.householdFilter);
  const byOwner = filterByHousehold(transactions, householdFilter);
  const list = byOwner.slice(0, 10);
  if (filter === "all") return list;
  return list.filter((tx) => tx.type === filter);
}
