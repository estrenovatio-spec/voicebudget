import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BalanceOffsetsByUser } from "@/lib/balance-offsets";
import type { HouseholdPublic } from "@/lib/household/types";
import type { AccessSummaryPublic, SubscriptionPublic } from "@/lib/payments/types";
import type { ReferralProfilePublic } from "@/lib/referrals/service";
import { isValidSubscriptionPublic } from "@/lib/billing/subscription-shape";

interface CloudState {
  token: string | null;
  household: HouseholdPublic | null;
  /** Текущий пользователь в облаке (Telegram → User.id) */
  cloudUserId: string | null;
  householdMemberUserIds: string[];
  /** Корректировки «в кармане» с сервера (общие для семьи) */
  balanceOffsets: BalanceOffsetsByUser;
  subscription: SubscriptionPublic | null;
  accessSummary: AccessSummaryPublic | null;
  referralsEnabled: boolean;
  referralProfile: ReferralProfilePublic | null;
  serverConfigured: boolean | null;
  lastSyncedAt: string | null;
  /** ID операций, которые были в облаке при прошлом pull */
  lastSyncedRemoteTxIds: string[];
  /** ID категорий из облака при прошлом pull */
  lastSyncedRemoteCategoryIds: string[];
  lastSyncedRemoteGoalIds: string[];
  lastSyncedRemoteBudgetCategoryIds: string[];
  lastSyncedRemoteRecurringIds: string[];
  /** Локально удалённые регулярные — не поднимать с облака при merge */
  deletedRecurringIds: string[];
  /** Локально удалённые операции — не поднимать с облака при merge */
  deletedTransactionIds: string[];
  /** Последняя ошибка записи в облако (операция остаётся локально) */
  lastWriteError: string | null;
  setServerConfigured: (value: boolean) => void;
  setSubscription: (subscription: SubscriptionPublic | null) => void;
  setAccessSummary: (accessSummary: AccessSummaryPublic | null) => void;
  setReferralsEnabled: (enabled: boolean) => void;
  setReferralProfile: (profile: ReferralProfilePublic | null) => void;
  setSession: (token: string, household: HouseholdPublic) => void;
  setCloudUserId: (userId: string | null) => void;
  setHouseholdMemberUserIds: (ids: string[]) => void;
  setBalanceOffsets: (offsets: BalanceOffsetsByUser) => void;
  touchSync: () => void;
  setLastSyncedRemoteTxIds: (ids: string[]) => void;
  setLastSyncedRemoteCategoryIds: (ids: string[]) => void;
  setLastSyncedRemoteGoalIds: (ids: string[]) => void;
  setLastSyncedRemoteBudgetCategoryIds: (ids: string[]) => void;
  setLastSyncedRemoteRecurringIds: (ids: string[]) => void;
  removeFromLastSyncedRemoteTxIds: (id: string) => void;
  removeFromLastSyncedRemoteCategoryIds: (id: string) => void;
  removeFromLastSyncedRemoteGoalIds: (id: string) => void;
  removeFromLastSyncedRemoteBudgetCategoryIds: (categoryId: string) => void;
  removeFromLastSyncedRemoteRecurringIds: (id: string) => void;
  markRecurringDeleted: (id: string) => void;
  setDeletedRecurringIds: (ids: string[]) => void;
  markTransactionDeleted: (id: string) => void;
  setDeletedTransactionIds: (ids: string[]) => void;
  setLastWriteError: (error: string | null) => void;
  clearSession: () => void;
  /** Drop household token/sync only — keep subscription from latest bootstrap. */
  clearHouseholdSession: () => void;
}

