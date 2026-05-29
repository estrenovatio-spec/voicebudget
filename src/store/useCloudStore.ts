import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HouseholdPublic } from "@/lib/household/types";
import type { SubscriptionPublic } from "@/lib/payments/types";

interface CloudState {
  token: string | null;
  household: HouseholdPublic | null;
  subscription: SubscriptionPublic | null;
  serverConfigured: boolean | null;
  lastSyncedAt: string | null;
  /** ID операций, которые были в облаке при прошлом pull */
  lastSyncedRemoteTxIds: string[];
  /** ID категорий из облака при прошлом pull */
  lastSyncedRemoteCategoryIds: string[];
  lastSyncedRemoteGoalIds: string[];
  lastSyncedRemoteBudgetCategoryIds: string[];
  lastSyncedRemoteRecurringIds: string[];
  setServerConfigured: (value: boolean) => void;
  setSubscription: (subscription: SubscriptionPublic | null) => void;
  setSession: (token: string, household: HouseholdPublic) => void;
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
  clearSession: () => void;
}

export const useCloudStore = create<CloudState>()(
  persist(
    (set) => ({
      token: null,
      household: null,
      subscription: null,
      serverConfigured: null,
      lastSyncedAt: null,
      lastSyncedRemoteTxIds: [],
      lastSyncedRemoteCategoryIds: [],
      lastSyncedRemoteGoalIds: [],
      lastSyncedRemoteBudgetCategoryIds: [],
      lastSyncedRemoteRecurringIds: [],
      setServerConfigured: (serverConfigured) => set({ serverConfigured }),
      setSubscription: (subscription) => set({ subscription }),
      setSession: (token, household) => set({ token, household }),
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
      clearSession: () =>
        set({
          token: null,
          household: null,
          subscription: null,
          lastSyncedAt: null,
          lastSyncedRemoteTxIds: [],
          lastSyncedRemoteCategoryIds: [],
          lastSyncedRemoteGoalIds: [],
          lastSyncedRemoteBudgetCategoryIds: [],
          lastSyncedRemoteRecurringIds: [],
        }),
    }),
    { name: "voicebudget-cloud" },
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
