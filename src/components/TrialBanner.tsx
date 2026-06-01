"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { requestOpenSettings, dismissTrialBanner, isTrialBannerDismissed } from "@/lib/billing/trial-banner";
import { t } from "@/lib/i18n";
import { useCloudStore } from "@/store/useCloudStore";
import { useStore } from "@/store/useStore";

/**
 * Subtle strip above the header during free trial / promo access.
 * Hidden after payment or when user dismisses until the period end changes.
 */
export function TrialBanner() {
  const locale = useStore((s) => s.locale);
  const subscription = useCloudStore((s) => s.subscription);
  const [hidden, setHidden] = useState(true);

  const expiresAt = subscription?.expiresAt ?? null;
  const days = subscription?.daysRemaining;
  const showTrialBanner =
    subscription?.showTrialBanner ??
    (Boolean(subscription?.enforced) &&
      Boolean(subscription?.active) &&
      Boolean(subscription?.onFreeAccess));
  const show = Boolean(showTrialBanner) && days !== null && days !== undefined;

  useEffect(() => {
    if (!show || !expiresAt) {
      setHidden(true);
      return;
    }
    setHidden(isTrialBannerDismissed(expiresAt));
  }, [show, expiresAt]);

  const onDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dismissTrialBanner(expiresAt);
      setHidden(true);
    },
    [expiresAt],
  );

  if (!show || hidden) return null;

  const daysLabel =
    days === 0
      ? t(locale, "trialBannerLastDay")
      : t(locale, "trialBannerDaysLeft", { days: String(days) });

  return (
    <button
      type="button"
      onClick={requestOpenSettings}
      className="group -mx-4 mb-1 flex w-[calc(100%+2rem)] items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-left transition-colors hover:bg-amber-500/15"
      aria-label={t(locale, "trialBannerAria")}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] leading-snug text-muted-foreground">
        {t(locale, "trialBannerText", { days: daysLabel })}
        {subscription?.testMode ? (
          <span className="ml-1 opacity-60">· {t(locale, "trialBannerTest")}</span>
        ) : null}
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-label={t(locale, "trialBannerDismiss")}
        className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        onClick={onDismiss}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDismiss(e as unknown as React.MouseEvent);
          }
        }}
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}
