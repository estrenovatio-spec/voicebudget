"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BalanceQuickEdit } from "@/components/BalanceQuickEdit";
import { CategoryManager } from "@/components/CategoryManager";
import { SettingsSection } from "@/components/SettingsSection";
import { VehicleSettingsPanel } from "@/components/VehicleSettingsPanel";
import { AppSettingsDiagnostics } from "@/components/AppSettingsDiagnostics";
import { CloudHeaderStatus } from "@/components/CloudHeaderStatus";
import { LiveRatesBar } from "@/components/LiveRatesBar";
import { HelpFaqDialog } from "@/components/HelpFaqDialog";
import { HouseholdCloudPanel } from "@/components/HouseholdCloudPanel";
import { PartnerTransferDialog } from "@/components/PartnerTransferDialog";
import { BusinessModeStub } from "@/components/BusinessModeStub";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import {
  balanceNameLabelLines,
  balanceNameLabelWithColon,
  hasPartnerBudget,
  myDisplayName,
  partnerDisplayName,
} from "@/lib/owner-labels";
import { forcePullSharedDataFromCloud } from "@/lib/cloud/force-pull";
import { cloudPushPartnerLabel, isCloudSyncActive } from "@/lib/cloud/push";
import { useToast } from "@/components/ui/toast";
import { OPEN_SETTINGS_EVENT } from "@/lib/billing/trial-banner";
import { checkForAppUpdate, storeBuildTag } from "@/lib/app-update";
import { BALANCE_AMOUNTS_HIDDEN_KEY, hardReloadApp, softReloadApp } from "@/lib/storage-reset";
import { useHouseholdBalances, useStore } from "@/store/useStore";

const balanceAmountClass =
  "shrink-0 text-sm font-semibold tabular-nums text-foreground";

