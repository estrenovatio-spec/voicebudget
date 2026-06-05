"use client";

import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { ReferralWalletPublic } from "@/lib/referrals/wallet";
import { useToast } from "@/components/ui/toast";

function formatRub(amount: number, locale: "ru" | "en"): string {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Math.ceil(amount));
}

export function ReferralWalletCard({
  locale,
  wallet,
  onDismissPending,
}: {
  locale: "ru" | "en";
  wallet: ReferralWalletPublic;
  onDismissPending?: (referralId: string) => Promise<boolean>;
}) {
  const { toast } = useToast();
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const onApplyHint = () => {
    toast(t(locale, "referralWalletApplyHint"), "default");
  };

  return (
    <section className="space-y-2 rounded-xl border-2 border-emerald-600/35 bg-gradient-to-br from-emerald-500/15 to-primary/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
          <div>
            <h4 className="text-sm font-semibold">{t(locale, "referralWalletTitle")}</h4>
            <p className="text-[11px] text-muted-foreground">
              {t(locale, "referralWalletRule", {
                percent: String(wallet.commissionPercent),
              })}
            </p>
          </div>
        </div>
        {wallet.previewMode ? (
          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-950 dark:text-amber-100">
            {t(locale, "referralWalletPreviewBadge")}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t(locale, "referralWalletAvailable")}
          </p>
          <p className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
            {formatRub(wallet.availableRub, locale)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t(locale, "referralWalletPending")}
          </p>
          <p className="text-lg font-bold tabular-nums">{formatRub(wallet.pendingRub, locale)}</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t(locale, "referralWalletTotal", {
          amount: formatRub(wallet.totalEarnedRub, locale),
        })}
      </p>

      {wallet.recentEarnings.length > 0 ? (
        <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
          {wallet.recentEarnings.map((e, i) => (
            <li
              key={e.referralId ?? `${e.at}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2 py-1"
            >
              <span className="min-w-0 flex-1 truncate">
                {e.label}
                <span className="ml-1 text-muted-foreground">
                  {e.status === "pending"
                    ? t(locale, "referralWalletStatusPending")
                    : t(locale, "referralWalletStatusPaid")}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                +{formatRub(e.amountRub, locale)}
              </span>
              {e.status === "pending" && e.referralId && e.canDismiss && onDismissPending ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={t(locale, "referralWalletDismiss")}
                  disabled={dismissingId === e.referralId}
                  onClick={() => {
                    void (async () => {
                      setDismissingId(e.referralId!);
                      const ok = await onDismissPending(e.referralId!);
                      setDismissingId(null);
                      if (ok) toast(t(locale, "referralWalletDismissOk"), "success");
                      else toast(t(locale, "referralWalletDismissFail"), "error");
                    })();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Button type="button" size="sm" className="w-full" variant="secondary" onClick={onApplyHint}>
        {t(locale, "referralWalletApplyAtRenewal")}
      </Button>
      <p className="text-[10px] text-muted-foreground">{t(locale, "referralWalletApplyAtRenewalHint")}</p>
    </section>
  );
}
