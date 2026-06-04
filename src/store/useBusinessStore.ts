import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildBusinessSnapshot } from "@/lib/business/analytics";
import type {
  BusinessAsset,
  BusinessAssetType,
  BusinessCloudPayload,
  BusinessSnapshot,
  BusinessTransaction,
  BusinessTxKind,
  BusinessUnit,
} from "@/lib/business/types";
import {
  BUSINESS_UNIT_COLORS,
  defaultBusinessUnit,
} from "@/lib/business/types";
import { normalizeAppCurrency } from "@/lib/app-currency";
import { getFallbackCategoryId } from "@/lib/categories";
import { roundMoneyUp } from "@/lib/format-money";
import { useStore } from "@/store/useStore";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function pickUnitColor(units: BusinessUnit[]): string {
  const used = new Set(units.map((u) => u.color));
  const free = BUSINESS_UNIT_COLORS.find((c) => !used.has(c));
  return free ?? BUSINESS_UNIT_COLORS[units.length % BUSINESS_UNIT_COLORS.length];
}

function ensureDefaultUnit(units: BusinessUnit[]): BusinessUnit[] {
  if (units.length > 0) return units;
  return [defaultBusinessUnit()];
}

type BusinessStore = {
  units: BusinessUnit[];
  transactions: BusinessTransaction[];
  assets: BusinessAsset[];
  selectedUnitId: string | null;
  cloudSyncedAt: string | null;
  taxRatePct: number;
  setSelectedUnitId: (id: string | null) => void;
  setTaxRatePct: (pct: number) => void;
  addUnit: (name: string) => string | null;
  removeUnit: (id: string) => void;
  renameUnit: (id: string, name: string) => void;
  setUnitHourlyRate: (id: string, rate: number) => void;
  addOperatingTx: (
    unitId: string,
    type: "income" | "expense",
    amount: number,
    note: string,
    date?: string,
  ) => void;
  transferToCushion: (unitId: string, amount: number) => void;
  transferToFamily: (unitId: string, amount: number) => boolean;
  removeTransaction: (id: string) => void;
  addAsset: (
    unitId: string,
    type: BusinessAssetType,
    name: string,
    capitalValue: number,
    monthlyNet: number,
    hoursPerMonth?: number,
  ) => void;
  removeAsset: (id: string) => void;
  snapshot: (unitId?: string | null) => BusinessSnapshot;
  exportPayload: () => BusinessCloudPayload;
  importPayload: (payload: BusinessCloudPayload) => void;
  markCloudSynced: () => void;
};

function migratePersisted(raw: unknown): Pick<
  BusinessStore,
  "units" | "transactions" | "assets" | "selectedUnitId" | "cloudSyncedAt" | "taxRatePct"
> {
  const r = (raw ?? {}) as Record<string, unknown>;
  let units = Array.isArray(r.units) ? (r.units as BusinessUnit[]) : [];
  units = ensureDefaultUnit(units);
  const defaultId = units[0].id;

  const transactions = (Array.isArray(r.transactions) ? r.transactions : []).map((t) => {
    const tx = t as BusinessTransaction;
    return { ...tx, unitId: tx.unitId ?? defaultId };
  });
  const assets = (Array.isArray(r.assets) ? r.assets : []).map((a) => {
    const asset = a as BusinessAsset;
    return { ...asset, unitId: asset.unitId ?? defaultId };
  });

  return {
    units,
    transactions,
    assets,
    selectedUnitId:
      typeof r.selectedUnitId === "string" ? r.selectedUnitId : units[0]?.id ?? null,
    cloudSyncedAt: typeof r.cloudSyncedAt === "string" ? r.cloudSyncedAt : null,
    taxRatePct:
      typeof r.taxRatePct === "number" && r.taxRatePct >= 0 && r.taxRatePct <= 100
        ? r.taxRatePct
        : 0,
  };
}

