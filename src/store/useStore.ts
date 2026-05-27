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
  sanitizeCategories,
  slugifyCategoryId,
} from "@/lib/categories";
import { resolveTransactionAmount } from "@/lib/parse-amount";
import type {
  BudgetOwner,
  HouseholdFilter,
  Locale,
  ParsedTransaction,
  Transaction,
  TxType,
} from "@/types";

interface StoreState {
  transactions: Transaction[];
  categories: CategoryDefinition[];
  isRecording: boolean;
  locale: Locale;
  userName: string | null;
  partnerName: string | null;
  entryOwner: BudgetOwner;
  householdFilter: HouseholdFilter;
  trackingStartedAt: string | null;
  addTransaction: (data: ParsedTransaction, transcript?: string) => void;
  updateTransaction: (
    id: string,
    patch: { amount?: number; categoryId?: string; owner?: BudgetOwner; type?: TxType },
  ) => void;
  deleteTransaction: (id: string) => void;
  setLocale: (locale: Locale) => void;
  setIsRecording: (value: boolean) => void;
  setUserName: (name: string | null) => void;
  setPartnerName: (name: string | null) => void;
  setEntryOwner: (owner: BudgetOwner) => void;
  setHouseholdFilter: (filter: HouseholdFilter) => void;
  addCategory: (type: TxType, labelRu: string, labelEn: string, keywords?: string[]) => string | null;
  updateCategory: (
    id: string,
    patch: Partial<Pick<CategoryDefinition, "labels" | "keywords">>,
  ) => void;
  removeCategory: (id: string) => boolean;
  clearAll: () => void;
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
    return tx.type === "income" ? acc + tx.amount : acc - tx.amount;
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
  const amount = transcript
    ? resolveTransactionAmount(transcript, data.amount, locale)
    : data.amount;
  return { ...data, categoryId, amount };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      categories: getDefaultCategories(),
      isRecording: false,
      locale: "ru",
      userName: null,
      partnerName: null,
      entryOwner: "me",
      householdFilter: "all",
      trackingStartedAt: null,
      addTransaction: (data, transcript) =>
        set((state) => {
          const normalized = normalizeIncoming(
            data,
            state.categories,
            state.locale,
            transcript,
          );
          const owner = data.owner ?? state.entryOwner;
          return {
            trackingStartedAt: state.trackingStartedAt ?? new Date().toISOString(),
            transactions: [
              {
                id: makeId(),
                owner,
                ...normalized,
              },
              ...state.transactions,
            ],
          };
        }),
      updateTransaction: (id, patch) =>
        set((state) => {
          const categories = state.categories;
          return {
            transactions: state.transactions.map((tx) => {
              if (tx.id !== id) return tx;
              const amount =
                patch.amount !== undefined && patch.amount > 0 ? patch.amount : tx.amount;
              const type = patch.type ?? tx.type;
              let categoryId = patch.categoryId ?? tx.categoryId;
              const valid = categories.some((c) => c.id === categoryId && c.type === type);
              if (!valid) {
                categoryId = getFallbackCategoryId(type);
              }
              const owner = patch.owner ?? tx.owner;
              return { ...tx, amount, categoryId, type, owner };
            }),
          };
        }),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      setLocale: (locale) => set({ locale }),
      setIsRecording: (isRecording) => set({ isRecording }),
      setUserName: (userName) => set({ userName }),
      setPartnerName: (partnerName) =>
        set({
          partnerName: partnerName?.trim() || null,
          entryOwner: "me",
          householdFilter: "all",
        }),
      setEntryOwner: (entryOwner) => set({ entryOwner }),
      setHouseholdFilter: (householdFilter) => set({ householdFilter }),
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
        return id;
      },
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              labels: patch.labels ? { ...c.labels, ...patch.labels } : c.labels,
              keywords: patch.keywords ?? c.keywords,
            };
          }),
        })),
      removeCategory: (id) => {
        const cat = get().categories.find((c) => c.id === id);
        if (!cat || cat.isSystem) return false;
        const fallback = getFallbackCategoryId(cat.type);
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          transactions: state.transactions.map((tx) =>
            tx.categoryId === id ? { ...tx, categoryId: fallback } : tx,
          ),
        }));
        return true;
      },
      clearAll: () => set({ transactions: [], trackingStartedAt: null }),
    }),
    {
      name: "voicebudget-store",
      version: 5,
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as Record<string, unknown>;
        const categories = sanitizeCategories(raw.categories);
        const rawTx = Array.isArray(raw.transactions) ? raw.transactions : [];

        const transactions = rawTx.map((item) => {
          const tx = item as Transaction & { category?: string };
          const type = (tx.type ?? "expense") as TxType;
          let categoryId = tx.categoryId;
          if (!categoryId) {
            const legacy = tx.category ?? "";
            categoryId = legacy
              ? matchCategoryIdFromText(legacy, type, categories)
              : getFallbackCategoryId(type);
          }
          return {
            id: String(tx.id ?? `${Date.now()}`),
            amount: Number(tx.amount) || 0,
            type,
            categoryId,
            currency: tx.currency ?? "RUB",
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
          partnerName: typeof raw.partnerName === "string" ? raw.partnerName : null,
          entryOwner: raw.entryOwner === "partner" ? "partner" : "me",
          householdFilter:
            raw.householdFilter === "me" || raw.householdFilter === "partner"
              ? raw.householdFilter
              : "all",
          trackingStartedAt:
            typeof raw.trackingStartedAt === "string" ? raw.trackingStartedAt : null,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          try {
            localStorage.removeItem("voicebudget-store");
          } catch {
            /* ignore */
          }
        } else if (state) {
          state.categories = sanitizeCategories(state.categories);
          state.transactions = (state.transactions ?? []).map((tx) => withOwner(tx));
        }
      },
    },
  ),
);

export const useTransactions = () => useStore((s) => s.transactions);
export const useCategories = () => useStore((s) => s.categories);

export const useBalance = (ownerFilter?: HouseholdFilter) =>
  useStore((s) => {
    const filter = ownerFilter ?? s.householdFilter;
    const txs = filterByHousehold(s.transactions, filter);
    return calcBalance(txs);
  });

export function useHouseholdBalances() {
  return useStore(
    useShallow((s) => ({
      all: calcBalance(s.transactions),
      me: calcBalance(filterByHousehold(s.transactions, "me")),
      partner: calcBalance(filterByHousehold(s.transactions, "partner")),
    })),
  );
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

    return Array.from(map.entries()).map(([category, value]) => ({ category, value }));
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
