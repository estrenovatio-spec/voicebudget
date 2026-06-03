"use client";

import { ArrowLeftRight, BriefcaseBusiness, PiggyBank, Users } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate } from "@/lib/format-date";
import { t } from "@/lib/i18n";
import {
  useHouseholdBalances,
  usePeriodOwnerTotals,
  useStatsPeriod,
  useStore,
} from "@/store/useStore";

function formatRub(n: number, locale: "ru" | "en"): string {
  return `${Math.round(n).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")} ₽`;
}

export function BusinessTab() {
  const locale = useStore((s) => s.locale);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const balances = useHouseholdBalances();
  const period = useStatsPeriod();
  const totals = usePeriodOwnerTotals();

  const goalsSummary = useMemo(() => {
    const active = savingsGoals.filter((g) => g.targetAmount > 0);
    const saved = active.reduce((s, g) => s + g.savedAmount, 0);
    const target = active.reduce((s, g) => s + g.targetAmount, 0);
    return { count: active.length, saved, target };
  }, [savingsGoals]);

  const periodLabel = `${formatIsoDate(period.from, locale)} — ${formatIsoDate(period.to, locale)}`;

  return (
    <div className="space-y-4 py-1">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BriefcaseBusiness className="h-5 w-5 text-primary" aria-hidden />
          {t(locale, "businessTabTitle")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t(locale, "businessTabSubtitle")}</p>
      </div>

      <Card className="border-2 border-primary/25">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            {t(locale, "businessFamilyPulse")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-2xl font-bold tabular-nums">{formatRub(balances.all, locale)}</p>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="rounded-md bg-muted/40 px-2 py-1.5">
              <p className="text-muted-foreground">{t(locale, "businessYou")}</p>
              <p className="font-semibold tabular-nums">{formatRub(balances.me, locale)}</p>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1.5">
              <p className="text-muted-foreground">{t(locale, "businessPartner")}</p>
              <p className="font-semibold tabular-nums">{formatRub(balances.partner, locale)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" aria-hidden />
            {t(locale, "businessBridgeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t(locale, "businessBridgeHint")}</p>
          <ul className="list-inside list-disc space-y-1 text-xs">
            <li>{t(locale, "businessBridgePoint1")}</li>
            <li>{t(locale, "businessBridgePoint2")}</li>
            <li>{t(locale, "businessBridgePoint3")}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t(locale, "businessPeriodSplit")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-medium">{t(locale, "businessYou")}</p>
            <p className="text-emerald-600 dark:text-emerald-400">
              +{formatRub(totals.me.income, locale)}
            </p>
            <p className="text-red-600 dark:text-red-400">−{formatRub(totals.me.expense, locale)}</p>
          </div>
          <div>
            <p className="font-medium">{t(locale, "businessPartner")}</p>
            <p className="text-emerald-600 dark:text-emerald-400">
              +{formatRub(totals.partner.income, locale)}
            </p>
            <p className="text-red-600 dark:text-red-400">
              −{formatRub(totals.partner.expense, locale)}
            </p>
          </div>
        </CardContent>
      </Card>

      {goalsSummary.count > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PiggyBank className="h-4 w-4 text-primary" aria-hidden />
              {t(locale, "businessGoalsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="tabular-nums">
              {formatRub(goalsSummary.saved, locale)} / {formatRub(goalsSummary.target, locale)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(locale, "businessGoalsCount", { count: String(goalsSummary.count) })}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        {t(locale, "businessComingInvest")}
      </p>
    </div>
  );
}
