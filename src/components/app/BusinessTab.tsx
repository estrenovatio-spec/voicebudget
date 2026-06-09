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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BusinessProjectsSection } from "@/components/app/BusinessProjectsSection";
import { BusinessTxEditDialog } from "@/components/app/BusinessTxEditDialog";
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
  BusinessDebt,
  BusinessTransaction,
  BusinessUnit,
} from "@/lib/business/types";
import {
  formatBudgetPeriodLabel,
  isDateInBudgetPeriod,
  type BudgetPeriod,
} from "@/lib/budget-period";
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
const BUSINESS_ADVISOR_OPEN_KEY = "voicebudget-business-advisor-open";
const BUSINESS_ADVISOR_AI_CACHE_KEY = "voicebudget-business-advisor-ai-v1";
const BUSINESS_DEBT_STRATEGY_KEY = "voicebudget-business-debt-strategy";
type BusinessSection = "operations" | "reserve" | "tax" | "debts" | "projects";
type DebtRepaymentStrategy = "avalanche" | "snowball";
type BusinessAdvisorTone = "ok" | "warn" | "risk";
type BusinessAdvisorSignal = {
  label: string;
  text: string;
  tone: BusinessAdvisorTone;
};
type BusinessAiAdvice = {
  summary: string;
  action: string;
  tone: BusinessAdvisorTone;
};

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
  onEdit,
  onAdd,
}: {
  units: BusinessUnit[];
  activeUnitId: string | null;
  metricsMap: Map<string, UnitCardMetrics>;
  locale: "ru" | "en";
  onSelect: (unitId: string) => void;
  onEdit: (unitId: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-1 shadow-sm">
      <div
        className="flex flex-wrap items-stretch gap-1"
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
                "min-w-[7.25rem] flex-1 rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:bg-background/70 hover:text-foreground",
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
                  active
                    ? "text-primary-foreground/85"
                    : profit > 0
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
          className="flex min-h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label={t(locale, "bizUnitAdd")}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        {activeUnitId ? (
          <button
            type="button"
            onClick={() => onEdit(activeUnitId)}
            className="flex min-h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            aria-label={t(locale, "bizUnitEdit")}
            title={t(locale, "bizUnitEdit")}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function safeWithdrawAmount(metrics: UnitCardMetrics): number {
  return Math.max(
    0,
    Math.floor(metrics.operatingBalance - metrics.taxReserve - metrics.debtMinPayment),
  );
}

function debtStrategyLabel(strategy: DebtRepaymentStrategy, locale: "ru" | "en"): string {
  if (strategy === "snowball") return locale === "ru" ? "Снежный ком" : "Snowball";
  return locale === "ru" ? "Лавина" : "Avalanche";
}

function debtStrategyHelp(strategy: DebtRepaymentStrategy, locale: "ru" | "en"): string {
  if (strategy === "snowball") {
    return locale === "ru"
      ? "Снежный ком: сначала закрываем самый маленький долг. Это психологически легче: быстрее видна победа и меньше риск бросить план."
      : "Snowball: pay off the smallest debt first. It creates quick wins and helps you stay consistent.";
  }
  return locale === "ru"
    ? "Лавина: сначала гасим долг с самой высокой ставкой. Обычно это выгоднее математически: меньше переплата."
    : "Avalanche: pay the highest-rate debt first. It is usually mathematically better because it reduces overpayment.";
}

function sortBusinessDebtsByStrategy(
  debts: BusinessDebt[],
  strategy: DebtRepaymentStrategy,
): BusinessDebt[] {
  const today = new Date().toISOString().slice(0, 10);
  return [...debts].sort((a, b) => {
    const aOverdue = a.nextPaymentDate ? a.nextPaymentDate < today : false;
    const bOverdue = b.nextPaymentDate ? b.nextPaymentDate < today : false;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    if (strategy === "snowball") {
      if (a.balance !== b.balance) return a.balance - b.balance;
      return (b.ratePct ?? 0) - (a.ratePct ?? 0);
    }
    const ar = a.ratePct ?? -1;
    const br = b.ratePct ?? -1;
    if (br !== ar) return br - ar;
    return a.balance - b.balance;
  });
}

function businessAdSpendForPeriod(
  transactions: BusinessTransaction[],
  unitId: string,
  period: BudgetPeriod,
): number {
  const adTokens = [
    "реклам",
    "маркет",
    "таргет",
    "директ",
    "яндекс",
    "vk",
    "вк",
    "ads",
    "advert",
    "marketing",
    "direct",
    "target",
    "seo",
    "smm",
  ];
  return transactions.reduce((sum, tx) => {
    if (tx.unitId !== unitId || tx.kind !== "operating_expense") return sum;
    if (!isDateInBudgetPeriod(tx.date, period)) return sum;
    const note = tx.note.toLowerCase();
    if (!adTokens.some((token) => note.includes(token))) return sum;
    return sum + tx.amount;
  }, 0);
}

function BusinessTotalBalance({
  income,
  expense,
  profit,
  safeWithdraw,
  locale,
}: {
  income: number;
  expense: number;
  profit: number;
  safeWithdraw: number;
  locale: "ru" | "en";
}) {
  const rowClass =
    "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2";
  const labelClass = "min-w-0 text-sm font-semibold leading-tight text-foreground";
  const amountClass = "shrink-0 text-sm font-semibold tabular-nums";

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-card px-3 py-2.5 shadow-sm">
      <div className="flex w-full flex-col gap-y-0.5">
        <div className={rowClass}>
          <span className={labelClass}>{t(locale, "bizKpiRevenue")}:</span>
          <span className={cn(amountClass, "text-emerald-700 dark:text-emerald-400")}>
            +{formatMoney(income, locale)}
          </span>
        </div>
        <div className={rowClass}>
          <span className={labelClass}>{t(locale, "bizKpiExpenses")}:</span>
          <span className={cn(amountClass, "text-red-700 dark:text-red-400")}>
            −{formatMoney(expense, locale)}
          </span>
        </div>
        <div className={rowClass}>
          <span className={labelClass}>{t(locale, "bizUnitProfit")}:</span>
          <span
            className={cn(
              amountClass,
              profit >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-700 dark:text-red-400",
            )}
          >
            {profit >= 0 ? "+" : "−"}
            {formatMoney(Math.abs(profit), locale)}
          </span>
        </div>
        <div className={rowClass}>
          <span className={labelClass}>{t(locale, "bizCanWithdraw")}:</span>
          <span
            className={cn(
              amountClass,
              safeWithdraw > 0 ? "text-primary" : "text-muted-foreground",
            )}
          >
            {formatMoney(safeWithdraw, locale)}
          </span>
        </div>
      </div>
    </div>
  );
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
  const mainItems = [
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
  ];
  const supportItems = [
    {
      label: locale === "ru" ? "Резерв" : "Reserve",
      value: `${formatMoney(metrics.cushionBalance, locale)} / ${formatMoney(metrics.cushionTarget, locale)}`,
      tone: "text-amber-700 dark:text-amber-300",
    },
    {
      label: locale === "ru" ? "Налог" : "Tax",
      value: formatMoney(metrics.taxReserve, locale),
      tone:
        metrics.taxReserve > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-muted-foreground",
    },
    {
      label: locale === "ru" ? "Долг" : "Debt",
      value: formatMoney(metrics.debtBalance, locale),
      tone:
        metrics.debtBalance > 0
          ? "text-amber-700 dark:text-amber-300"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="rounded-lg border border-border/80 bg-card px-2.5 py-2">
      <div className="grid grid-cols-2 gap-1.5">
        {mainItems.map((item) => (
          <div key={item.label} className="min-w-0 rounded-md bg-muted/55 px-2 py-1.5">
            <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground">
              {item.label}
            </p>
            <p className={cn("mt-0.5 break-words text-[13px] font-bold leading-tight tabular-nums", item.tone)}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {supportItems.map((item) => (
          <div key={item.label} className="min-w-0 rounded-md border border-border/60 px-1.5 py-1.5">
            <p className="truncate text-[9px] font-medium leading-tight text-muted-foreground">
              {item.label}
            </p>
            <p className={cn("mt-0.5 break-words text-[11px] font-bold leading-tight tabular-nums", item.tone)}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessAdvisor({
  metrics,
  safeWithdraw,
  adSpend,
  locale,
  open,
  onToggle,
}: {
  metrics: UnitCardMetrics;
  safeWithdraw: number;
  adSpend: number;
  locale: "ru" | "en";
  open: boolean;
  onToggle: () => void;
}) {
  const isRu = locale === "ru";
  const [aiAdvice, setAiAdvice] = useState<BusinessAiAdvice | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
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
  const margin = Math.round(metrics.profitMarginPct);
  const adShare = metrics.income > 0 ? Math.round((adSpend / metrics.income) * 100) : 0;
  const cashNeeded = Math.max(0, metrics.taxReserve + metrics.debtMinPayment);
  const cashGap = metrics.operatingBalance - cashNeeded;

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

  const signals: BusinessAdvisorSignal[] = [];
  const addSignal = (signal: { label: string; text: string; tone?: BusinessAdvisorTone }) => {
    signals.push({ ...signal, tone: signal.tone ?? "ok" });
  };

  addSignal({
    label: isRu ? "Можно вывести" : "Can withdraw",
    text:
      safeWithdraw > 0
        ? isRu
          ? `Безопасно к выводу сейчас: ${formatMoney(safeWithdraw, locale)}. Это после налога и минимальных платежей.`
          : `Safe to withdraw now: ${formatMoney(safeWithdraw, locale)} after tax and minimum payments.`
        : isRu
          ? "К выводу лучше не забирать: сначала закрыть налог, минимальные платежи и резерв."
          : "Better not withdraw yet: cover tax, minimum payments, and reserve first.",
    tone: safeWithdraw > 0 ? "ok" : "risk",
  });

  addSignal({
    label: isRu ? "Маржинальность" : "Margin",
    text:
      metrics.income <= 0
        ? isRu
          ? "Маржу пока считать рано: нет выручки за период."
          : "Too early to read margin: no revenue this period."
        : margin < 0
          ? isRu
            ? `Маржа ${margin}%. Бизнес продаёт ниже расходов — нужен разбор цены, себестоимости и рекламы.`
            : `Margin is ${margin}%. Sales are below costs — review pricing, cost base, and ads.`
          : margin < 20
            ? isRu
              ? `Маржа ${margin}%. Зона внимания: небольшой сбой в расходах может съесть прибыль.`
              : `Margin is ${margin}%. Watch closely: a small cost jump can erase profit.`
            : isRu
              ? `Маржа ${margin}%. Есть пространство для резерва, налога и аккуратного вывода.`
              : `Margin is ${margin}%. There is room for reserve, tax, and careful withdrawal.`,
    tone: metrics.income <= 0 ? "warn" : margin < 0 ? "risk" : margin < 20 ? "warn" : "ok",
  });

  if (adSpend > 0) {
    addSignal({
      label: isRu ? "Реклама" : "Ads",
      text:
        metrics.income > 0
          ? isRu
            ? `На рекламу ушло ${formatMoney(adSpend, locale)} (${adShare}% выручки). Проверьте: сколько заявок/продаж дал этот расход.`
            : `Ad spend is ${formatMoney(adSpend, locale)} (${adShare}% of revenue). Check leads/sales from this spend.`
          : isRu
            ? `На рекламу ушло ${formatMoney(adSpend, locale)}, но выручки за период нет. Это тревожный сигнал по окупаемости.`
            : `Ad spend is ${formatMoney(adSpend, locale)}, but there is no revenue this period. ROI risk signal.`,
      tone: metrics.income <= 0 || adShare >= 25 ? "risk" : adShare >= 12 ? "warn" : "ok",
    });
  }

  addSignal({
    label: isRu ? "Кассовый разрыв" : "Cash gap",
    text:
      cashGap < 0
        ? isRu
          ? `Не хватает ${formatMoney(Math.abs(cashGap), locale)} до налога и обязательных платежей. Вывод денег лучше поставить на паузу.`
          : `${formatMoney(Math.abs(cashGap), locale)} short for tax and required payments. Pause withdrawals.`
        : isRu
          ? `После налога и обязательных платежей остаётся запас ${formatMoney(cashGap, locale)}.`
          : `After tax and required payments, buffer is ${formatMoney(cashGap, locale)}.`,
    tone: cashGap < 0 ? "risk" : cashGap < metrics.avgMonthlyExpense * 0.5 ? "warn" : "ok",
  });

  addSignal({
    label: isRu ? "Резерв" : "Reserve",
    text:
      reserveMonths >= 3
        ? isRu
          ? `Резерв закрывает ${reserveMonths} мес расходов. Это сильная позиция для собственника.`
          : `Reserve covers ${reserveMonths} months of expenses. Strong owner position.`
        : isRu
          ? `Резерв закрывает ${reserveMonths} мес из цели 3 мес. До активного вывода лучше постепенно усилить запас.`
          : `Reserve covers ${reserveMonths} of 3 target months. Strengthen it before aggressive withdrawals.`,
    tone: reserveMonths >= 3 ? "ok" : reserveMonths >= 1 ? "warn" : "risk",
  });

  if (metrics.taxReserve > 0) {
    addSignal({
      label: isRu ? "Налог" : "Tax",
      text: isRu
        ? `Отложить под налог: ${formatMoney(metrics.taxReserve, locale)}. Эти деньги не считать прибылью собственника.`
        : `Set aside for tax: ${formatMoney(metrics.taxReserve, locale)}. Do not treat it as owner profit.`,
      tone: "warn",
    });
  }

  const visibleSignals = signals.slice(0, 6);
  const visibleSignalKey = visibleSignals
    .map((signal) => `${signal.label}:${signal.tone}`)
    .join("|");
  const adviceCacheId = [
    locale,
    metrics.unitId,
    metrics.income,
    metrics.expense,
    metrics.profit,
    margin,
    safeWithdraw,
    adSpend,
    adShare,
    metrics.taxReserve,
    reserveMonths,
    metrics.debtMinPayment,
    cashGap,
    visibleSignalKey,
  ].join(":");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const readCachedAdvice = () => {
      try {
        const cached = localStorage.getItem(BUSINESS_ADVISOR_AI_CACHE_KEY);
        if (!cached) return null;
        const parsed = JSON.parse(cached) as {
          cacheId?: string;
          advice?: BusinessAiAdvice;
        };
        if (parsed.cacheId !== adviceCacheId || !parsed.advice) return null;
        return parsed.advice;
      } catch {
        return null;
      }
    };

    const cachedAdvice = readCachedAdvice();
    if (cachedAdvice) {
      setAiAdvice(cachedAdvice);
      setAiLoading(false);
      return;
    }

    setAiLoading(true);
    setAiAdvice(null);
    fetch("/api/business-advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        metrics: {
          income: metrics.income,
          expense: metrics.expense,
          profit: metrics.profit,
          margin,
          safeWithdraw,
          adSpend,
          adShare,
          taxReserve: metrics.taxReserve,
          reserveMonths,
          debtMinPayment: metrics.debtMinPayment,
          cashGap,
        },
        signals: visibleSignals,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const advice = data?.advice as BusinessAiAdvice | undefined;
        if (cancelled || !advice) return;
        setAiAdvice(advice);
        try {
          localStorage.setItem(
            BUSINESS_ADVISOR_AI_CACHE_KEY,
            JSON.stringify({ cacheId: adviceCacheId, advice }),
          );
        } catch {
          // localStorage can be unavailable in private/embedded contexts.
        }
      })
      .catch(() => {
        if (!cancelled) setAiAdvice(null);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    adShare,
    adSpend,
    adviceCacheId,
    cashGap,
    locale,
    margin,
    metrics.debtMinPayment,
    metrics.expense,
    metrics.income,
    metrics.profit,
    metrics.taxReserve,
    open,
    reserveMonths,
    safeWithdraw,
    visibleSignalKey,
  ]);

  const toneClass = (tone: BusinessAdvisorTone) =>
    tone === "risk"
      ? "border-red-500/20 bg-red-500/5 text-red-900 dark:text-red-100"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-100"
        : "border-emerald-500/20 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100";

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
          {aiAdvice ? (
            <div
              className={cn(
                "mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-relaxed",
                toneClass(aiAdvice.tone),
              )}
            >
              <p className="font-semibold">
                {isRu ? "ИИ-вывод финсоветника" : "Advisor AI insight"}
              </p>
              <p className="mt-0.5">{aiAdvice.summary}</p>
              <p className="mt-1">
                <span className="font-semibold">
                  {isRu ? "Действие: " : "Action: "}
                </span>
                {aiAdvice.action}
              </p>
            </div>
          ) : aiLoading ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {isRu
                ? "ИИ формулирует короткий вывод по бизнесу..."
                : "AI is preparing a short business insight..."}
            </p>
          ) : null}
          <div className="mt-2 grid gap-1.5">
            {visibleSignals.map((signal) => (
              <div
                key={signal.label}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px] leading-relaxed",
                  toneClass(signal.tone),
                )}
              >
                <span className="font-semibold">{signal.label}: </span>
                <span>{signal.text}</span>
              </div>
            ))}
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

function BusinessFamilyWithdrawal({
  amount,
  locale,
  onTransfer,
}: {
  amount: number;
  locale: "ru" | "en";
  onTransfer: () => void;
}) {
  const canTransfer = amount > 0;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {locale === "ru" ? "Вывод в семью" : "Family withdrawal"}
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {canTransfer
              ? locale === "ru"
                ? "Перенести доступную сумму из бизнеса в семейный бюджет."
                : "Move the available business money to the family budget."
              : locale === "ru"
                ? "После налога и обязательств пока нет безопасной суммы к выводу."
                : "There is no safe withdrawal after tax and obligations yet."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="max-w-[11rem] shrink-0 whitespace-normal text-right leading-tight"
          variant={canTransfer ? "default" : "outline"}
          disabled={!canTransfer}
          onClick={onTransfer}
        >
          {t(locale, "bizUnitToFamily")}{" "}
          {formatMoney(Math.max(0, amount), locale)}
        </Button>
      </div>
    </div>
  );
}

export function BusinessTab({ headerControls }: { headerControls?: ReactNode }) {
  const locale = useStore((s) => s.locale);
  const period = useStatsPeriod();
  const periodLabel = formatBudgetPeriodLabel(period, locale);

  const units = useBusinessStore((s) => s.units);
  const transactions = useBusinessStore((s) => s.transactions);
  const assets = useBusinessStore((s) => s.assets);
  const debts = useBusinessStore((s) => s.debts);
  const selectedUnitId = useBusinessStore((s) => s.selectedUnitId);
  const setSelectedUnitId = useBusinessStore((s) => s.setSelectedUnitId);
  const addUnit = useBusinessStore((s) => s.addUnit);
  const updateUnitSettings = useBusinessStore((s) => s.updateUnitSettings);
  const removeUnit = useBusinessStore((s) => s.removeUnit);
  const addOperatingTx = useBusinessStore((s) => s.addOperatingTx);
  const transferToCushion = useBusinessStore((s) => s.transferToCushion);
  const transferToFamily = useBusinessStore((s) => s.transferToFamily);
  const removeTransaction = useBusinessStore((s) => s.removeTransaction);
  const addDebt = useBusinessStore((s) => s.addDebt);
  const updateDebt = useBusinessStore((s) => s.updateDebt);
  const payDebt = useBusinessStore((s) => s.payDebt);
  const removeDebt = useBusinessStore((s) => s.removeDebt);

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
  const [businessPeriodOpen, setBusinessPeriodOpen] = useState(true);
  const [cushionAmount, setCushionAmount] = useState("");
  const [debtName, setDebtName] = useState("");
  const [debtBalance, setDebtBalance] = useState("");
  const [debtMinPayment, setDebtMinPayment] = useState("");
  const [debtRate, setDebtRate] = useState("");
  const [debtDate, setDebtDate] = useState("");
  const [businessDebtStrategy, setBusinessDebtStrategy] =
    useState<DebtRepaymentStrategy>("avalanche");
  const [debtPayId, setDebtPayId] = useState<string | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const [editDebtName, setEditDebtName] = useState("");
  const [editDebtBalance, setEditDebtBalance] = useState("");
  const [editDebtMinPayment, setEditDebtMinPayment] = useState("");
  const [editDebtRate, setEditDebtRate] = useState("");
  const [editDebtDate, setEditDebtDate] = useState("");
  const [editTx, setEditTx] = useState<BusinessTransaction | null>(null);
  const [showBusinessHow, setShowBusinessHow] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (useBusinessStore.persist.hasHydrated()) setReady(true);
    return useBusinessStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    setShowBusinessHow(localStorage.getItem(BUSINESS_HOW_HIDDEN_KEY) !== "1");
    setBusinessAdvisorOpen(
      localStorage.getItem(BUSINESS_ADVISOR_OPEN_KEY) !== "0",
    );
    const storedDebtStrategy = localStorage.getItem(BUSINESS_DEBT_STRATEGY_KEY);
    if (storedDebtStrategy === "snowball" || storedDebtStrategy === "avalanche") {
      setBusinessDebtStrategy(storedDebtStrategy);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BUSINESS_DEBT_STRATEGY_KEY, businessDebtStrategy);
  }, [businessDebtStrategy]);

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
      map.set(u.id, unitCardMetrics(transactions, [], u, period, new Date(), debts));
    }
    return map;
  }, [units, transactions, period, debts]);

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
      unitCardMetrics(transactions, [], activeUnit, period, new Date(), debts)
    );
  }, [activeUnit, unitMetricsMap, transactions, period, debts]);
  const totalMetrics = useMemo(() => {
    return visibleUnits.reduce(
      (acc, unit) => {
        const metrics = unitMetricsMap.get(unit.id);
        if (!metrics) return acc;
        acc.income += metrics.income;
        acc.expense += metrics.expense;
        acc.profit += metrics.profit;
        acc.safeWithdraw += safeWithdrawAmount(metrics);
        return acc;
      },
      { income: 0, expense: 0, profit: 0, safeWithdraw: 0 },
    );
  }, [visibleUnits, unitMetricsMap]);
  const safeWithdraw = activeMetrics ? safeWithdrawAmount(activeMetrics) : 0;
  const activeDebts = useMemo(
    () => (activeUnitId ? debts.filter((d) => d.unitId === activeUnitId) : []),
    [debts, activeUnitId],
  );
  const sortedActiveDebts = useMemo(
    () => sortBusinessDebtsByStrategy(activeDebts, businessDebtStrategy),
    [activeDebts, businessDebtStrategy],
  );
  const activeAdSpend = useMemo(
    () =>
      activeUnit
        ? businessAdSpendForPeriod(transactions, activeUnit.id, period)
        : 0,
    [activeUnit, period, transactions],
  );

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
    toast(locale === "ru" ? "Бизнес сохранён" : "Business saved", "success");
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
    const debtCount = debts.filter((d) => d.unitId === editUnitId).length;
    const txCount = transactions.filter(
      (tx) => tx.unitId === editUnitId,
    ).length;
    if (
      assetCount + txCount > 0 &&
      !window.confirm(
        t(locale, "bizUnitDeleteConfirm", {
          assets: String(assetCount),
          txs: String(txCount),
          debts: String(debtCount),
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

  const toggleBusinessAdvisor = () => {
    setBusinessAdvisorOpen((open) => {
      const next = !open;
      localStorage.setItem(BUSINESS_ADVISOR_OPEN_KEY, next ? "1" : "0");
      return next;
    });
  };

  const submitCushionAmount = () => {
    if (!activeUnit || !activeMetrics) return;
    const amount = parseMoneyAmount(cushionAmount);
    if (!amount || amount > activeMetrics.canToCushion) {
      toast(t(locale, "bizCushionInvalid"), "error");
      return;
    }
    transferToCushion(activeUnit.id, amount);
    setCushionAmount("");
    toast(
      t(locale, "bizVoiceCushionOk", {
        amount: formatMoney(amount, locale),
      }),
      "success",
    );
  };

  const submitBusinessDebt = () => {
    if (!activeUnit) return;
    const name = debtName.trim();
    const balance = parseMoneyAmount(debtBalance);
    if (!name || !balance) return;
    addDebt(activeUnit.id, {
      name,
      balance,
      minPayment: parseMoneyAmount(debtMinPayment) ?? 0,
      ratePct: debtRate.trim() ? (parseMoneyAmount(debtRate) ?? 0) : null,
      nextPaymentDate: debtDate.trim() || null,
      priority: "normal",
    });
    setDebtName("");
    setDebtBalance("");
    setDebtMinPayment("");
    setDebtRate("");
    setDebtDate("");
  };

  const submitBusinessDebtPayment = (debt: BusinessDebt) => {
    const amount = parseMoneyAmount(debtPayAmount);
    if (!amount) return;
    payDebt(debt.id, amount);
    setDebtPayId(null);
    setDebtPayAmount("");
    toast(
      locale === "ru"
        ? `Платёж по долгу: ${formatMoney(amount, locale)}`
        : `Debt payment: ${formatMoney(amount, locale)}`,
      "success",
    );
  };

  const startEditBusinessDebt = (debt: BusinessDebt) => {
    setEditDebtId(debt.id);
    setEditDebtName(debt.name);
    setEditDebtBalance(String(debt.balance || ""));
    setEditDebtMinPayment(String(debt.minPayment || ""));
    setEditDebtRate(debt.ratePct == null ? "" : String(debt.ratePct));
    setEditDebtDate(debt.nextPaymentDate ?? "");
    setDebtPayId(null);
  };

  const cancelEditBusinessDebt = () => {
    setEditDebtId(null);
    setEditDebtName("");
    setEditDebtBalance("");
    setEditDebtMinPayment("");
    setEditDebtRate("");
    setEditDebtDate("");
  };

  const saveEditBusinessDebt = (debt: BusinessDebt) => {
    const name = editDebtName.trim();
    const balance = parseMoneyAmount(editDebtBalance);
    if (!name || balance == null) return;
    updateDebt(debt.id, {
      name,
      balance,
      minPayment: parseMoneyAmount(editDebtMinPayment) ?? 0,
      ratePct: editDebtRate.trim() ? (parseMoneyAmount(editDebtRate) ?? 0) : null,
      nextPaymentDate: editDebtDate.trim() || null,
    });
    cancelEditBusinessDebt();
  };

  return (
    <div className="space-y-3 py-1">
      {process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? (
        <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          {t(locale, "bizPreviewBadge")}
        </span>
      ) : null}
      {headerControls ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <BusinessTotalBalance
              income={totalMetrics.income}
              expense={totalMetrics.expense}
              profit={totalMetrics.profit}
              safeWithdraw={totalMetrics.safeWithdraw}
              locale={locale}
            />
          </div>
          {headerControls}
        </div>
      ) : (
        <>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <BriefcaseBusiness
                className="h-5 w-5 text-primary"
                aria-hidden
              />
              {t(locale, "bizTitle")}
            </h2>
          </div>
          <BusinessTotalBalance
            income={totalMetrics.income}
            expense={totalMetrics.expense}
            profit={totalMetrics.profit}
            safeWithdraw={totalMetrics.safeWithdraw}
            locale={locale}
          />
        </>
      )}

      <div className="space-y-2">
        <BusinessUnitTabs
          units={visibleUnits}
          activeUnitId={activeUnitId}
          metricsMap={unitMetricsMap}
          locale={locale}
          onSelect={setSelectedUnitId}
          onEdit={openEditUnit}
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
            adSpend={activeAdSpend}
            locale={locale}
            open={businessAdvisorOpen}
            onToggle={toggleBusinessAdvisor}
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
          <BusinessFamilyWithdrawal
            amount={safeWithdraw}
            locale={locale}
            onTransfer={() => {
              const ok = transferToFamily(activeUnit.id, safeWithdraw);
              toast(
                ok
                  ? t(locale, "bizVoiceFamilyOk", {
                      amount: formatMoney(safeWithdraw, locale),
                    })
                  : t(locale, "bizVoiceFamilyFail"),
                ok ? "success" : "error",
              );
            }}
          />

          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="grid grid-cols-6 gap-1 rounded-lg border border-primary/20 bg-primary/10 p-1 shadow-sm">
              {(
                [
                  "operations",
                  "reserve",
                  "tax",
                  "debts",
                  "projects",
                ] as BusinessSection[]
              ).map((section) => {
                const labelKey = {
                  operations: "bizSectionOperations",
                  reserve: "bizSectionReserve",
                  tax: "bizSectionTax",
                  debts: null,
                  projects: "bizSectionProjects",
                }[section] as
                  | "bizSectionOperations"
                  | "bizSectionReserve"
                  | "bizSectionTax"
                  | "bizSectionProjects"
                  | null;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setBusinessSection(section)}
                    className={cn(
                      "min-h-9 rounded-md px-2 py-1.5 text-xs font-semibold leading-tight transition-colors",
                      section === "operations" || section === "reserve" || section === "tax"
                        ? "col-span-2"
                        : "col-span-3",
                      businessSection === section
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/70 hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    {labelKey ? t(locale, labelKey) : locale === "ru" ? "Долги" : "Debts"}
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
                    <div className="space-y-2 rounded-lg border border-border/80 bg-background p-2">
                      <div className="space-y-1">
                        <label
                          htmlFor="business-cushion-amount"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          {t(locale, "bizCushionAmountLabel")}
                        </label>
                        <Input
                          id="business-cushion-amount"
                          type="text"
                          inputMode="decimal"
                          placeholder={t(locale, "bizCushionAmountPh")}
                          value={cushionAmount}
                          onChange={(e) => setCushionAmount(e.target.value)}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t(locale, "bizCushionRecommended", {
                          amount: formatMoney(
                            activeMetrics.canToCushion,
                            locale,
                          ),
                        })}
                      </p>
                      <Button
                        type="button"
                        className="w-full"
                        disabled={!cushionAmount.trim()}
                        onClick={submitCushionAmount}
                      >
                        {t(locale, "bizCushionSubmit")}
                      </Button>
                    </div>
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
                </CardContent>
              </Card>
            ) : null}

            {businessSection === "debts" ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {locale === "ru" ? "Долги и обязательства" : "Debts and obligations"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {locale === "ru"
                      ? "Эти платежи уменьшают сумму «можно вывести». Сначала обязательства, налог и резерв — потом вывод собственнику."
                      : "These payments reduce safe withdrawal. Obligations, tax, and reserve come before owner withdrawal."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        {locale === "ru" ? "Остаток долгов" : "Debt balance"}
                      </p>
                      <p className="font-bold tabular-nums">
                        {formatMoney(activeMetrics.debtBalance, locale)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        {locale === "ru" ? "Мин. платёж" : "Min payment"}
                      </p>
                      <p className="font-bold tabular-nums">
                        {formatMoney(activeMetrics.debtMinPayment, locale)}
                      </p>
                    </div>
                  </div>

                  {activeDebts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-border/80 bg-background p-2">
                        <p className="text-xs font-medium text-foreground">
                          {locale === "ru" ? "Стратегия погашения" : "Repayment strategy"}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {locale === "ru"
                            ? "Выберите один раз — долги ниже сами встанут в нужном порядке."
                            : "Choose once — debts below will sort themselves in the right order."}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          {(["avalanche", "snowball"] as DebtRepaymentStrategy[]).map((strategy) => (
                            <div key={strategy} className="flex min-w-0 rounded-md border border-input bg-muted/30 p-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant={businessDebtStrategy === strategy ? "default" : "ghost"}
                                className="min-w-0 flex-1 px-1.5 text-xs"
                                onClick={() => setBusinessDebtStrategy(strategy)}
                              >
                                <span className="truncate">
                                  {debtStrategyLabel(strategy, locale)}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-7 shrink-0 text-xs font-bold"
                                aria-label={debtStrategyHelp(strategy, locale)}
                                title={debtStrategyHelp(strategy, locale)}
                                onClick={() => window.alert(debtStrategyHelp(strategy, locale))}
                              >
                                !
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                      {sortedActiveDebts.map((debt, index) => {
                        const overdue = debt.nextPaymentDate ? debt.nextPaymentDate < new Date().toISOString().slice(0, 10) : false;
                        return (
                          <div key={debt.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium leading-tight">{debt.name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {index === 0
                                    ? locale === "ru"
                                      ? "Гасить первым · "
                                      : "Pay first · "
                                    : locale === "ru"
                                      ? `Очередь ${index + 1} · `
                                      : `Order ${index + 1} · `}
                                  {debt.ratePct ? `${debt.ratePct}% · ` : ""}
                                  {debt.nextPaymentDate ?? (locale === "ru" ? "дата не задана" : "no date")}
                                </p>
                                <p className="mt-1 font-semibold tabular-nums">
                                  {formatMoney(debt.balance, locale)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {locale === "ru" ? "Мин. платёж: " : "Min payment: "}
                                  {formatMoney(debt.minPayment, locale)}
                                </p>
                                {overdue ? (
                                  <p className="text-xs font-medium text-destructive">
                                    {locale === "ru" ? "Платёж просрочен" : "Payment overdue"}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() => startEditBusinessDebt(debt)}
                                  aria-label={locale === "ru" ? "Редактировать долг" : "Edit debt"}
                                  title={locale === "ru" ? "Редактировать долг" : "Edit debt"}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => removeDebt(debt.id)}
                                  aria-label={t(locale, "txDelete")}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            {editDebtId === debt.id ? (
                              <div className="mt-2 space-y-2 rounded-md border border-border/80 bg-background p-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    placeholder={locale === "ru" ? "Название" : "Name"}
                                    value={editDebtName}
                                    onChange={(e) => setEditDebtName(e.target.value)}
                                  />
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={locale === "ru" ? "Остаток" : "Balance"}
                                    value={editDebtBalance}
                                    onChange={(e) => setEditDebtBalance(e.target.value)}
                                  />
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={locale === "ru" ? "Мин. платёж" : "Min payment"}
                                    value={editDebtMinPayment}
                                    onChange={(e) => setEditDebtMinPayment(e.target.value)}
                                  />
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={locale === "ru" ? "Ставка %" : "Rate %"}
                                    value={editDebtRate}
                                    onChange={(e) => setEditDebtRate(e.target.value)}
                                  />
                                </div>
                                <Input
                                  type="date"
                                  value={editDebtDate}
                                  onChange={(e) => setEditDebtDate(e.target.value)}
                                  aria-label={locale === "ru" ? "Дата платежа" : "Payment date"}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="flex-1" onClick={() => saveEditBusinessDebt(debt)}>
                                    {locale === "ru" ? "Сохранить" : "Save"}
                                  </Button>
                                  <Button size="sm" variant="outline" className="flex-1" onClick={cancelEditBusinessDebt}>
                                    {locale === "ru" ? "Отмена" : "Cancel"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                            {debtPayId === debt.id ? (
                              <div className="mt-2 flex gap-2">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder={locale === "ru" ? "Сумма платежа" : "Payment amount"}
                                  value={debtPayAmount}
                                  onChange={(e) => setDebtPayAmount(e.target.value)}
                                />
                                <Button size="sm" onClick={() => submitBusinessDebtPayment(debt)}>
                                  OK
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => setDebtPayId(debt.id)}
                              >
                                {locale === "ru" ? "Внести платёж" : "Add payment"}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="space-y-2 rounded-lg border border-border/80 bg-background p-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder={locale === "ru" ? "Название" : "Name"}
                        value={debtName}
                        onChange={(e) => setDebtName(e.target.value)}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={locale === "ru" ? "Остаток" : "Balance"}
                        value={debtBalance}
                        onChange={(e) => setDebtBalance(e.target.value)}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={locale === "ru" ? "Мин. платёж" : "Min payment"}
                        value={debtMinPayment}
                        onChange={(e) => setDebtMinPayment(e.target.value)}
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={locale === "ru" ? "Ставка %" : "Rate %"}
                        value={debtRate}
                        onChange={(e) => setDebtRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {locale === "ru" ? "Дата платежа" : "Payment date"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-full text-xs font-semibold"
                          aria-label={
                            locale === "ru"
                              ? "Что значит дата платежа"
                              : "What payment date means"
                          }
                          title={
                            locale === "ru"
                              ? "Что значит дата платежа"
                              : "What payment date means"
                          }
                          onClick={() =>
                            window.alert(
                              locale === "ru"
                                ? "Это дата ближайшего обязательного платежа или день, когда долг нужно отдать. Она нужна, чтобы не пропустить срок."
                                : "This is the next required payment date or the date when the debt is due. It helps you avoid missing the deadline.",
                            )
                          }
                        >
                          !
                        </Button>
                      </div>
                      <Input
                        type="date"
                        value={debtDate}
                        onChange={(e) => setDebtDate(e.target.value)}
                        aria-label={locale === "ru" ? "Дата платежа" : "Payment date"}
                      />
                    </div>
                    <Button type="button" className="w-full" onClick={submitBusinessDebt}>
                      {locale === "ru" ? "Добавить обязательство" : "Add obligation"}
                    </Button>
                  </div>
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
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="biz-edit-tax-rate"
            >
              {t(locale, "bizTaxCustomRate")}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="biz-edit-tax-rate"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={editTaxRate > 0 ? String(editTaxRate) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(",", ".");
                  const next = raw.trim() ? Number(raw) : 0;
                  setEditTaxRate(Number.isFinite(next) ? next : 0);
                }}
                placeholder="6"
              />
              <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                %
              </span>
            </div>
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
