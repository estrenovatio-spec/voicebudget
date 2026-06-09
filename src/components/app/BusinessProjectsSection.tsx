"use client";

import { Building2, LineChart, Pencil, Plus, Shield, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { PassiveTransferDialog } from "@/components/app/PassiveTransferDialog";
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
  assetAnnualYieldPct,
  assetEffectiveHourlyRate,
  assetsSummary,
  groupAssetsByType,
  typeAssetsSummary,
  weightedPortfolioYieldPct,
} from "@/lib/business/analytics";
import { PassiveReceiptHistory } from "@/components/app/PassiveReceiptHistory";
import { RentalUtilitiesHistory } from "@/components/app/RentalUtilitiesHistory";
import { passiveReceivedTotal } from "@/lib/business/passive";
import { parseMoneyAmount } from "@/lib/business/parse-input";
import {
  currentUtilitiesMonthKey,
  utilitiesAmountForMonth,
} from "@/lib/business/housing-utilities-log";
import {
  rentalEffectiveMonthlyNet,
  rentalUtilitiesForMonth,
} from "@/lib/business/rental-utilities";
import type { BusinessAsset, BusinessAssetType } from "@/lib/business/types";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useStore } from "@/store/useStore";

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

function AssetRow({
  asset,
  locale,
  receipts,
  receivedTotal,
  onTransfer,
  onEdit,
  onRemove,
}: {
  asset: BusinessAsset;
  locale: "ru" | "en";
  receipts: ReturnType<typeof useBusinessStore.getState>["passiveReceipts"];
  receivedTotal: number;
  onTransfer: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const yieldPct = assetAnnualYieldPct(asset);
  const effectiveHourly = assetEffectiveHourlyRate(asset);
  const utilities = rentalUtilitiesForMonth(asset);
  const netMonthly = rentalEffectiveMonthlyNet(asset);

  return (
    <div className="space-y-1.5 rounded-lg border border-border/80 p-2.5">
      <div className="flex items-start gap-2">
        <AssetIcon type={asset.type} />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{asset.name}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
            {asset.capitalValue > 0 ? (
              <span className="text-muted-foreground">
                {t(locale, "bizAssetCapital")}: {formatMoney(asset.capitalValue, locale)}
              </span>
            ) : null}
            {asset.type === "rental" && utilities > 0 ? (
              <>
                <span className="text-muted-foreground">
                  {t(locale, "projectsAssetPlanGross", {
                    amount: formatMoney(asset.monthlyNet, locale),
                    perMonth: t(locale, "bizPerMonth"),
                  })}
                </span>
                <span className="text-amber-800 dark:text-amber-300">
                  {t(locale, "projectsAssetUtilities", {
                    amount: formatMoney(utilities, locale),
                  })}
                </span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {t(locale, "projectsAssetNetAfterUtilities", {
                    amount: formatMoney(netMonthly, locale),
                    perMonth: t(locale, "bizPerMonth"),
                  })}
                </span>
              </>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400">
                +{formatMoney(asset.monthlyNet, locale)}/{t(locale, "bizPerMonth")}
              </span>
            )}
            {yieldPct > 0 ? (
              <span className="font-medium text-primary">
                {yieldPct}% {t(locale, "bizPerYear")}
              </span>
            ) : null}
            {effectiveHourly > 0 ? (
              <span className="font-medium text-foreground">
                {formatMoney(effectiveHourly, locale)}/{t(locale, "bizPerHour")}
              </span>
            ) : null}
          </div>
          {receivedTotal > 0 ? (
            <p className="mt-1 text-[10px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {t(locale, "projectsReceivedTotal", { amount: formatMoney(receivedTotal, locale) })}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={onTransfer}
          >
            {t(locale, "projectsToFamily")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t(locale, "bizUnitEdit")}
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label={t(locale, "txDelete")}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {asset.type === "rental" ? (
        <RentalUtilitiesHistory asset={asset} locale={locale} compact />
      ) : null}
      <PassiveReceiptHistory receipts={receipts} assetId={asset.id} locale={locale} />
    </div>
  );
}

function AssetTypeSection({
  type,
  assets,
  locale,
  receipts,
  onTransfer,
  onEdit,
  onRemove,
}: {
  type: BusinessAssetType;
  assets: BusinessAsset[];
  locale: "ru" | "en";
  receipts: ReturnType<typeof useBusinessStore.getState>["passiveReceipts"];
  onTransfer: (asset: BusinessAsset) => void;
  onEdit: (asset: BusinessAsset) => void;
  onRemove: (asset: BusinessAsset) => void;
}) {
  if (assets.length === 0) return null;
  const summary = typeAssetsSummary(assets, type);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <AssetIcon type={type} />
          {assetTypeLabel(type, locale)}
        </p>
        <span className="text-right text-[11px] tabular-nums text-muted-foreground">
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
        <AssetRow
          key={a.id}
          asset={a}
          locale={locale}
          receipts={receipts}
          receivedTotal={passiveReceivedTotal(receipts, a.id)}
          onTransfer={() => onTransfer(a)}
          onEdit={() => onEdit(a)}
          onRemove={() => onRemove(a)}
        />
      ))}
    </div>
  );
}

function SourceMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/45 px-2.5 py-2">
      <p className="text-[10px] font-medium leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function FreelancerFlowCard({
  locale,
  clients,
  plannedMonthly,
  receivedTotal,
}: {
  locale: "ru" | "en";
  clients: number;
  plannedMonthly: number;
  receivedTotal: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {t(locale, "bizFreelanceFlowTitle")}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {t(locale, "bizFreelanceFlowHint")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SourceMetric
          label={t(locale, "bizFreelanceClients")}
          value={String(clients)}
        />
        <SourceMetric
          label={t(locale, "bizFreelancePlan")}
          value={`+${formatMoney(plannedMonthly, locale)}`}
        />
        <SourceMetric
          label={t(locale, "bizFreelanceReceived")}
          value={formatMoney(receivedTotal, locale)}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px] leading-tight text-muted-foreground">
        <span className="rounded-md bg-background/70 px-2 py-1">
          {t(locale, "bizFreelanceStep1")}
        </span>
        <span className="rounded-md bg-background/70 px-2 py-1">
          {t(locale, "bizFreelanceStep2")}
        </span>
        <span className="rounded-md bg-background/70 px-2 py-1">
          {t(locale, "bizFreelanceStep3")}
        </span>
        <span className="rounded-md bg-background/70 px-2 py-1">
          {t(locale, "bizFreelanceStep4")}
        </span>
      </div>
    </div>
  );
}

