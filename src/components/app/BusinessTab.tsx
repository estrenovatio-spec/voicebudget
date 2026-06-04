"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Cloud,
  Clock,
  LineChart,
  Percent,
  PiggyBank,
  Plus,
  Receipt,
  Shield,
  Trash2,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BusinessVoiceInput } from "@/components/app/BusinessVoiceInput";
import { StatisticsPeriodControls } from "@/components/StatisticsPeriodControls";
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
  assetAnnualYieldPct,
  assetEffectiveHourlyRate,
  expenseBreakdownForPeriod,
  groupAssetsByType,
  impliedOperatingHourlyRate,
  incomeSourcesForPeriod,
  periodOperatingStats,
  typeAssetsSummary,
  unitPeriodStats,
} from "@/lib/business/analytics";
import type { BusinessAsset, BusinessAssetType, BusinessTransaction, BusinessUnit } from "@/lib/business/types";
import { formatBudgetPeriodLabel } from "@/lib/budget-period";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { useBusinessSnapshot, useBusinessStore } from "@/store/useBusinessStore";
import { useStatsPeriod, useStore } from "@/store/useStore";
import { useCloudStore } from "@/store/useCloudStore";

function formatRub(n: number, locale: "ru" | "en"): string {
  return `${formatMoney(n, locale)} ${t(locale, "currency")}`;
}

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

function AssetIcon({ type }: { type: BusinessAssetType }) {
  if (type === "rental") return <Building2 className="h-4 w-4 text-primary" aria-hidden />;
  if (type === "freelance") return <Wallet className="h-4 w-4 text-primary" aria-hidden />;
  return <LineChart className="h-4 w-4 text-primary" aria-hidden />;
}

function assetTypeLabel(type: BusinessAssetType, locale: "ru" | "en"): string {
  if (type === "rental") return t(locale, "bizAssetRental");
  if (type === "freelance") return t(locale, "bizAssetFreelance");
  return t(locale, "bizAssetInvestment");
}

function KpiChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: "green" | "amber" | "blue";
}) {
  const bg =
    accent === "green"
      ? "bg-emerald-500/10"
      : accent === "amber"
        ? "bg-amber-500/10"
        : accent === "blue"
          ? "bg-blue-500/10"
          : "bg-muted/60";
  return (
    <div className={`rounded-lg px-2.5 py-2 text-center ${bg}`}>
      <div className="mx-auto mb-0.5 flex h-5 w-5 items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function UnitCard({
  unit,
  stats,
  selected,
  locale,
  onSelect,
}: {
  unit: BusinessUnit;
  stats: { income: number; expense: number; remaining: number };
  selected: boolean;
  locale: "ru" | "en";
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex min-h-[7.5rem] flex-col rounded-xl border-2 p-3 text-left transition-shadow",
        selected ? "border-primary shadow-md ring-2 ring-primary/20" : "border-border/80 hover:border-primary/40",
      ].join(" ")}
      style={{ borderTopColor: unit.color, borderTopWidth: 4 }}
    >
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{unit.name}</p>
      <div className="mt-auto space-y-0.5 pt-2 text-[11px] tabular-nums">
        <p className="text-emerald-700 dark:text-emerald-400">
          {t(locale, "bizUnitIn")} +{formatMoney(stats.income, locale)}
        </p>
        <p className="text-red-700 dark:text-red-400">
          {t(locale, "bizUnitOut")} −{formatMoney(stats.expense, locale)}
        </p>
        <p className="font-semibold text-foreground">
          {t(locale, "bizUnitLeft")} {formatMoney(stats.remaining, locale)}
        </p>
      </div>
    </button>
  );
}

