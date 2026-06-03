"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getAdvisorConfig } from "@/lib/advisor-config";
import { formatIsoDate } from "@/lib/format-date";
import { getCategoryLabel } from "@/lib/categories";
import { t } from "@/lib/i18n";
import {
  getCachedWeeklyAnalysis,
  setCachedWeeklyAnalysis,
  WEEKLY_ANALYSIS_TTL_MS,
} from "@/lib/storage";
import {
  buildWeeklySummary,
  getWeeklyGate,
  getWeeklyWaitingMessages,
  ruleBasedWeeklyAnalysis,
} from "@/lib/weekly-analysis";
import { persistAiReportToCloud } from "@/lib/reports/persist-ai-report";
import { useCategories, useStore, useTransactions } from "@/store/useStore";

function daysUntilNext(msRemaining: number): number {
  return Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
}

type WeeklyAnalysisTabProps = {
  active: boolean;
};

export function WeeklyAnalysisTab({ active }: WeeklyAnalysisTabProps) {
  const locale = useStore((s) => s.locale);
  const trackingStartedAt = useStore((s) => s.trackingStartedAt);
  const transactions = useTransactions();
  const categories = useCategories();

  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextInDays, setNextInDays] = useState<number | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [isFullAnalysis, setIsFullAnalysis] = useState(false);

  const summary = useMemo(
    () =>
      buildWeeklySummary(transactions, trackingStartedAt, (id) =>
        getCategoryLabel(id, categories, locale),
      ),
    [categories, locale, transactions, trackingStartedAt],
  );

  const gate = useMemo(
    () => getWeeklyGate(summary, trackingStartedAt, transactions),
    [summary, trackingStartedAt, transactions],
  );

  const loadAnalysis = useCallback(
    async (force = false) => {
      if (!gate.ready) {
        setItems(getWeeklyWaitingMessages(gate, locale, summary));
        setNextInDays(null);
        setIsFullAnalysis(false);
        setUsedFallback(false);
        return;
      }

      if (!force) {
        const cached = getCachedWeeklyAnalysis();
        if (cached) {
          setItems(cached.items);
          setIsFullAnalysis(true);
          setNextInDays(
            daysUntilNext(WEEKLY_ANALYSIS_TTL_MS - (Date.now() - cached.generatedAt)),
          );
          return;
        }
      }

      setLoading(true);
      setUsedFallback(false);
      try {
        const res = await fetch("/api/weekly-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale, summary }),
        });

        const json = (await res.json()) as {
          success?: boolean;
          tips?: string[];
          fallback?: boolean;
        };

        if (!res.ok || !json.success || !json.tips?.length) {
          setItems(getWeeklyWaitingMessages(gate, locale, summary));
          setIsFullAnalysis(false);
          setNextInDays(null);
          return;
        }

        setItems(json.tips);
        setCachedWeeklyAnalysis(json.tips, summary.periodEnd);
        setNextInDays(7);
        setIsFullAnalysis(true);
        setUsedFallback(Boolean(json.fallback));
        void persistAiReportToCloud({
          kind: "weekly",
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          locale,
          tips: json.tips,
          fallback: json.fallback,
          summaryJson: summary,
        });
      } catch {
        const tips = ruleBasedWeeklyAnalysis(summary, locale, getAdvisorConfig());
        setItems(tips);
        setCachedWeeklyAnalysis(tips, summary.periodEnd);
        setNextInDays(7);
        setIsFullAnalysis(true);
        setUsedFallback(true);
        void persistAiReportToCloud({
          kind: "weekly",
          periodStart: summary.periodStart,
          periodEnd: summary.periodEnd,
          locale,
          tips,
          fallback: true,
          summaryJson: summary,
        });
      } finally {
        setLoading(false);
      }
    },
    [gate, locale, summary],
  );

  useEffect(() => {
    if (!active) return;
    void loadAnalysis(false);
  }, [active, loadAnalysis]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3 shrink-0" />
          {gate.ready
            ? t(locale, "weeklyPeriod", {
                from: formatIsoDate(summary.periodStart, locale),
                to: formatIsoDate(summary.periodEnd, locale),
              })
            : t(locale, "weeklySubtitleWaiting")}
        </p>
        {gate.ready && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={loading}
            onClick={() => void loadAnalysis(true)}
          >
            {t(locale, "weeklyRefresh")}
          </Button>
        )}
      </div>
      {nextInDays !== null && isFullAnalysis && (
        <p className="text-xs text-muted-foreground">
          {t(locale, "weeklyNextIn", { days: String(nextInDays) })}
        </p>
      )}
      {loading && items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t(locale, "weeklyLoading")}
        </p>
      ) : (
        <>
          {usedFallback && isFullAnalysis && (
            <p className="text-xs text-muted-foreground">{t(locale, "weeklyFallback")}</p>
          )}
          {!gate.ready && (
            <p className="text-xs text-muted-foreground">{t(locale, "weeklyNoRush")}</p>
          )}
          <ul className="space-y-2 text-sm">
            {items.map((item, i) => (
              <li
                key={`${i}-${item.slice(0, 24)}`}
                className={
                  isFullAnalysis
                    ? "rounded-md bg-primary/5 p-2.5 leading-snug text-foreground/90"
                    : "rounded-md border border-dashed border-muted-foreground/30 p-2.5 leading-snug text-muted-foreground"
                }
              >
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