export function BusinessProjectsSection() {
  const locale = useStore((s) => s.locale);
  const assets = useBusinessStore((s) => s.assets);
  const receipts = useBusinessStore((s) => s.passiveReceipts);
  const addAsset = useBusinessStore((s) => s.addAsset);
  const removeAsset = useBusinessStore((s) => s.removeAsset);
  const updateAsset = useBusinessStore((s) => s.updateAsset);
  const setAssetUtilitiesMonth = useBusinessStore((s) => s.setAssetUtilitiesMonth);
  const transferPassiveToFamily = useBusinessStore((s) => s.transferPassiveToFamily);
  const ensureProjectsUnitId = useBusinessStore((s) => s.ensureProjectsUnitId);
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<BusinessAsset | null>(null);
  const [transferAsset, setTransferAsset] = useState<BusinessAsset | null>(null);
  const [assetType, setAssetType] = useState<BusinessAssetType>("freelance");
  const [assetName, setAssetName] = useState("");
  const [assetCapital, setAssetCapital] = useState("");
  const [assetMonthly, setAssetMonthly] = useState("");
  const [assetHours, setAssetHours] = useState("");
  const [editName, setEditName] = useState("");
  const [editCapital, setEditCapital] = useState("");
  const [editMonthly, setEditMonthly] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editUtilities, setEditUtilities] = useState("");
  const [editUtilitiesMonth, setEditUtilitiesMonth] = useState(() => currentUtilitiesMonthKey());

  const assetsByType = useMemo(() => groupAssetsByType(assets, null), [assets]);
  const portfolio = useMemo(() => assetsSummary(assets, null), [assets]);
  const portfolioMonthly = useMemo(
    () => Math.round(portfolio.annualIncome / 12),
    [portfolio.annualIncome],
  );
  const weightedYield = useMemo(() => weightedPortfolioYieldPct(assets), [assets]);
  const totalReceivedAll = useMemo(
    () => receipts.reduce((s, r) => s + r.amount, 0),
    [receipts],
  );
  const freelanceAssets = assetsByType.freelance;
  const freelanceMonthly = useMemo(
    () => freelanceAssets.reduce((s, a) => s + a.monthlyNet, 0),
    [freelanceAssets],
  );
  const freelanceReceived = useMemo(() => {
    const ids = new Set(freelanceAssets.map((a) => a.id));
    return receipts.reduce((sum, receipt) => {
      if (!ids.has(receipt.assetId)) return sum;
      return sum + receipt.amount;
    }, 0);
  }, [freelanceAssets, receipts]);

  const hasAssets =
    assetsByType.investment.length +
      assetsByType.rental.length +
      assetsByType.freelance.length >
    0;

  const submitAdd = () => {
    if (!assetName.trim()) {
      toast(t(locale, "bizAssetNameRequired"), "error");
      return;
    }
    const cap = parseMoneyAmount(assetCapital) ?? 0;
    const monthly = parseMoneyAmount(assetMonthly) ?? 0;
    const hours = parseMoneyAmount(assetHours) ?? undefined;
    addAsset(ensureProjectsUnitId(), assetType, assetName, cap, monthly, hours);
    setAddOpen(false);
    setAssetName("");
    setAssetCapital("");
    setAssetMonthly("");
    setAssetHours("");
    toast(t(locale, "bizAssetSaved"), "success");
  };

  const openEdit = (a: BusinessAsset) => {
    setEditAsset(a);
    setEditName(a.name);
    setEditCapital(String(a.capitalValue || ""));
    setEditMonthly(String(a.monthlyNet || ""));
    setEditHours(String(a.hoursPerMonth || ""));
    setEditUtilitiesMonth(currentUtilitiesMonthKey());
    const utils = utilitiesAmountForMonth(a, currentUtilitiesMonthKey());
    setEditUtilities(utils > 0 ? String(utils) : "");
  };

  const submitEdit = () => {
    if (!editAsset || !editName.trim()) return;
    updateAsset(editAsset.id, {
      name: editName,
      capitalValue: parseMoneyAmount(editCapital) ?? 0,
      monthlyNet: parseMoneyAmount(editMonthly) ?? 0,
      hoursPerMonth: parseMoneyAmount(editHours) ?? 0,
    });
    if (editAsset.type === "rental") {
      const utilitiesRub = parseMoneyAmount(editUtilities) ?? 0;
      setAssetUtilitiesMonth(editAsset.id, editUtilitiesMonth, utilitiesRub);
    }
    setEditAsset(null);
    toast(t(locale, "bizSave"), "success");
  };

  const confirmRemoveAsset = (asset: BusinessAsset) => {
    if (!window.confirm(t(locale, "bizAssetDeleteConfirm", { name: asset.name }))) return;
    removeAsset(asset.id);
    toast(t(locale, "bizAssetDeleted"), "success");
  };

  const confirmTransfer = (amount: number, date: string) => {
    if (!transferAsset) return;
    if (!transferPassiveToFamily(transferAsset.id, amount, date)) {
      toast(t(locale, "projectsTransferFail"), "error");
      return;
    }
    toast(
      t(locale, "projectsTransferOk", { amount: formatMoney(amount, locale) }),
      "success",
    );
    setTransferAsset(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" aria-hidden />
            {t(locale, "bizAssetsTitle")}
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t(locale, "bizAssetAdd")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed">
            <p className="font-medium text-foreground">{t(locale, "bizProjectsHowTitle")}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>{t(locale, "bizProjectsHow1")}</li>
              <li>{t(locale, "bizProjectsHow2")}</li>
              <li>{t(locale, "bizProjectsHow3")}</li>
            </ul>
          </div>
          <FreelancerFlowCard
            locale={locale}
            clients={freelanceAssets.length}
            plannedMonthly={freelanceMonthly}
            receivedTotal={freelanceReceived}
          />

          {!hasAssets ? (
            <p className="text-xs text-muted-foreground">{t(locale, "bizAssetsEmpty")}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <SourceMetric
                  label={t(locale, "bizSourcesMonthly")}
                  value={`+${formatMoney(portfolioMonthly, locale)}`}
                />
                <SourceMetric
                  label={t(locale, "bizSourcesCapital")}
                  value={formatMoney(portfolio.totalCapital, locale)}
                />
                <SourceMetric
                  label={t(locale, "bizSourcesFamily")}
                  value={formatMoney(totalReceivedAll, locale)}
                />
              </div>
              {portfolio.totalCapital > 0 ? (
                <div className="rounded-lg bg-primary/8 px-3 py-2 text-xs">
                  <p className="font-medium">{t(locale, "bizPortfolioSummary")}</p>
                  <p className="mt-0.5 tabular-nums text-muted-foreground">
                    {t(locale, "bizAssetsTotal", {
                      capital: formatMoney(portfolio.totalCapital, locale),
                      income: formatMoney(portfolio.annualIncome, locale),
                    })}
                    {weightedYield > 0
                      ? ` · ${t(locale, "bizWeightedYield", { pct: String(weightedYield) })}`
                      : ""}
                  </p>
                </div>
              ) : null}
              <AssetTypeSection
                type="freelance"
                assets={assetsByType.freelance}
                locale={locale}
                receipts={receipts}
                onTransfer={setTransferAsset}
                onEdit={openEdit}
                onRemove={confirmRemoveAsset}
              />
              <AssetTypeSection
                type="investment"
                assets={assetsByType.investment}
                locale={locale}
                receipts={receipts}
                onTransfer={setTransferAsset}
                onEdit={openEdit}
                onRemove={confirmRemoveAsset}
              />
              <AssetTypeSection
                type="rental"
                assets={assetsByType.rental}
                locale={locale}
                receipts={receipts}
                onTransfer={setTransferAsset}
                onEdit={openEdit}
                onRemove={confirmRemoveAsset}
              />
            </>
          )}
        </CardContent>
      </Card>

      <PassiveTransferDialog
        asset={transferAsset}
        open={transferAsset !== null}
        onOpenChange={(open) => {
          if (!open) setTransferAsset(null);
        }}
        onConfirm={confirmTransfer}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(locale, "bizAssetAdd")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t(locale, "bizAssetDialogHint")}</p>
          <div className="flex gap-2">
            {(["freelance", "investment", "rental"] as BusinessAssetType[]).map((kind) => (
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
            type="text"
            inputMode="decimal"
            placeholder={t(locale, "bizAssetCapitalPh")}
            value={assetCapital}
            onChange={(e) => setAssetCapital(e.target.value)}
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder={t(locale, "bizAssetMonthlyPh")}
            value={assetMonthly}
            onChange={(e) => setAssetMonthly(e.target.value)}
          />
          {assetType === "freelance" ? (
            <Input
              type="text"
              inputMode="numeric"
              placeholder={t(locale, "bizAssetHoursPh")}
              value={assetHours}
              onChange={(e) => setAssetHours(e.target.value)}
            />
          ) : null}
          <Button type="button" className="w-full" onClick={submitAdd}>
            {t(locale, "bizSave")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editAsset !== null} onOpenChange={(o) => !o && setEditAsset(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t(locale, "projectsEditPlan")}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t(locale, "bizAssetDialogHint")}</p>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input
            placeholder={t(locale, "bizAssetCapitalPh")}
            value={editCapital}
            onChange={(e) => setEditCapital(e.target.value)}
          />
          <Input
            placeholder={t(locale, "bizAssetMonthlyPh")}
            value={editMonthly}
            onChange={(e) => setEditMonthly(e.target.value)}
          />
          {editAsset?.type === "freelance" ? (
            <Input
              placeholder={t(locale, "bizAssetHoursPh")}
              value={editHours}
              onChange={(e) => setEditHours(e.target.value)}
            />
          ) : null}
          {editAsset?.type === "rental" ? (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t(locale, "projectsUtilitiesMonthField")}
                </span>
                <Input
                  type="month"
                  value={editUtilitiesMonth}
                  onChange={(e) => {
                    const mk = e.target.value;
                    setEditUtilitiesMonth(mk);
                    const amt = utilitiesAmountForMonth(editAsset, mk);
                    setEditUtilities(amt > 0 ? String(amt) : "");
                  }}
                />
              </label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={t(locale, "projectsUtilitiesPh")}
                value={editUtilities}
                onChange={(e) => setEditUtilities(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t(locale, "projectsUtilitiesHint")}</p>
              <RentalUtilitiesHistory asset={editAsset} locale={locale} />
            </>
          ) : null}
          <Button type="button" className="w-full" onClick={submitEdit}>
            {t(locale, "bizSave")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
