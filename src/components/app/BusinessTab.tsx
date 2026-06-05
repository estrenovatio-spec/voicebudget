"use client";

import {
  ArrowDownToLine,
  BriefcaseBusiness,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BusinessProjectsSection } from "@/components/app/BusinessProjectsSection";
import { BusinessTxEditDialog } from "@/components/app/BusinessTxEditDialog";
import { LiveRatesBar } from "@/components/LiveRatesBar";
import { StatisticsPeriodControls } from "@/components/StatisticsPeriodControls";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  expenseBreakdownForPeriod,
  incomeSourcesForPeriod,
  unitCardMetrics,
  type UnitCardMetrics,
} from "@/lib/business/analytics";
import { parseMoneyAmount } from "@/lib/business/parse-input";
import { cn } from "@/lib/utils";
import { taxPeriodLabel } from "@/lib/business/tax";
import type {
  BusinessTaxPeriod,
  BusinessTransaction,
  BusinessUnit,
} from "@/lib/business/types";
import { formatBudgetPeriodLabel } from "@/lib/budget-period";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import {
  isProjectsServiceUnit,
  resolveVisibleUnitId,
  visibleBusinessUnits,
} from "@/lib/business/projects-unit";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useStatsPeriod, useStore } from "@/store/useStore";

const BUSINESS_HOW_HIDDEN_KEY = "voicebudget-business-how-hidden";
type BusinessSection = "operations" | "reserve" | "tax" | "projects";

function txKindLabel(tx: BusinessTransaction, locale: "ru" | "en"): string {
  switch (tx.kind) {
    case "cushion_deposit":
      return t(locale, "bizTxCushion");
    case "family_withdrawal":
      return t(locale, "bizTxFamily");
    default:
      return tx.type === "income" ? t(locale, "income") : t(locale, "expense");
  }
}