/** Подпись слева (до 2 строк для длинных имён), суммы — справа */
function BalanceRow({
  label,
  labelLines,
  title,
  children,
  onHideToggle,
}: {
  label: string;
  /** 2 строки для имени партнёра — приоритетнее label */
  labelLines?: string[];
  title?: string;
  children: ReactNode;
  onHideToggle?: () => void;
}) {
  const lines = labelLines && labelLines.length > 0 ? labelLines : null;
  const multiline = Boolean(lines && lines.length > 1);

  return (
    <div
      className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 ${
        multiline ? "items-start" : "items-baseline"
      }`}
    >
      <button
        type="button"
        title={title ?? label}
        onClick={(e) => {
          e.stopPropagation();
          onHideToggle?.();
        }}
        className={`min-w-0 rounded-md px-0.5 text-sm font-semibold text-foreground hover:bg-muted/40 ${
          multiline ? "text-left leading-snug" : "truncate text-center"
        }`}
      >
        {lines ? (
          <span className="block min-w-0">
            {lines.map((line, i) => (
              <span
                key={i}
                className="block break-words leading-snug [overflow-wrap:anywhere]"
              >
                {line}
              </span>
            ))}
          </span>
        ) : (
          label
        )}
      </button>
      <div className="shrink-0 justify-self-end tabular-nums" data-balance-amount-zone>
        {children}
      </div>
    </div>
  );
}

function readAmountsHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(BALANCE_AMOUNTS_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAmountsHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(BALANCE_AMOUNTS_HIDDEN_KEY, "1");
    else localStorage.removeItem(BALANCE_AMOUNTS_HIDDEN_KEY);
  } catch {
    /* ignore */
  }
}

export function TMAHeader() {
  const locale = useStore((s) => s.locale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const setUserName = useStore((s) => s.setUserName);
  const setPartnerName = useStore((s) => s.setPartnerName);
  const { toast } = useToast();
  const balances = useHouseholdBalances();
  const [open, setOpen] = useState(false);
  const [myNameInput, setMyNameInput] = useState(userName ?? "");
  const [partnerInput, setPartnerInput] = useState(partnerName ?? "");
  const [confirmClear, setConfirmClear] = useState(false);
  const [amountsHidden, setAmountsHidden] = useState(false);
  const [savedFlash, setSavedFlash] = useState<"my" | "partner" | null>(null);
  const [balanceEditDialogOpen, setBalanceEditDialogOpen] = useState(false);
  const suppressBalanceToggleUntilRef = useRef(0);

  useEffect(() => {
    setAmountsHidden(readAmountsHidden());
  }, []);

  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);

  const armBalanceToggleSuppress = useCallback((ms = 900) => {
    suppressBalanceToggleUntilRef.current = Date.now() + ms;
  }, []);

  const handleBalanceEditDialogOpenChange = useCallback(
    (editOpen: boolean) => {
      setBalanceEditDialogOpen(editOpen);
      if (!editOpen) armBalanceToggleSuppress();
    },
    [armBalanceToggleSuppress],
  );

  useEffect(() => {
    if (!open) return;
    setMyNameInput(userName ?? "");
    setPartnerInput(partnerName ?? "");
  }, [open, userName, partnerName]);

  const toggleAmountsHidden = useCallback(() => {
    setAmountsHidden((prev) => {
      const next = !prev;
      writeAmountsHidden(next);
      return next;
    });
  }, []);

  const requestHideToggle = useCallback(() => {
    if (balanceEditDialogOpen) return;
    if (Date.now() < suppressBalanceToggleUntilRef.current) return;
    toggleAmountsHidden();
  }, [balanceEditDialogOpen, toggleAmountsHidden]);

  const handleSoftUpdate = async () => {
    const { serverTag } = await checkForAppUpdate();
    if (serverTag) storeBuildTag(serverTag);
    softReloadApp();
  };

  const handleForcePullCloud = async () => {
    if (!isCloudSyncActive()) {
      toast(t(locale, "cloudErrGeneric"), "error");
      return;
    }
    try {
      const ok = await forcePullSharedDataFromCloud();
      if (ok) toast(t(locale, "forcePullCloudDone"), "success");
      else toast(t(locale, "cloudErrGeneric"), "error");
    } catch {
      toast(t(locale, "cloudErrGeneric"), "error");
    }
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    hardReloadApp();
  };

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 6000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const flashSaved = useCallback((which: "my" | "partner") => {
    setSavedFlash(which);
    window.setTimeout(() => {
      setSavedFlash((current) => (current === which ? null : current));
    }, 2000);
  }, []);

  const saveMyName = () => {
    setUserName(myNameInput.trim() || null);
    flashSaved("my");
  };

  const savePartner = () => {
    const trimmed = partnerInput.trim() || null;
    setPartnerName(trimmed);
    if (isCloudSyncActive()) void cloudPushPartnerLabel(trimmed);
    flashSaved("partner");
  };

  const meName = myDisplayName(locale, userName);
  const partner = partnerDisplayName(partnerName);
  const hasPartner = hasPartnerBudget(partnerName);
  const balanceWord = `${t(locale, "balance")}:`;
  const meLabel = `${meName}:`;
  const partnerLabelLines = partner
    ? balanceNameLabelWithColon(balanceNameLabelLines(partner))
    : [];
  const partnerLabel = partner ? `${partner}:` : "";

  return (
    <header className="space-y-2 pb-2 pt-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div
            aria-label={
              amountsHidden ? t(locale, "balanceTapToShow") : t(locale, "balanceTapToHide")
            }
            className="rounded-lg border-2 border-primary/20 bg-card px-3 py-2.5 shadow-sm transition-colors"
          >
            <div className="flex w-full flex-col gap-y-0.5">
              <BalanceRow label={balanceWord} onHideToggle={requestHideToggle}>
                <BalanceQuickEdit
                  owner="all"
                  displayed={balances.all}
                  partnerDisplayed={hasPartner ? balances.partner : 0}
                  label={t(locale, "balance")}
                  className={balanceAmountClass}
                  amountsHidden={amountsHidden}
                  onEditDialogOpenChange={handleBalanceEditDialogOpenChange}
                  onBeforeEditDialogClose={armBalanceToggleSuppress}
                />
              </BalanceRow>

              {hasPartner ? (
                <>
                  <BalanceRow label={meLabel} onHideToggle={requestHideToggle}>
                    <BalanceQuickEdit
                      owner="me"
                      displayed={balances.me}
                      label={meName}
                      className={balanceAmountClass}
                      amountsHidden={amountsHidden}
                      onEditDialogOpenChange={handleBalanceEditDialogOpenChange}
                      onBeforeEditDialogClose={armBalanceToggleSuppress}
                    />
                  </BalanceRow>

                  <BalanceRow
                    label={partnerLabel}
                    labelLines={partnerLabelLines.length > 1 ? partnerLabelLines : undefined}
                    title={partner}
                    onHideToggle={requestHideToggle}
                  >
                    <BalanceQuickEdit
                      owner="partner"
                      displayed={balances.partner}
                      label={partner}
                      className={balanceAmountClass}
                      amountsHidden={amountsHidden}
                      onEditDialogOpenChange={handleBalanceEditDialogOpenChange}
                      onBeforeEditDialogClose={armBalanceToggleSuppress}
                    />
                  </BalanceRow>
                </>
              ) : null}
            </div>
            {hasPartner ? (
              <div className="mt-2 border-t border-primary/10 pt-2">
                <PartnerTransferDialog
                  locale={locale}
                  partnerName={partnerName}
                  userName={userName}
                />
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <BusinessModeStub />
            <LocaleSwitcher />
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (v) {
                  setMyNameInput(userName ?? "");
                  setPartnerInput(partnerName ?? "");
                }
                if (!v) setConfirmClear(false);
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="min-w-[2.5rem] px-2"
                  aria-label={t(locale, "settings")}
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t(locale, "settings")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-1">
                  <SettingsSection title={t(locale, "helpTitle")}>
                    <HelpFaqDialog locale={locale} />
                    <AppSettingsDiagnostics />
                  </SettingsSection>

                  <SettingsSection title={t(locale, "categoriesTitle")}>
                    <CategoryManager />
                  </SettingsSection>

                  <SettingsSection
                    title={t(locale, "vehicleGarageTitle")}
                    description={t(locale, "vehicleHintMulti")}
                  >
                    <VehicleSettingsPanel />
                  </SettingsSection>

                  <SettingsSection title={t(locale, "cloudTitle")}>
                    <HouseholdCloudPanel embedded />
                  </SettingsSection>

                  <SettingsSection
                    title={t(locale, "householdTitle")}
                    description={t(locale, "householdHint")}
                  >
                    <Input
                      value={myNameInput}
                      onChange={(e) => setMyNameInput(e.target.value)}
                      placeholder={t(locale, "myNamePlaceholder")}
                    />
                    <Button type="button" variant="secondary" className="w-full" onClick={saveMyName}>
                      {t(locale, "myNameSave")}
                    </Button>
                    {savedFlash === "my" && (
                      <p className="flex justify-center" role="status" aria-live="polite">
                        <span className="inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                          {t(locale, "settingsSaved")}
                        </span>
                      </p>
                    )}
                    <Input
                      value={partnerInput}
                      onChange={(e) => setPartnerInput(e.target.value)}
                      placeholder={t(locale, "partnerNamePlaceholder")}
                    />
                    <Button type="button" variant="secondary" className="w-full" onClick={savePartner}>
                      {t(locale, "partnerSave")}
                    </Button>
                    {savedFlash === "partner" && (
                      <p className="flex justify-center" role="status" aria-live="polite">
                        <span className="inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                          {t(locale, "settingsSaved")}
                        </span>
                      </p>
                    )}
                  </SettingsSection>

                  <SettingsSection
                    title={t(locale, "settingsSectionMaintenance")}
                    description={t(locale, "updateAppHint")}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={() => void handleSoftUpdate()}
                    >
                      {t(locale, "updateApp")}
                    </Button>
                    {isCloudSyncActive() ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => void handleForcePullCloud()}
                      >
                        {t(locale, "forcePullCloud")}
                      </Button>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">{t(locale, "forcePullCloudHint")}</p>
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <Link href="/preview/capital">{t(locale, "previewCapitalOpen")}</Link>
                    </Button>
                  </SettingsSection>

                  <SettingsSection variant="danger" description={t(locale, "clearConfirm")}>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleClear}
                      type="button"
                    >
                      {confirmClear ? t(locale, "clearDataConfirmAgain") : t(locale, "clearData")}
                    </Button>
                  </SettingsSection>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <CloudHeaderStatus />
          <LiveRatesBar />
        </div>
      </div>
    </header>
  );
}