export const useBusinessStore = create<BusinessStore>()(
  persist(
    (set, get) => ({
      units: [defaultBusinessUnit()],
      transactions: [],
      assets: [],
      selectedUnitId: null,
      cloudSyncedAt: null,
      taxRatePct: 0,
      setSelectedUnitId: (id) => set({ selectedUnitId: id }),
      setTaxRatePct: (pct) => {
        const n = Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
        set({ taxRatePct: n });
      },
      addUnit: (name) => {
        const label = name.trim();
        if (!label) return null;
        const { units } = get();
        const unit: BusinessUnit = {
          id: makeId("unit"),
          name: label.slice(0, 60),
          color: pickUnitColor(units),
          createdAt: new Date().toISOString(),
        };
        set({ units: [...units, unit], selectedUnitId: unit.id });
        return unit.id;
      },
      removeUnit: (id) => {
        const { units, transactions, assets } = get();
        if (units.length <= 1) return;
        const nextUnits = units.filter((u) => u.id !== id);
        set({
          units: nextUnits,
          transactions: transactions.filter((t) => t.unitId !== id),
          assets: assets.filter((a) => a.unitId !== id),
          selectedUnitId: nextUnits[0]?.id ?? null,
        });
      },
      renameUnit: (id, name) => {
        const label = name.trim();
        if (!label) return;
        set((s) => ({
          units: s.units.map((u) => (u.id === id ? { ...u, name: label.slice(0, 60) } : u)),
        }));
      },
      setUnitHourlyRate: (id, rate) => {
        const n = Math.max(0, roundMoneyUp(rate));
        set((s) => ({
          units: s.units.map((u) => (u.id === id ? { ...u, hourlyRate: n > 0 ? n : undefined } : u)),
        }));
      },
      addOperatingTx: (unitId, type, amount, note, date) => {
        const amt = roundMoneyUp(amount);
        if (amt <= 0 || !get().units.some((u) => u.id === unitId)) return;
        const kind: BusinessTxKind =
          type === "income" ? "operating_income" : "operating_expense";
        const tx: BusinessTransaction = {
          id: makeId("tx"),
          unitId,
          type,
          amount: amt,
          kind,
          note: note.trim().slice(0, 120) || (type === "income" ? "Доход" : "Расход"),
          date: date ?? new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
      },
      transferToCushion: (unitId, amount) => {
        const amt = roundMoneyUp(amount);
        if (amt <= 0) return;
        const snap = get().snapshot(unitId);
        if (amt > snap.canToCushion) return;
        const tx: BusinessTransaction = {
          id: makeId("tx"),
          unitId,
          type: "expense",
          amount: amt,
          kind: "cushion_deposit",
          note: "→ подушка безопасности",
          date: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
      },
      transferToFamily: (unitId, amount) => {
        const amt = roundMoneyUp(amount);
        if (amt <= 0) return false;
        const snap = get().snapshot(unitId);
        if (amt > snap.canToFamily) return false;
        const unit = get().units.find((u) => u.id === unitId);
        const tx: BusinessTransaction = {
          id: makeId("tx"),
          unitId,
          type: "expense",
          amount: amt,
          kind: "family_withdrawal",
          note: "→ семейный бюджет",
          date: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        useStore.getState().addTransaction({
          amount: amt,
          type: "income",
          categoryId: getFallbackCategoryId("income"),
          currency: normalizeAppCurrency(),
          note: `Из бизнеса: ${unit?.name ?? "бизнес"}`,
          date: new Date().toISOString().slice(0, 10),
          owner: "me",
        });
        return true;
      },
      removeTransaction: (id) => {
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
      },
      addAsset: (unitId, type, name, capitalValue, monthlyNet, hoursPerMonth) => {
        const label = name.trim();
        if (!label || !get().units.some((u) => u.id === unitId)) return;
        const asset: BusinessAsset = {
          id: makeId("asset"),
          unitId,
          type,
          name: label.slice(0, 80),
          capitalValue: Math.max(0, roundMoneyUp(capitalValue)),
          monthlyNet: roundMoneyUp(monthlyNet),
          hoursPerMonth:
            type === "freelance" && hoursPerMonth && hoursPerMonth > 0
              ? Math.round(hoursPerMonth)
              : undefined,
        };
        set((s) => ({ assets: [asset, ...s.assets] }));
      },
      removeAsset: (id) => {
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
      },
      snapshot: (unitId) => {
        const id = unitId === undefined ? get().selectedUnitId : unitId;
        return buildBusinessSnapshot(
          get().transactions,
          get().assets,
          id,
          new Date(),
          get().taxRatePct,
        );
      },
      exportPayload: () => ({
        version: 2,
        units: get().units,
        transactions: get().transactions,
        assets: get().assets,
        taxRatePct: get().taxRatePct,
      }),
      importPayload: (payload) => {
        set(migratePersisted(payload));
      },
      markCloudSynced: () => set({ cloudSyncedAt: new Date().toISOString() }),
    }),
    {
      name: "voicebudget-business-preview-v2",
      version: 2,
      migrate: (persisted) => migratePersisted(persisted),
    },
  ),
);

export function useBusinessSnapshot(unitId?: string | null): BusinessSnapshot {
  const transactions = useBusinessStore((s) => s.transactions);
  const assets = useBusinessStore((s) => s.assets);
  const selectedUnitId = useBusinessStore((s) => s.selectedUnitId);
  const taxRatePct = useBusinessStore((s) => s.taxRatePct);
  const id = unitId === undefined ? selectedUnitId : unitId;
  return buildBusinessSnapshot(transactions, assets, id, new Date(), taxRatePct);
}
