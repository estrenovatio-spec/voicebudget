"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AI_RECOMMENDATIONS_MIN_DAYS,
  buildBudgetSummary,
  isEligibleForAiRecommendations,
} from "@/lib/budget-analytics";
import { getAdvisorConfig } from "@/lib/advisor-config";
import { ruleBasedRecommendations } from "@/lib/ai-recommendations";
import { getCategoryLabel } from "@/lib/categories";
import { t } from "@/lib/i18n";
import {
  clearCachedRecommendations,
  getCachedRecommendations,
  setCachedRecommendations,
} from "@/lib/storage";
import { useCategories, useStore, useTransactions } from "@/store/useStore";

export function AIRecommendations() {
  const locale = useStore((s) => s.locale);
  const trackingStartedAt = useStore((s) => s.trackingStartedAt);
  const transactions = useTransactions();
  const categories = useCategories();
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"locked" | "preliminary" | "ai">("preliminary");

  const summary = useMemo(
    () =>
      buildBudgetSummary(transactions, trackingStartedAt, (id) =>
        getCategoryLabel(id, categories, locale),
      ),
    [categories, locale, transactions, trackingStartedAt],
  );

  const eligible = isEligibleForAiRecommendations(trackingStartedAt, transactions);
  const daysLeft = Math.max(0, AI_RECOMMENDATIONS_MIN_DAYS - summary.daysTracked);

  const loadRecommendations = useCallback(
    async (force = false) => {
      if (transactions.length === 0) {
        setItems([]);
        setMode("preliminary");
        return;
      }

      if (!force) {
        const cached = getCachedRecommendations();
        if (cached) {
          setItems(cached.items);
          setMode(eligible ? "ai" : "preliminary");
          return;
        }
      } else {
        clearCachedRecommendations();
      }

      if (!eligible) {
        const preliminary = ruleBasedRecommendations(summary, locale, getAdvisorConfig());
        setItems([
          t(locale, "recLocked", { days: String(daysLeft) }),
          ...preliminary.slice(0, 2),
        ]);
        setMode("locked");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale, summary }),
        });

        const json = (await res.json()) as {
          success?: boolean;
          tips?: string[];
          fallback?: boolean;
          error?: string;
          daysLeft?: number;
        };

        if (res.status === 403 && json.error === "insufficient_history") {
          setItems([
            t(locale, "recProgress", {
              current: String(summary.daysTracked),
              total: String(AI_RECOMMENDATIONS_MIN_DAYS),
            }),
            t(locale, "recLocked", { days: String(json.daysLeft ?? daysLeft) }),
          ]);
          setMode("locked");
          return;
        }

        if (res.ok && json.tips?.length) {
          setItems(json.tips);
          setCachedRecommendations(json.tips);
          setMode(json.fallback ? "preliminary" : "ai");
          return;
        }

        const fallback = ruleBasedRecommendations(summary, locale, getAdvisorConfig());
        setItems(fallback);
        setMode("preliminary");
      } catch {
        setItems([t(locale, "recFetchError")]);
      } finally {
        setLoading(false);
      }
    },
    [daysLeft, eligible, locale, summary, transactions.length],
  );

  useEffect(() => {
    void loadRecommendations(false);
  }, [loadRecommendations]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {eligible && <Sparkles className="h-4 w-4 text-primary" />}
            {t(locale, "recommendations")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {eligible
              ? t(locale, "recAiPowered")
              : t(locale, "recProgress", {
                  current: String(summary.daysTracked),
                  total: String(AI_RECOMMENDATIONS_MIN_DAYS),
                })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          disabled={loading || transactions.length === 0}
          onClick={() => void loadRecommendations(true)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="sr-only">{t(locale, "refreshRecommendations")}</span>
        </Button>
      </CardHeader>
      <CardContent>
        {loading && items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(locale, "recLoading")}
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {mode === "preliminary" && eligible === false && transactions.length > 0 && (
              <li className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2 text-xs text-muted-foreground">
                {t(locale, "recPreliminary")}
              </li>
            )}
            {items.map((item, i) => (
              <li key={`${item}-${i}`} className="rounded-md bg-secondary/60 p-2 leading-snug">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
