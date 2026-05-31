"use client";

import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BalanceQuickEdit } from "@/components/BalanceQuickEdit";
import { CategoryManager } from "@/components/CategoryManager";
import { CloudHeaderStatus } from "@/components/CloudHeaderStatus";
import { LiveRatesBar } from "@/components/LiveRatesBar";
import { HelpFaqDialog } from "@/components/HelpFaqDialog";
import { HouseholdCloudPanel } from "@/components/HouseholdCloudPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cloudPushPartnerLabel, isCloudSyncActive } from "@/lib/cloud/push";
import { BALANCE_AMOUNTS_HIDDEN_KEY, hardReloadApp } from "@/lib/storage-reset";
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
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
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
                <Button variant="ghost" size="icon" type="button" aria-label={t(locale, "settings")}>
                  <Settings className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t(locale, "settings")}</DialogTitle>
                </DialogHeader>
                <Card>
                  <CardContent className="space-y-4 pt-4">
                    <HelpFaqDialog locale={locale} />
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">{t(locale, "categoriesTitle")}</h3>
                      <CategoryManager />
                    </div>
                    <HouseholdCloudPanel />
                    <div className="space-y-2 border-t pt-3">
                      <h3 className="text-sm font-semibold">{t(locale, "householdTitle")}</h3>
                      <p className="text-xs text-muted-foreground">{t(locale, "householdHint")}</p>
                      <Input
                        value={myNameInput}
                        onChange={(e) => setMyNameInput(e.target.value)}
                        placeholder={t(locale, "myNamePlaceholder")}
                      />
                      <Button type="button" variant="secondary" className="w-full" onClick={saveMyName}>
                        {t(locale, "myNameSave")}
                      </Button>
                      {savedFlash === "my" && (
                        <p
                          className="flex justify-center"
                          role="status"
                          aria-live="polite"
                        >
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
                        <p
                          className="flex justify-center"
                          role="status"
                          aria-live="polite"
                        >
                          <span className="inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                            {t(locale, "settingsSaved")}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="border-t pt-3">
                      <p className="mb-2 text-sm text-muted-foreground">{t(locale, "clearConfirm")}</p>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={handleClear}
                        type="button"
                      >
                        {confirmClear ? t(locale, "clearDataConfirmAgain") : t(locale, "clearData")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
