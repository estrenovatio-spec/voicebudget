"use client";

import { ExternalLink, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEducationAccess } from "@/hooks/useEducationAccess";
import { useEducationConfig } from "@/hooks/useEducationConfig";
import { openExternalAppLink } from "@/lib/education-links";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export function EducationTab({ embedded = false }: { embedded?: boolean }) {
  const locale = useStore((s) => s.locale);
  const { videos, diagnosticsFormUrl, loading: videosLoading } = useEducationConfig();
  const { access, loading: accessLoading, paying, error, pay, refresh, paid } =
    useEducationAccess();

  const loading = accessLoading || videosLoading;
  const priceRub = access?.priceRub ?? 5000;
  const listPriceRub = access?.listPriceRub ?? 40000;

  return (
    <div className="space-y-4 py-1">
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold">{t(locale, "educationTitle")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t(locale, "educationSubtitle")}</p>
          <p className="mt-2 text-xs font-medium text-primary/90">
            {t(locale, "educationAttribution")}
          </p>
        </div>
      ) : null}

      {!paid ? (
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-card p-4 shadow-sm">
          <p className="text-sm font-semibold">{t(locale, "educationPaywallTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(locale, "educationPaywallHint")}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatMoney(priceRub, locale)} {t(locale, "currency")}
            </span>
            <span className="text-sm tabular-nums text-muted-foreground line-through">
              {formatMoney(listPriceRub, locale)} {t(locale, "currency")}
            </span>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={paying || loading || !access?.paymentsConfigured}
            onClick={() => void pay()}
          >
            {paying ? t(locale, "educationPayLoading") : t(locale, "educationPayButton")}
          </Button>
          {!access?.paymentsConfigured && !loading ? (
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
              {t(locale, "educationPaymentsOff")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-950 dark:text-emerald-100">
          {t(locale, "educationPaidNote")}
        </p>
      )}

      {paid ? (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t(locale, "educationVideosTitle")}</h3>
            {loading ? (
              <p className="text-xs text-muted-foreground">{t(locale, "educationLoading")}</p>
            ) : videos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                {t(locale, "educationVideosEmpty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {videos.map((v) => (
                  <li
                    key={v.url + v.title}
                    className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium leading-snug">{v.title}</p>
                    {v.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.description}</p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full gap-1.5"
                      onClick={() => openExternalAppLink(v.url)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {t(locale, "educationOpenVideo")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Stethoscope className="h-4 w-4 text-primary" aria-hidden />
              {t(locale, "educationDiagnosticsTitle")}
            </h3>
            <p className="text-xs text-muted-foreground">{t(locale, "educationDiagnosticsDesc")}</p>
            {diagnosticsFormUrl ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => openExternalAppLink(diagnosticsFormUrl)}
              >
                {t(locale, "educationOpenForm")}
              </Button>
            ) : (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {t(locale, "educationFormMissing")}
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t(locale, "educationLockedHint")}
        </p>
      )}

      <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => void refresh()}>
        {t(locale, "educationRefreshAccess")}
      </Button>
    </div>
  );
}
