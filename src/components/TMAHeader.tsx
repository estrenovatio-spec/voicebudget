"use client";

import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { BalanceQuickEdit } from "@/components/BalanceQuickEdit";
import { CategoryManager } from "@/components/CategoryManager";
import { CloudHeaderStatus } from "@/components/CloudHeaderStatus";
import { DismissibleHints } from "@/components/DismissibleHints";
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
import { hardReloadApp } from "@/lib/storage-reset";
import { useHouseholdBalances, useStore } from "@/store/useStore";

export function TMAHeader() {
  const locale = useStore((s) => s.locale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const setPartnerName = useStore((s) => s.setPartnerName);
  const balances = useHouseholdBalances();
  const [open, setOpen] = useState(false);
  const [partnerInput, setPartnerInput] = useState(partnerName ?? "");
  const [confirmClear, setConfirmClear] = useState(false);

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

  const savePartner = () => {
    setPartnerName(partnerInput.trim() || null);
  };

  return (
    <header className="space-y-2 pb-2 pt-1">
      {userName && (
        <p className="text-sm text-muted-foreground">{t(locale, "greeting", { name: userName })}</p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">{t(locale, "balance")}</p>
          <p className="text-sm font-semibold text-foreground">
            {partnerName?.trim() ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <BalanceQuickEdit
                  owner="all"
                  displayed={balances.all}
                  partnerDisplayed={balances.partner}
                  label={t(locale, "balance")}
                  className="text-sm font-semibold"
                />
              </span>
            ) : (
              <BalanceQuickEdit
                owner="all"
                displayed={balances.all}
                label={t(locale, "balance")}
                className="text-sm font-semibold"
              />
            )}
          </p>
          {partnerName ? (
            <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {t(locale, "ownerMe")}:{" "}
                <BalanceQuickEdit
                  owner="me"
                  displayed={balances.me}
                  label={t(locale, "ownerMe")}
                />
              </span>
              <span className="inline-flex items-center gap-1">
                {partnerName}:{" "}
                <BalanceQuickEdit
                  owner="partner"
                  displayed={balances.partner}
                  label={partnerName}
                />
              </span>
            </div>
          ) : null}
          <DismissibleHints
            zoneId="balance-tap"
            lines={[
              partnerName?.trim()
                ? t(locale, "balanceTapHintPartner")
                : t(locale, "balanceTapHint"),
            ]}
            className="[&_button]:text-left"
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (v) setPartnerInput(partnerName ?? "");
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
                      value={partnerInput}
                      onChange={(e) => setPartnerInput(e.target.value)}
                      placeholder={t(locale, "partnerNamePlaceholder")}
                    />
                    <Button type="button" variant="secondary" className="w-full" onClick={savePartner}>
                      {t(locale, "partnerSave")}
                    </Button>
                  </div>
                  <div className="rounded-md border border-dashed p-3">
                    <p className="text-sm font-semibold">{t(locale, "donationTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t(locale, "donationLine")}</p>
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
        </div>
      </div>
    </header>
  );
}
