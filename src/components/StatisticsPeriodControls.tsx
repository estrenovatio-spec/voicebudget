"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBudgetPeriodLabel } from "@/lib/budget-period";
import { t } from "@/lib/i18n";
import { useStatsPeriod, useStore } from "@/store/useStore";

export function StatisticsPeriodControls() {
  const locale = useStore((s) => s.locale);
  const statsPeriodOverride = useStore((s) => s.statsPeriodOverride);
  const setStatsPeriodRange = useStore((s) => s.setStatsPeriodRange);
  const resetStatsPeriod = useStore((s) => s.resetStatsPeriod);
  const setStatsPreviousBudgetPeriod = useStore((s) => s.setStatsPreviousBudgetPeriod);
  const period = useStatsPeriod();

  const [draftFrom, setDraftFrom] = useState(period.from);
  const [draftTo, setDraftTo] = useState(period.to);

  useEffect(() => {
    setDraftFrom(period.from);
    setDraftTo(period.to);
  }, [period.from, period.to]);

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        {t(locale, "statsPeriodLabel", {
          period: formatBudgetPeriodLabel(period, locale),
        })}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={statsPeriodOverride === null ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={resetStatsPeriod}
        >
          {t(locale, "statsPeriodCurrent")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={setStatsPreviousBudgetPeriod}
        >
          {t(locale, "statsPeriodPrevious")}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {t(locale, "statsPeriodFrom")}
          <Input
            type="date"
            className="h-8 text-xs"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {t(locale, "statsPeriodTo")}
          <Input
            type="date"
            className="h-8 text-xs"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
          />
        </label>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 text-xs"
          onClick={() => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(draftFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(draftTo)) return;
            if (draftFrom > draftTo) return;
            setStatsPeriodRange(draftFrom, draftTo);
          }}
        >
          {t(locale, "statsPeriodApply")}
        </Button>
      </div>
      {statsPeriodOverride ? (
        <p className="text-[10px] text-muted-foreground">{t(locale, "statsPeriodCustomHint")}</p>
      ) : null}
    </div>
  );
}