export const useCloudStore = create<CloudState>()(
  persist(
    (set) => ({
      token: null,
      household: null,
      cloudUserId: null,
      householdMemberUserIds: [],
      balanceOffsets: {},
      subscription: null,
      accessSummary: null,
      referralsEnabled: false,
      referralProfile: null,
      serverConfigured: null,
      lastSyncedAt: null,
      lastSyncedRemoteTxIds: [],
      lastSyncedRemoteCategoryIds: [],
      lastSyncedRemoteGoalIds: [],
      lastSyncedRemoteBudgetCategoryIds: [],
      lastSyncedRemoteRecurringIds: [],
      deletedRecurringIds: [],
      deletedTransactionIds: [],
      lastWriteError: null,
      setServerConfigured: (serverConfigured) => set({ serverConfigured }),
      setLastWriteError: (lastWriteError) => set({ lastWriteError }),
      setSubscription: (subscription) => set({ subscription }),
      setAccessSummary: (accessSummary) => set({ accessSummary }),
      setReferralsEnabled: (referralsEnabled) => set({ referralsEnabled }),
      setReferralProfile: (referralProfile) => set({ referralProfile }),
      setSession: (token, household) => set({ token, household }),
      setCloudUserId: (cloudUserId) => set({ cloudUserId }),
      setHouseholdMemberUserIds: (householdMemberUserIds) => set({ householdMemberUserIds }),
      setBalanceOffsets: (balanceOffsets) => set({ balanceOffsets }),
      touchSync: () => set({ lastSyncedAt: new Date().toISOString() }),
      setLastSyncedRemoteTxIds: (ids) => set({ lastSyncedRemoteTxIds: ids }),
      setLastSyncedRemoteCategoryIds: (ids) => set({ lastSyncedRemoteCategoryIds: ids }),
      setLastSyncedRemoteGoalIds: (ids) => set({ lastSyncedRemoteGoalIds: ids }),
      setLastSyncedRemoteBudgetCategoryIds: (ids) =>
        set({ lastSyncedRemoteBudgetCategoryIds: ids }),
      setLastSyncedRemoteRecurringIds: (ids) => set({ lastSyncedRemoteRecurringIds: ids }),
      removeFromLastSyncedRemoteTxIds: (id) =>
        set((s) => ({
          lastSyncedRemoteTxIds: s.lastSyncedRemoteTxIds.filter((x) => x !== id),
        })),
      removeFromLastSyncedRemoteCategoryIds: (id) =>
        set((s) => ({
          lastSyncedRemoteCategoryIds: s.lastSyncedRemoteCategoryIds.filter((x) => x !== id),
        })),
      removeFromLastSyncedRemoteGoalIds: (id) =>
        set((s) => ({
          lastSyncedRemoteGoalIds: s.lastSyncedRemoteGoalIds.filter((x) => x !== id),
        })),
      removeFromLastSyncedRemoteBudgetCategoryIds: (categoryId) =>
        set((s) => ({
          lastSyncedRemoteBudgetCategoryIds: s.lastSyncedRemoteBudgetCategoryIds.filter(
            (x) => x !== categoryId,
          ),
        })),
      removeFromLastSyncedRemoteRecurringIds: (id) =>
        set((s) => ({
          lastSyncedRemoteRecurringIds: s.lastSyncedRemoteRecurringIds.filter((x) => x !== id),
        })),
      markRecurringDeleted: (id) =>
        set((s) => ({
          deletedRecurringIds: s.deletedRecurringIds.includes(id)
            ? s.deletedRecurringIds
            : [...s.deletedRecurringIds, id],
        })),
      setDeletedRecurringIds: (deletedRecurringIds) => set({ deletedRecurringIds }),
      markTransactionDeleted: (id) =>
        set((s) => ({
          deletedTransactionIds: s.deletedTransactionIds.includes(id)
            ? s.deletedTransactionIds
            : [...s.deletedTransactionIds, id],
        })),
      setDeletedTransactionIds: (deletedTransactionIds) => set({ deletedTransactionIds }),
      clearSession: () =>
        set({
          token: null,
          household: null,
          cloudUserId: null,
          householdMemberUserIds: [],
          balanceOffsets: {},
          subscription: null,
          accessSummary: null,
          referralsEnabled: false,
          referralProfile: null,
          lastSyncedAt: null,
          lastSyncedRemoteTxIds: [],
          lastSyncedRemoteCategoryIds: [],
          lastSyncedRemoteGoalIds: [],
          lastSyncedRemoteBudgetCategoryIds: [],
          lastSyncedRemoteRecurringIds: [],
          deletedRecurringIds: [],
          deletedTransactionIds: [],
          lastWriteError: null,
        }),
      clearHouseholdSession: () =>
        set({
          token: null,
          household: null,
          lastSyncedAt: null,
          lastSyncedRemoteTxIds: [],
          lastSyncedRemoteCategoryIds: [],
          lastSyncedRemoteGoalIds: [],
          lastSyncedRemoteBudgetCategoryIds: [],
          lastSyncedRemoteRecurringIds: [],
        }),
    }),
    {
      name: "voicebudget-cloud",
      version: 6,
      migrate: (persisted, version) => {
        const state = persisted as CloudState;
        let next = state;
        if (version < 1) {
          next = {
            ...next,
            lastSyncedRemoteGoalIds: [],
            lastSyncedRemoteBudgetCategoryIds: [],
            lastSyncedRemoteRecurringIds: [],
          };
        }
        if (version < 2) {
          next = {
            ...next,
            cloudUserId: next.cloudUserId ?? null,
            householdMemberUserIds: next.householdMemberUserIds ?? [],
          };
        }
        if (version < 3) {
          next = {
            ...next,
            balanceOffsets: next.balanceOffsets ?? {},
          };
        }
        if (version < 4) {
          next = {
            ...next,
            deletedRecurringIds: next.deletedRecurringIds ?? [],
          };
        }
        if (version < 5) {
          next = {
            ...next,
            subscription: isValidSubscriptionPublic(next.subscription)
              ? next.subscription
              : null,
          };
        }
        if (version < 6) {
          next = {
            ...next,
            deletedTransactionIds: next.deletedTransactionIds ?? [],
          };
        }
        return next;
      },
      onRehydrateStorage: () => () => {
        void import("@/lib/cloud/apply-balance-offsets").then(({ applyBalanceOffsetsFromCloud }) => {
          applyBalanceOffsetsFromCloud();
        });
      },
    },
  ),
);

export function useIsCloudActive() {
  const token = useCloudStore((s) => s.token);
  const household = useCloudStore((s) => s.household);
  const subscription = useCloudStore((s) => s.subscription);
  if (!token || !household) return false;
  if (subscription?.enforced && !subscription.active) return false;
  return true;
}

export function useSubscriptionRequired() {
  const subscription = useCloudStore((s) => s.subscription);
  return Boolean(subscription?.enforced && !subscription.active);
}
