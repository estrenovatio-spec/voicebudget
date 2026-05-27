"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import { CategoryManager } from "@/components/CategoryManager";
import { HouseholdFilterTabs } from "@/components/HouseholdControls";
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
import { clearCachedRecommendations } from "@/lib/storage";
import { useHouseholdBalances, useStore } from "@/store/useStore";

export function TMAHeader() {
  const locale = useStore((s) => s.locale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const setPartnerName = useStore((s) => s.setPartnerName);
  const clearAll = useStore((s) => s.clearAll);
  const balances = useHouseholdBalances();
  const [open, setOpen] = useState(false);
  const [partnerInput, setPartnerInput] = useState(partnerName ?? "");

  const fmt = (n: number) =>
    n.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 0 });

  const handleClear = () => {
    clearAll();
    clearCachedRecommendations();
    setOpen(false);
  };

  const savePartner = () => {
    setPartnerName(partnerInput.trim() || null);
  };

  return (
    <header className="sticky top-0 z-10 space-y-2 bg-[var(--tg-bg)]/95 pb-2 pt-1 backdrop-blur">
      {userName && (
        <p className="text-sm text-muted-foreground">{t(locale, "greeting", { name: userName })}</p>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{t(locale, "balance")}</p>
          <p className="text-2xl font-bold tabular-nums">
            {fmt(balances.all)} {t(locale, "currency")}
          </p>
          {partnerName && (
            <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>
                {t(locale, "ownerMe")}: {fmt(balances.me)} {t(locale, "currency")}
              </span>
              <span>
                {partnerName}: {fmt(balances.partner)} {t(locale, "currency")}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (v) setPartnerInput(partnerName ?? "");
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
                  <div className="space-y-2">
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
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t(locale, "categoriesTitle")}</h3>
                    <CategoryManager />
                  </div>
                  <div className="border-t pt-3">
                    <p className="mb-2 text-sm text-muted-foreground">{t(locale, "clearConfirm")}</p>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleClear}
                      type="button"
                    >
                      {t(locale, "clearData")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <HouseholdFilterTabs />
    </header>
  );
}