function UnitCard({
  unit,
  metrics,
  selected,
  locale,
  onSelect,
  onEdit,
  onToCushion,
  onToFamily,
  onQuickTx,
}: {
  unit: BusinessUnit;
  metrics: UnitCardMetrics;
  selected: boolean;
  locale: "ru" | "en";
  onSelect: () => void;
  onEdit: () => void;
  onToCushion: () => void;
  onToFamily: () => void;
  onQuickTx: (type: "income" | "expense", amount: number, note: string) => void;
}) {
  const [quickMode, setQuickMode] = useState<"income" | "expense" | null>(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const openQuick = (
    mode: "income" | "expense",
    e: { stopPropagation: () => void },
  ) => {
    e.stopPropagation();
    onSelect();
    setQuickMode((prev) => (prev === mode ? null : mode));
    setQuickAmount("");
    setQuickNote("");
  };

  const submitQuick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!quickMode) return;
    const raw = quickAmount.trim();
    let amountRaw = raw;
    if (/^\+\s*(\d|[\d\s.,])/.test(raw)) amountRaw = raw.replace(/^\+\s*/, "");
    else if (/^[-−–]\s*(\d|[\d\s.,])/.test(raw))
      amountRaw = raw.replace(/^[-−–]\s*/, "");
    const n = parseMoneyAmount(amountRaw);
    if (!n) return;
    onQuickTx(quickMode, n, quickNote.trim());
    setQuickMode(null);
    setQuickAmount("");
    setQuickNote("");
  };

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border-[3px] transition-all",
        selected
          ? "border-emerald-500 bg-emerald-500/20 shadow-md"
          : "border-border/80 bg-card hover:border-emerald-500/35",
      )}
    >
      <div className="flex flex-1 flex-col p-3">
        <button
          type="button"
          onClick={onSelect}
          className="line-clamp-2 pr-7 text-left text-sm font-semibold leading-snug hover:opacity-95"
        >
          {unit.name}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(e) => openQuick("income", e)}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-center transition-all active:scale-[0.98]",
              quickMode === "income"
                ? "border-emerald-500 bg-emerald-500/25 ring-2 ring-emerald-500/50"
                : "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20",
            )}
          >
            <p className="text-[9px] font-medium uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
              {t(locale, "bizUnitIncome")}
            </p>
            <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              +{formatMoney(metrics.income, locale)}
            </p>
          </button>
          <button
            type="button"
            onClick={(e) => openQuick("expense", e)}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-center transition-all active:scale-[0.98]",
              quickMode === "expense"
                ? "border-red-500 bg-red-500/25 ring-2 ring-red-500/50"
                : "border-red-500/35 bg-red-500/10 hover:bg-red-500/20",
            )}
          >
            <p className="text-[9px] font-medium uppercase tracking-wide text-red-800/80 dark:text-red-300/80">
              {t(locale, "bizUnitExpense")}
            </p>
            <p className="text-sm font-bold tabular-nums text-red-700 dark:text-red-400">
              −{formatMoney(metrics.expense, locale)}
            </p>
          </button>
        </div>
        {quickMode ? (
          <div
            className={cn(
              "mt-2 space-y-2 rounded-lg border p-2",
              quickMode === "income"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-red-500/40 bg-red-500/5",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              type="text"
              inputMode="decimal"
              placeholder={t(locale, "txAmount")}
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
            <Input
              placeholder={t(locale, "bizTxNotePh")}
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              className="h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickMode(null);
                }}
              >
                {t(locale, "bizQuickTxCancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(
                  "flex-1 text-xs",
                  quickMode === "income"
                    ? "bg-emerald-600 hover:bg-emerald-600/90"
                    : "bg-red-600 hover:bg-red-600/90",
                )}
                disabled={!quickAmount.trim()}
                onClick={submitQuick}
              >
                {t(locale, "bizQuickTxSave")}
              </Button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full flex-col text-left hover:opacity-95"
        >
          <p
            className={`mt-1.5 text-center text-[11px] font-semibold tabular-nums ${
              metrics.profit >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {t(locale, "bizUnitProfit")} {metrics.profit >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(metrics.profit), locale)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular-nums">
            <div className="min-w-0 space-y-0.5 text-muted-foreground">
              <p className="font-medium text-foreground">
                {t(locale, "bizUnitCushion")}
              </p>
              <p className="font-semibold text-foreground">
                {formatMoney(metrics.cushionBalance, locale)}
              </p>
              <p className="text-[10px] leading-snug">
                {t(locale, "bizUnitCushionTargetLine", {
                  amount: formatMoney(metrics.cushionTarget, locale),
                })}
              </p>
              <p className="text-[10px] leading-snug">
                {t(locale, "bizUnitCushionPeriod")}
              </p>
            </div>
            <div className="min-w-0 space-y-0.5 text-right text-muted-foreground">
              <p className="font-medium text-foreground">
                {t(locale, "bizOperatingBalance")}
              </p>
              <p className="font-semibold text-foreground">
                {formatMoney(metrics.operatingBalance, locale)}
              </p>
              {metrics.operatingBalance > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToFamily();
                  }}
                  className="mt-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                >
                  {t(locale, "bizUnitToFamily")}{" "}
                  {formatMoney(metrics.operatingBalance, locale)}
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-[10px] tabular-nums text-muted-foreground">
            <p>
              {t(locale, "bizUnitMargin")} {metrics.profitMarginPct}%
            </p>
            {metrics.taxRatePct > 0 ? (
              <p className="text-amber-800 dark:text-amber-200">
                {t(locale, "bizUnitTax", {
                  amount: formatMoney(metrics.taxReserve, locale),
                  rate: String(metrics.taxRatePct),
                  period: taxPeriodLabel(metrics.taxPeriod, locale),
                })}
              </p>
            ) : null}
          </div>
          {metrics.canToCushion > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToCushion();
              }}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/10 py-1 text-[10px] font-medium text-primary"
            >
              <ArrowDownToLine className="h-3 w-3" aria-hidden />
              {t(locale, "bizUnitToCushion")}{" "}
              {formatMoney(metrics.canToCushion, locale)}
            </button>
          ) : null}
        </button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-7 w-7 text-muted-foreground"
        aria-label={t(locale, "bizUnitEdit")}
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function BusinessUnitTabs({
  units,
  activeUnitId,
  metricsMap,
  locale,
  onSelect,
  onAdd,
}: {
  units: BusinessUnit[];
  activeUnitId: string | null;
  metricsMap: Map<string, UnitCardMetrics>;
  locale: "ru" | "en";
  onSelect: (unitId: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div
        className="flex min-w-max items-center gap-1 border-b border-border/70"
        role="tablist"
        aria-label={t(locale, "bizUnitsTitle")}
      >
        {units.map((unit) => {
          const active = unit.id === activeUnitId;
          const metrics = metricsMap.get(unit.id);
          const profit = metrics?.profit ?? 0;
          return (
            <button
              key={unit.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(unit.id)}
              title={unit.name}
              className={cn(
                "max-w-[10rem] border-b-2 px-3 py-2 text-left text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className="block break-words leading-tight"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {unit.name}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[10px] font-semibold tabular-nums",
                  profit > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : profit < 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-muted-foreground",
                )}
              >
                {profit > 0 ? "+" : profit < 0 ? "−" : ""}
                {formatMoney(Math.abs(profit), locale)}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          className="flex h-9 w-9 shrink-0 items-center justify-center border-b-2 border-transparent text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t(locale, "bizUnitAdd")}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function safeWithdrawAmount(metrics: UnitCardMetrics): number {
  return Math.max(0, Math.floor(metrics.operatingBalance - metrics.taxReserve));
}

function BusinessKpis({
  metrics,
  safeWithdraw,
  locale,
}: {
  metrics: UnitCardMetrics;
  safeWithdraw: number;
  locale: "ru" | "en";
}) {
  const items = [
    {
      label: t(locale, "bizKpiRevenue"),
      value: `+${formatMoney(metrics.income, locale)}`,
      tone: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: t(locale, "bizKpiExpenses"),
      value: `−${formatMoney(metrics.expense, locale)}`,
      tone: "text-red-700 dark:text-red-400",
    },
    {
      label: t(locale, "bizUnitProfit"),
      value: `${metrics.profit >= 0 ? "+" : "−"}${formatMoney(Math.abs(metrics.profit), locale)}`,
      tone:
        metrics.profit >= 0
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-red-700 dark:text-red-400",
    },
    {
      label: t(locale, "bizCanWithdraw"),
      value: formatMoney(safeWithdraw, locale),
      tone: safeWithdraw > 0 ? "text-primary" : "text-muted-foreground",
    },
    {
      label: t(locale, "bizCushionShort"),
      value: `${formatMoney(metrics.cushionBalance, locale)} / ${formatMoney(metrics.cushionTarget, locale)}`,
      tone: "text-amber-700 dark:text-amber-300",
    },
    {
      label: t(locale, "bizTaxShort"),
      value: formatMoney(metrics.taxReserve, locale),
      tone:
        metrics.taxReserve > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border/80 bg-card px-3 py-2"
        >
          <p className="text-[11px] text-muted-foreground">{item.label}</p>
          <p
            className={cn(
              "mt-0.5 break-words text-base font-bold tabular-nums sm:text-lg",
              item.tone,
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function BusinessAdvisor({
  metrics,
  safeWithdraw,
  locale,
  open,
  onToggle,
}: {
  metrics: UnitCardMetrics;
  safeWithdraw: number;
  locale: "ru" | "en";
  open: boolean;
  onToggle: () => void;
}) {
  const reserveMonths =
    metrics.avgMonthlyExpense > 0
      ? Math.min(
          99,
          Math.round(
            (metrics.cushionBalance / metrics.avgMonthlyExpense) * 10,
          ) / 10,
        )
      : metrics.cushionBalance > 0
        ? 3
        : 0;
  const expenseRatio =
    metrics.income > 0
      ? Math.round((metrics.expense / metrics.income) * 100)
      : 0;

  let main = t(locale, "bizAdvisorProfit");
  if (metrics.income <= 0 && metrics.expense > 0) {
    main = t(locale, "bizAdvisorNoRevenue");
  } else if (metrics.expense > metrics.income && metrics.expense > 0) {
    main = t(locale, "bizAdvisorLoss");
  } else if (expenseRatio >= 45) {
    main = t(locale, "bizAdvisorExpenseRatio", { pct: String(expenseRatio) });
  } else if (metrics.income === 0 && metrics.expense === 0) {
    main = t(locale, "bizAdvisorEmpty");
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={onToggle}
      >
        <span className="font-semibold text-foreground">
          {t(locale, "bizAdvisorTitle")}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
          {t(locale, open ? "transactionsHide" : "transactionsShow")}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {main}
          </p>
          <div className="mt-2 grid gap-1 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              {t(locale, "bizAdvisorSafeWithdraw", {
                amount: formatMoney(safeWithdraw, locale),
              })}
            </p>
            <p>
              {t(locale, "bizAdvisorReserve", {
                months: String(reserveMonths),
              })}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function BusinessQuickEntry({
  locale,
  onQuickTx,
}: {
  locale: "ru" | "en";
  onQuickTx: (type: "income" | "expense", amount: number, note: string) => void;
}) {
  const [quickMode, setQuickMode] = useState<"income" | "expense" | null>(
    "income",
  );
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const submitQuick = () => {
    if (!quickMode) return;
    const n = parseMoneyAmount(quickAmount);
    if (!n) return;
    onQuickTx(quickMode, n, quickNote.trim());
    setQuickAmount("");
    setQuickNote("");
  };

  return (
    <div className="rounded-lg border border-border/80 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {t(locale, "bizQuickEntryTitle")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t(locale, "bizQuickEntryHint")}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant={quickMode === "income" ? "default" : "outline"}
          className={cn(
            quickMode === "income" && "bg-emerald-600 hover:bg-emerald-600/90",
          )}
          onClick={() => setQuickMode("income")}
        >
          + {t(locale, "bizUnitIncome")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={quickMode === "expense" ? "default" : "outline"}
          className={cn(
            quickMode === "expense" && "bg-red-600 hover:bg-red-600/90",
          )}
          onClick={() => setQuickMode("expense")}
        >
          − {t(locale, "bizUnitExpense")}
        </Button>
      </div>
      <div className="mt-2 grid gap-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder={t(locale, "txAmount")}
          value={quickAmount}
          onChange={(e) => setQuickAmount(e.target.value)}
        />
        <Input
          placeholder={t(locale, "bizTxNotePh")}
          value={quickNote}
          onChange={(e) => setQuickNote(e.target.value)}
        />
        <Button
          type="button"
          className="w-full"
          disabled={!quickAmount.trim()}
          onClick={submitQuick}
        >
          {t(locale, "bizQuickTxSave")}
        </Button>
      </div>
    </div>
  );
}

export function BusinessTab() {
  const locale = useStore((s) => s.locale);
  const period = useStatsPeriod();
  const periodLabel = formatBudgetPeriodLabel(period, locale);

  const units = useBusinessStore((s) => s.units);
  const transactions = useBusinessStore((s) => s.transactions);
  const assets = useBusinessStore((s) => s.assets);
  const selectedUnitId = useBusinessStore((s) => s.selectedUnitId);
  const setSelectedUnitId = useBusinessStore((s) => s.setSelectedUnitId);
  const addUnit = useBusinessStore((s) => s.addUnit);
  const updateUnitSettings = useBusinessStore((s) => s.updateUnitSettings);
  const removeUnit = useBusinessStore((s) => s.removeUnit);
  const addOperatingTx = useBusinessStore((s) => s.addOperatingTx);
  const transferToCushion = useBusinessStore((s) => s.transferToCushion);
  const transferToFamily = useBusinessStore((s) => s.transferToFamily);
  const removeTransaction = useBusinessStore((s) => s.removeTransaction);

  const visibleUnits = useMemo(() => visibleBusinessUnits(units), [units]);
  const activeUnitId = useMemo(
    () => resolveVisibleUnitId(units, selectedUnitId),
    [units, selectedUnitId],
  );

  const [ready, setReady] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [editUnitName, setEditUnitName] = useState("");
  const [editTaxRate, setEditTaxRate] = useState(0);
  const [editTaxPeriod, setEditTaxPeriod] =
    useState<BusinessTaxPeriod>("quarter");
  const [businessSection, setBusinessSection] =
    useState<BusinessSection>("operations");
  const [businessAdvisorOpen, setBusinessAdvisorOpen] = useState(true);
  const [businessPeriodOpen, setBusinessPeriodOpen] = useState(false);
  const [editTx, setEditTx] = useState<BusinessTransaction | null>(null);
  const [showBusinessHow, setShowBusinessHow] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (useBusinessStore.persist.hasHydrated()) setReady(true);
    return useBusinessStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    setShowBusinessHow(localStorage.getItem(BUSINESS_HOW_HIDDEN_KEY) !== "1");
  }, []);

  useEffect(() => {
    if (!ready) return;
    const s = useBusinessStore.getState();
    const nextId = resolveVisibleUnitId(s.units, s.selectedUnitId);
    if (nextId && nextId !== s.selectedUnitId) {
      s.setSelectedUnitId(nextId);
    }
  }, [ready, units, selectedUnitId]);

  const unitMetricsMap = useMemo(() => {
    const map = new Map<string, UnitCardMetrics>();
    for (const u of units) {
      map.set(u.id, unitCardMetrics(transactions, [], u, period));
    }
    return map;
  }, [units, transactions, period]);

  const incomeSources = useMemo(
    () => incomeSourcesForPeriod(transactions, period, activeUnitId),
    [transactions, period, activeUnitId],
  );

  const expenseBreakdown = useMemo(
    () => expenseBreakdownForPeriod(transactions, period, activeUnitId),
    [transactions, period, activeUnitId],
  );

  const recentTxs = useMemo(() => {
    if (!activeUnitId) return [];
    return transactions.filter((tx) => tx.unitId === activeUnitId).slice(0, 30);
  }, [transactions, activeUnitId]);

  const activeUnit = useMemo(
    () => visibleUnits.find((unit) => unit.id === activeUnitId) ?? null,
    [visibleUnits, activeUnitId],
  );
  const activeMetrics = useMemo(() => {
    if (!activeUnit) return null;
    return (
      unitMetricsMap.get(activeUnit.id) ??
      unitCardMetrics(transactions, [], activeUnit, period)
    );
  }, [activeUnit, unitMetricsMap, transactions, period]);
  const safeWithdraw = activeMetrics ? safeWithdrawAmount(activeMetrics) : 0;

  if (!ready) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t(locale, "bizLoading")}
      </p>
    );
  }

  const submitUnit = () => {
    const id = addUnit(newUnitName);
    if (id) {
      setNewUnitName("");
      setUnitDialogOpen(false);
    }
  };

  const openEditUnit = (unitId: string) => {
    const u = units.find((x) => x.id === unitId);
    if (!u) return;
    setEditUnitId(unitId);
    setEditUnitName(u.name);
    setEditTaxRate(u.taxRatePct ?? 0);
    setEditTaxPeriod(u.taxPeriod ?? "quarter");
    setSelectedUnitId(unitId);
  };

  const submitEditUnit = () => {
    if (!editUnitId) return;
    const name = editUnitName.trim();
    if (!name) return;
    updateUnitSettings(editUnitId, {
      name,
      taxRatePct: editTaxRate,
      taxPeriod: editTaxPeriod,
    });
    setEditUnitId(null);
    setEditUnitName("");
  };

  const deleteEditUnit = () => {
    if (!editUnitId) return;
    if (visibleUnits.length <= 1) {
      toast(t(locale, "bizUnitDeleteLast"), "error");
      return;
    }
    const unit = units.find((u) => u.id === editUnitId);
    if (unit && isProjectsServiceUnit(unit)) {
      toast(t(locale, "bizUnitDeleteProjectsHint"), "error");
      return;
    }
    const assetCount = assets.filter((a) => a.unitId === editUnitId).length;
    const txCount = transactions.filter(
      (tx) => tx.unitId === editUnitId,
    ).length;
    if (
      assetCount + txCount > 0 &&
      !window.confirm(
        t(locale, "bizUnitDeleteConfirm", {
          assets: String(assetCount),
          txs: String(txCount),
        }),
      )
    ) {
      return;
    }
    if (!removeUnit(editUnitId)) {
      toast(t(locale, "bizUnitDeleteLast"), "error");
      return;
    }
    setEditUnitId(null);
    setEditUnitName("");
    toast(t(locale, "bizUnitDeleted"), "success");
  };

  const editUnitIsProjects =
    editUnitId != null && isProjectsServiceUnit({ name: editUnitName });

  const hideBusinessHow = () => {
    setShowBusinessHow(false);
    localStorage.setItem(BUSINESS_HOW_HIDDEN_KEY, "1");
  };

  return (
    <div className="space-y-3 py-1">
      {process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? (
        <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          {t(locale, "bizPreviewBadge")}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BriefcaseBusiness className="h-5 w-5 text-primary" aria-hidden />
            {t(locale, "bizTitle")}
          </h2>
        </div>
        <LiveRatesBar />
      </div>

      <div className="space-y-2">
        <BusinessUnitTabs
          units={visibleUnits}
          activeUnitId={activeUnitId}
          metricsMap={unitMetricsMap}
          locale={locale}
          onSelect={setSelectedUnitId}
          onAdd={() => setUnitDialogOpen(true)}
        />
        {showBusinessHow ? (
          <div className="relative rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 pr-9 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">
              {t(locale, "bizHowTitle")}
            </p>
            <p>{t(locale, "bizHowBody")}</p>
            <button
              type="button"
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              onClick={hideBusinessHow}
              aria-label={t(locale, "bizHowDismiss")}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {activeUnit && activeMetrics ? (
        <>
          <BusinessKpis
            metrics={activeMetrics}
            safeWithdraw={safeWithdraw}
            locale={locale}
          />
          <BusinessAdvisor
            metrics={activeMetrics}
            safeWithdraw={safeWithdraw}
            locale={locale}
            open={businessAdvisorOpen}
            onToggle={() => setBusinessAdvisorOpen((v) => !v)}
          />
          <BusinessQuickEntry
            locale={locale}
            onQuickTx={(type, amount, note) => {
              addOperatingTx(activeUnit.id, type, amount, note);
              toast(
                type === "income"
                  ? t(locale, "bizVoiceIncomeOk", {
                      amount: formatMoney(amount, locale),
                    })
                  : t(locale, "bizVoiceExpenseOk", {
                      amount: formatMoney(amount, locale),
                    }),
                "success",
              );
            }}
          />

          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  "operations",
                  "reserve",
                  "tax",
                  "projects",
                ] as BusinessSection[]
              ).map((section) => {
                const labelKey = {
                  operations: "bizSectionOperations",
                  reserve: "bizSectionReserve",
                  tax: "bizSectionTax",
                  projects: "bizSectionProjects",
                }[section] as
                  | "bizSectionOperations"
                  | "bizSectionReserve"
                  | "bizSectionTax"
                  | "bizSectionProjects";
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setBusinessSection(section)}
                    className={cn(
                      "rounded-md px-1.5 py-2 text-[11px] font-medium transition-colors",
                      businessSection === section
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {t(locale, labelKey)}
                  </button>
                );
              })}
            </div>

            {businessSection === "operations" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-border/80 bg-card px-3 py-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setBusinessPeriodOpen((v) => !v)}
                  >
                    <span className="text-sm font-medium">
                      {t(locale, "bizPeriodSection")}: {periodLabel}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      {t(
                        locale,
                        businessPeriodOpen
                          ? "transactionsHide"
                          : "transactionsShow",
                      )}
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          businessPeriodOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>
                  {businessPeriodOpen ? (
                    <div className="mt-2 space-y-3">
                      <StatisticsPeriodControls />
                      <p className="text-[11px] text-muted-foreground">
                        {t(locale, "bizPeriodHint", { period: periodLabel })}
                      </p>
                      {incomeSources.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">
                            {t(locale, "bizIncomeSources")}
                          </p>
                          <div className="space-y-1.5">
                            {incomeSources.slice(0, 8).map((row) => (
                              <div
                                key={row.label}
                                className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-sm"
                              >
                                <span className="min-w-0 truncate">
                                  {row.label}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                  +{formatMoney(row.amount, locale)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {expenseBreakdown.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">
                            {t(locale, "bizExpenseBreakdown")}
                          </p>
                          <div className="space-y-1.5">
                            {expenseBreakdown.slice(0, 8).map((row) => (
                              <div
                                key={row.label}
                                className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-sm"
                              >
                                <span className="min-w-0 truncate">
                                  {row.label}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-red-700 dark:text-red-400">
                                  −{formatMoney(row.amount, locale)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {recentTxs.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium">
                            {t(locale, "bizRecentTx")}
                          </p>
                          <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                            {recentTxs.map((tx) => (
                              <li
                                key={tx.id}
                                className="flex items-center gap-2 rounded-md border border-border/80 px-2 py-1.5 text-sm"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs text-muted-foreground">
                                    {txKindLabel(tx, locale)} · {tx.date}
                                  </p>
                                  <p className="truncate">{tx.note}</p>
                                </div>
                                <span
                                  className={`shrink-0 font-semibold tabular-nums ${
                                    tx.type === "income"
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : "text-red-700 dark:text-red-400"
                                  }`}
                                >
                                  {tx.type === "income" ? "+" : "−"}
                                  {formatMoney(tx.amount, locale)}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  aria-label={t(locale, "txEdit")}
                                  onClick={() => setEditTx(tx)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  aria-label={t(locale, "txDelete")}
                                  onClick={() => removeTransaction(tx.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                          {t(locale, "bizNoRecentTx")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {businessSection === "reserve" ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t(locale, "bizCushionTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {t(locale, "bizCushionHint")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t(locale, "bizCushionShort")}
                      </p>
                      <p className="font-bold tabular-nums">
                        {formatMoney(activeMetrics.cushionBalance, locale)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        {t(locale, "bizTarget")}
                      </p>
                      <p className="font-bold tabular-nums">
                        {formatMoney(activeMetrics.cushionTarget, locale)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeMetrics.cushionBalance >= activeMetrics.cushionTarget
                      ? t(locale, "bizCushionFull")
                      : t(locale, "bizCushionGap", {
                          amount: formatMoney(
                            activeMetrics.cushionTarget -
                              activeMetrics.cushionBalance,
                            locale,
                          ),
                        })}
                  </p>
                  {activeMetrics.canToCushion > 0 ? (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() =>
                        transferToCushion(
                          activeUnit.id,
                          activeMetrics.canToCushion,
                        )
                      }
                    >
                      {t(locale, "bizUnitToCushion")}{" "}
                      {formatMoney(activeMetrics.canToCushion, locale)}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {businessSection === "tax" ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t(locale, "bizTaxTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {t(locale, "bizTaxHint")}
                  </p>
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {t(locale, "bizTaxReserve")}
                    </p>
                    <p className="font-bold tabular-nums">
                      {formatMoney(activeMetrics.taxReserve, locale)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {activeMetrics.taxRatePct > 0
                        ? t(locale, "bizTaxCurrent", {
                            rate: String(activeMetrics.taxRatePct),
                            period: taxPeriodLabel(
                              activeMetrics.taxPeriod,
                              locale,
                            ),
                          })
                        : t(locale, "bizTaxOff")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => openEditUnit(activeUnit.id)}
                  >
                    {t(locale, "bizTaxSetup")}
                  </Button>
                  {safeWithdraw > 0 ? (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() =>
                        transferToFamily(activeUnit.id, safeWithdraw)
                      }
                    >
                      {t(locale, "bizUnitToFamily")}{" "}
                      {formatMoney(safeWithdraw, locale)}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {businessSection === "projects" ? (
              <BusinessProjectsSection />
            ) : null}
          </div>
        </>
      ) : null}

      <BusinessTxEditDialog
        transaction={editTx}
        open={editTx !== null}
        onOpenChange={(open) => {
          if (!open) setEditTx(null);
        }}
      />

      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t(locale, "bizUnitAdd")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t(locale, "bizUnitNamePh")}
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            autoFocus
          />
          <Button type="button" className="w-full" onClick={submitUnit}>
            {t(locale, "bizSave")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editUnitId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditUnitId(null);
            setEditUnitName("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(locale, "bizUnitEdit")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t(locale, "bizUnitNamePh")}
            value={editUnitName}
            onChange={(e) => setEditUnitName(e.target.value)}
            autoFocus
          />
          <p className="text-xs font-medium text-muted-foreground">
            {t(locale, "bizUnitTaxSettings")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[0, 6, 13, 15, 20].map((pct) => (
              <Button
                key={pct}
                type="button"
                size="sm"
                variant={editTaxRate === pct ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setEditTaxRate(pct)}
              >
                {pct === 0 ? t(locale, "bizTaxOff") : `${pct}%`}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              ["month", "quarter", "halfyear", "year"] as BusinessTaxPeriod[]
            ).map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={editTaxPeriod === p ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => setEditTaxPeriod(p)}
              >
                {taxPeriodLabel(p, locale)}
              </Button>
            ))}
          </div>
          <Button type="button" className="w-full" onClick={submitEditUnit}>
            {t(locale, "bizSave")}
          </Button>
          {visibleUnits.length > 1 && !editUnitIsProjects ? (
            <div className="space-y-1 border-t border-border/60 pt-3">
              <p className="text-[11px] text-muted-foreground">
                {t(locale, "bizUnitDeleteHint")}
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={deleteEditUnit}
              >
                {t(locale, "bizUnitDelete")}
              </Button>
            </div>
          ) : null}
          {editUnitIsProjects ? (
            <p className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              {t(locale, "bizUnitDeleteProjectsHint")}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