function AssetRow({
  asset,
  locale,
  onRemove,
}: {
  asset: BusinessAsset;
  locale: "ru" | "en";
  onRemove: () => void;
}) {
  const yieldPct = assetAnnualYieldPct(asset);
  const effectiveHourly = assetEffectiveHourlyRate(asset);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border/80 p-2.5">
      <AssetIcon type={asset.type} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-tight">{asset.name}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
          {asset.capitalValue > 0 ? (
            <span className="text-muted-foreground">
              {t(locale, "bizAssetCapital")}: {formatMoney(asset.capitalValue, locale)}
            </span>
          ) : null}
          <span className="text-emerald-700 dark:text-emerald-400">
            +{formatMoney(asset.monthlyNet, locale)}/{t(locale, "bizPerMonth")}
          </span>
          {yieldPct > 0 ? (
            <span className="text-primary">
              {yieldPct}% {t(locale, "bizPerYear")}
            </span>
          ) : null}
          {effectiveHourly > 0 ? (
            <span className="font-medium text-foreground">
              {formatMoney(effectiveHourly, locale)}/{t(locale, "bizPerHour")}
            </span>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground"
        aria-label={t(locale, "txDelete")}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AssetTypeSection({
  type,
  assets,
  locale,
  onRemove,
}: {
  type: BusinessAssetType;
  assets: BusinessAsset[];
  locale: "ru" | "en";
  onRemove: (id: string) => void;
}) {
  if (assets.length === 0) return null;
  const summary = typeAssetsSummary(assets, type);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <AssetIcon type={type} />
          {assetTypeLabel(type, locale)}
        </p>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {summary.capital > 0
            ? t(locale, "bizTypeSummary", {
                capital: formatMoney(summary.capital, locale),
                monthly: formatMoney(summary.monthlyNet, locale),
                yield: String(summary.yieldPct),
              })
            : `+${formatMoney(summary.monthlyNet, locale)}/${t(locale, "bizPerMonth")}`}
        </span>
      </div>
      {assets.map((a) => (
        <AssetRow key={a.id} asset={a} locale={locale} onRemove={() => onRemove(a.id)} />
      ))}
    </div>
  );
}

export function BusinessTab() {
  const locale = useStore((s) => s.locale);
  const period = useStatsPeriod();
  const periodLabel = formatBudgetPeriodLabel(period, locale);
  const cloudToken = useCloudStore((s) => s.token);
  const cloudSyncedAt = useBusinessStore((s) => s.cloudSyncedAt);

  const units = useBusinessStore((s) => s.units);
  const transactions = useBusinessStore((s) => s.transactions);
  const assets = useBusinessStore((s) => s.assets);
  const taxRatePct = useBusinessStore((s) => s.taxRatePct);
  const selectedUnitId = useBusinessStore((s) => s.selectedUnitId);
  const setSelectedUnitId = useBusinessStore((s) => s.setSelectedUnitId);
  const setTaxRatePct = useBusinessStore((s) => s.setTaxRatePct);
  const setUnitHourlyRate = useBusinessStore((s) => s.setUnitHourlyRate);
  const addUnit = useBusinessStore((s) => s.addUnit);
  const addOperatingTx = useBusinessStore((s) => s.addOperatingTx);
  const transferToCushion = useBusinessStore((s) => s.transferToCushion);
  const transferToFamily = useBusinessStore((s) => s.transferToFamily);
  const removeTransaction = useBusinessStore((s) => s.removeTransaction);
  const addAsset = useBusinessStore((s) => s.addAsset);
  const removeAsset = useBusinessStore((s) => s.removeAsset);

  const activeUnitId = selectedUnitId ?? units[0]?.id ?? null;
  const snap = useBusinessSnapshot(activeUnitId);

  const [ready, setReady] = useState(false);
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [assetType, setAssetType] = useState<BusinessAssetType>("investment");
  const [assetName, setAssetName] = useState("");
  const [assetCapital, setAssetCapital] = useState("");
  const [assetMonthly, setAssetMonthly] = useState("");
  const [assetHours, setAssetHours] = useState("");
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [showExpenses, setShowExpenses] = useState(true);

  useEffect(() => {
    if (useBusinessStore.persist.hasHydrated()) setReady(true);
    return useBusinessStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const s = useBusinessStore.getState();
    if (!s.selectedUnitId && s.units[0]) {
      s.setSelectedUnitId(s.units[0].id);
    }
  }, [ready]);

  const unitStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof unitPeriodStats>>();
    for (const u of units) {
      map.set(u.id, unitPeriodStats(transactions, u.id, period));
    }
    return map;
  }, [units, transactions, period]);

  const periodStats = useMemo(
    () => periodOperatingStats(transactions, period, activeUnitId),
    [transactions, period, activeUnitId],
  );

  const incomeSources = useMemo(
    () => incomeSourcesForPeriod(transactions, period, activeUnitId),
    [transactions, period, activeUnitId],
  );

  const expenseBreakdown = useMemo(
    () => expenseBreakdownForPeriod(transactions, period, activeUnitId),
    [transactions, period, activeUnitId],
  );

  const assetsByType = useMemo(
    () => groupAssetsByType(assets, activeUnitId),
    [assets, activeUnitId],
  );

  const recentTxs = useMemo(() => {
    if (!activeUnitId) return [];
    return transactions.filter((tx) => tx.unitId === activeUnitId).slice(0, 30);
  }, [transactions, activeUnitId]);

  const cushionPct = useMemo(() => {
    if (snap.cushionTarget <= 0) return snap.cushionBalance > 0 ? 100 : 0;
    return Math.min(100, Math.round((snap.cushionBalance / snap.cushionTarget) * 100));
  }, [snap.cushionBalance, snap.cushionTarget]);

  if (!ready) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{t(locale, "bizLoading")}</p>
    );
  }

  const submitTx = () => {
    if (!activeUnitId) return;
    const n = Number(String(txAmount).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    addOperatingTx(activeUnitId, txType, n, txNote);
    setTxAmount("");
    setTxNote("");
  };

  const submitUnit = () => {
    const id = addUnit(newUnitName);
    if (id) {
      setNewUnitName("");
      setUnitDialogOpen(false);
    }
  };

  const submitAsset = () => {
    if (!activeUnitId) return;
    const cap = Number(String(assetCapital).replace(/\s/g, "").replace(",", ".")) || 0;
    const monthly = Number(String(assetMonthly).replace(/\s/g, "").replace(",", "."));
    const hours = Number(String(assetHours).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(monthly) || monthly < 0 || !assetName.trim()) return;
    addAsset(activeUnitId, assetType, assetName, cap, monthly, hours);
    setAssetOpen(false);
    setAssetName("");
    setAssetCapital("");
    setAssetMonthly("");
    setAssetHours("");
  };

  const activeUnitName = units.find((u) => u.id === activeUnitId)?.name ?? t(locale, "bizTitle");
  const activeUnit = units.find((u) => u.id === activeUnitId);
  const targetHourly = activeUnit?.hourlyRate ?? 0;
  const impliedHourly = impliedOperatingHourlyRate(snap.monthProfit);
  const hasAssets =
    assetsByType.investment.length + assetsByType.rental.length + assetsByType.freelance.length > 0;

  return (
    <div className="space-y-3 py-1">
      <span className="inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
        {t(locale, "bizPreviewBadge")}
      </span>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BriefcaseBusiness className="h-5 w-5 text-primary" aria-hidden />
            {t(locale, "bizTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(locale, "bizSubtitle")}</p>
        </div>
        {cloudToken && cloudSyncedAt ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Cloud className="h-3 w-3" aria-hidden />
            {t(locale, "bizCloudOk")}
          </span>
        ) : null}
      </div>

      {activeUnitId ? (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/8">
          <CardContent className="space-y-1 pt-4">
            <p className="text-xs font-medium text-muted-foreground">{activeUnitName}</p>
            <p className="text-[11px] text-muted-foreground">{t(locale, "bizPulse")}</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">
              {formatRub(snap.operatingBalance, locale)}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums">
              <span className="text-muted-foreground">
                {t(locale, "bizCushionShort")}: {formatMoney(snap.cushionBalance, locale)}
              </span>
              {snap.totalCapital > 0 ? (
                <span className="text-muted-foreground">
                  {t(locale, "bizCapitalShort")}: {formatMoney(snap.totalCapital, locale)}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <BusinessVoiceInput unitId={activeUnitId} />

      <StatisticsPeriodControls />

      <p className="text-[11px] text-muted-foreground">
        {t(locale, "bizPeriodHint", { period: periodLabel })}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {units.map((unit) => {
          const stats = unitStatsMap.get(unit.id) ?? { income: 0, expense: 0, remaining: 0 };
          return (
            <UnitCard
              key={unit.id}
              unit={unit}
              stats={stats}
              selected={unit.id === activeUnitId}
              locale={locale}
              onSelect={() => setSelectedUnitId(unit.id)}
            />
          );
        })}
        <button
          type="button"
          onClick={() => setUnitDialogOpen(true)}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/80 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-6 w-6" aria-hidden />
          <span className="text-xs font-medium">{t(locale, "bizUnitAdd")}</span>
        </button>
      </div>

      {activeUnitId ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t(locale, "bizPnlTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-emerald-500/10 px-2 py-2">
                  <p className="text-muted-foreground">{t(locale, "bizPeriodIncome")}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    +{formatMoney(periodStats.income, locale)}
                  </p>
                </div>
                <div className="rounded-lg bg-red-500/10 px-2 py-2">
                  <p className="text-muted-foreground">{t(locale, "bizPeriodExpense")}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-red-700 dark:text-red-400">
                    −{formatMoney(periodStats.expense, locale)}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 px-2 py-2">
                  <p className="text-muted-foreground">{t(locale, "bizPeriodProfit")}</p>
                  <p
                    className={`mt-0.5 font-semibold tabular-nums ${
                      periodStats.profit >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {periodStats.profit >= 0 ? "+" : "−"}
                    {formatMoney(Math.abs(periodStats.profit), locale)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <KpiChip
                  icon={<Percent className="h-3.5 w-3.5" />}
                  label={t(locale, "bizKpiMargin")}
                  value={`${periodStats.profitMarginPct}%`}
                  accent={periodStats.profitMarginPct >= 20 ? "green" : "amber"}
                />
                <KpiChip
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label={t(locale, "bizKpiRunway")}
                  value={
                    snap.runwayMonths >= 99
                      ? "∞"
                      : t(locale, "bizKpiMonths", { n: String(snap.runwayMonths) })
                  }
                  accent="blue"
                />
                <KpiChip
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  label={t(locale, "bizKpiPassive")}
                  value={`+${formatMoney(snap.passiveIncomeMonthly, locale)}`}
                  accent="green"
                />
                <KpiChip
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label={t(locale, "bizKpiBurn")}
                  value={formatMoney(snap.avgMonthlyExpense, locale)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t(locale, "bizMonthSnapshot", {
                  income: formatMoney(snap.monthIncome, locale),
                  expense: formatMoney(snap.monthExpense, locale),
                  profit: formatMoney(snap.monthProfit, locale),
                })}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" aria-hidden />
                {t(locale, "bizHourlyTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">{t(locale, "bizHourlyHint")}</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={t(locale, "bizHourlyPh")}
                  value={hourlyRateInput || (targetHourly > 0 ? String(targetHourly) : "")}
                  onChange={(e) => setHourlyRateInput(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    if (!activeUnitId) return;
                    const n = Number(String(hourlyRateInput).replace(/\s/g, "").replace(",", "."));
                    if (!Number.isFinite(n) || n <= 0) return;
                    setUnitHourlyRate(activeUnitId, n);
                    setHourlyRateInput("");
                  }}
                >
                  {t(locale, "bizSave")}
                </Button>
              </div>
              {targetHourly > 0 ? (
                <p className="text-lg font-bold tabular-nums">
                  {formatMoney(targetHourly, locale)} {t(locale, "bizPerHour")}
                </p>
              ) : null}
              {impliedHourly > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t(locale, "bizHourlyImplied", {
                    amount: formatMoney(impliedHourly, locale),
                  })}
                  {targetHourly > 0 && impliedHourly < targetHourly
                    ? ` · ${t(locale, "bizHourlyBelowTarget", {
                        pct: String(Math.round(((targetHourly - impliedHourly) / targetHourly) * 100)),
                      })}`
                    : targetHourly > 0 && impliedHourly >= targetHourly
                      ? ` · ${t(locale, "bizHourlyOnTarget")}`
                      : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PiggyBank className="h-4 w-4 text-primary" aria-hidden />
                {t(locale, "bizCushionTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">{t(locale, "bizCushionHint")}</p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold tabular-nums">{formatRub(snap.cushionBalance, locale)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(locale, "bizCushionTarget", { amount: formatMoney(snap.cushionTarget, locale) })}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${cushionPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t(locale, "bizAvgBurn", { amount: formatMoney(snap.avgMonthlyExpense, locale) })}
                {snap.cushionGap > 0
                  ? ` · ${t(locale, "bizCushionGap", { amount: formatMoney(snap.cushionGap, locale) })}`
                  : ` · ${t(locale, "bizCushionFull")}`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-10 flex-col gap-0.5 py-2 text-xs"
                  disabled={snap.canToCushion <= 0}
                  onClick={() => transferToCushion(activeUnitId, snap.canToCushion)}
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
                  {t(locale, "bizToCushion")}
                  <span className="font-semibold tabular-nums">{formatMoney(snap.canToCushion, locale)}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-10 flex-col gap-0.5 py-2 text-xs"
                  disabled={snap.canToFamily <= 0}
                  onClick={() => transferToFamily(activeUnitId, snap.canToFamily)}
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden />
                  {t(locale, "bizToFamily")}
                  <span className="font-semibold tabular-nums">{formatMoney(snap.canToFamily, locale)}</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t(locale, "bizFamilyLinkHint")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-primary" aria-hidden />
                {t(locale, "bizTaxTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">{t(locale, "bizTaxHint")}</p>
              <div className="flex flex-wrap gap-1.5">
                {[0, 6, 13, 15, 20].map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    size="sm"
                    variant={taxRatePct === pct ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setTaxRatePct(pct)}
                  >
                    {pct === 0 ? t(locale, "bizTaxOff") : `${pct}%`}
                  </Button>
                ))}
              </div>
              {taxRatePct > 0 ? (
                <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs">
                  <p className="font-medium">{t(locale, "bizTaxReserve")}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">
                    {formatRub(snap.suggestedTaxReserve, locale)}
                  </p>
                  <p className="text-muted-foreground">
                    {t(locale, "bizTaxFromIncome", {
                      rate: String(taxRatePct),
                      income: formatMoney(snap.monthIncome, locale),
                    })}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" aria-hidden />
                {t(locale, "bizAssetsTitle")}
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setAssetOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t(locale, "bizAssetAdd")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasAssets ? (
                <p className="text-xs text-muted-foreground">{t(locale, "bizAssetsEmpty")}</p>
              ) : (
                <>
                  {snap.totalCapital > 0 ? (
                    <div className="rounded-lg bg-primary/8 px-3 py-2 text-xs">
                      <p className="font-medium">{t(locale, "bizPortfolioSummary")}</p>
                      <p className="mt-0.5 tabular-nums text-muted-foreground">
                        {t(locale, "bizAssetsTotal", {
                          capital: formatMoney(snap.totalCapital, locale),
                          income: formatMoney(snap.assetsAnnualIncome, locale),
                        })}
                        {snap.weightedYieldPct > 0
                          ? ` · ${t(locale, "bizWeightedYield", { pct: String(snap.weightedYieldPct) })}`
                          : ""}
                      </p>
                    </div>
                  ) : null}
                  <AssetTypeSection
                    type="investment"
                    assets={assetsByType.investment}
                    locale={locale}
                    onRemove={removeAsset}
                  />
                  <AssetTypeSection
                    type="rental"
                    assets={assetsByType.rental}
                    locale={locale}
                    onRemove={removeAsset}
                  />
                  <AssetTypeSection
                    type="freelance"
                    assets={assetsByType.freelance}
                    locale={locale}
                    onRemove={removeAsset}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {incomeSources.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t(locale, "bizIncomeSources")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {incomeSources.slice(0, 10).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{row.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      +{formatMoney(row.amount, locale)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {expenseBreakdown.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between"
                  onClick={() => setShowExpenses((v) => !v)}
                >
                  <CardTitle className="text-base">{t(locale, "bizExpenseBreakdown")}</CardTitle>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${showExpenses ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
              </CardHeader>
              {showExpenses ? (
                <CardContent className="space-y-1.5">
                  {expenseBreakdown.slice(0, 12).map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{row.label}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-red-700 dark:text-red-400">
                        −{formatMoney(row.amount, locale)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t(locale, "bizAddTx")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={txType === "expense" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setTxType("expense")}
                >
                  {t(locale, "expense")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={txType === "income" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setTxType("income")}
                >
                  {t(locale, "income")}
                </Button>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={t(locale, "txAmount")}
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
              <Input
                placeholder={t(locale, "txCommentPlaceholder")}
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
              />
              <Button type="button" className="w-full" onClick={submitTx}>
                {t(locale, "fallbackSubmit")}
              </Button>
            </CardContent>
          </Card>

          {recentTxs.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t(locale, "bizRecentTx")}</p>
              <ul className="space-y-1">
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
                      aria-label={t(locale, "txDelete")}
                      onClick={() => removeTransaction(tx.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

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

      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(locale, "bizAssetAdd")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t(locale, "bizAssetDialogHint")}</p>
          <div className="flex gap-2">
            {(["investment", "rental", "freelance"] as BusinessAssetType[]).map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={assetType === kind ? "default" : "outline"}
                className="flex-1 text-[11px]"
                onClick={() => setAssetType(kind)}
              >
                {assetTypeLabel(kind, locale)}
              </Button>
            ))}
          </div>
          <Input
            placeholder={t(locale, "bizAssetNamePh")}
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder={t(locale, "bizAssetCapitalPh")}
            value={assetCapital}
            onChange={(e) => setAssetCapital(e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder={t(locale, "bizAssetMonthlyPh")}
            value={assetMonthly}
            onChange={(e) => setAssetMonthly(e.target.value)}
          />
          {assetType === "freelance" ? (
            <Input
              type="number"
              inputMode="numeric"
              placeholder={t(locale, "bizAssetHoursPh")}
              value={assetHours}
              onChange={(e) => setAssetHours(e.target.value)}
            />
          ) : null}
          <Button type="button" className="w-full" onClick={submitAsset}>
            {t(locale, "bizSave")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
