"use client";

import { BrainCircuit, ChevronDown, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/categories";
import { buildAiCoachingContext, buildFamilyAdvisorSpotlight } from "@/lib/ai-coaching-context";
import { getCurrentBudgetPeriod } from "@/lib/budget-period";
import { formatIsoDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  deleteAiMemoryRule,
  getAiMemoryRules,
  type AiMemoryRule,
} from "@/lib/ai-memory";
import { useCategories, useStore, useTransactions } from "@/store/useStore";
import type { Locale } from "@/types";

function sourceLabel(source: AiMemoryRule["source"], locale: "ru" | "en"): string {
  if (locale !== "ru") return source;
  if (source === "correction") return "исправление";
  if (source === "voice") return "голос";
  return "текст";
}

function ruleCountLabel(count: number, locale: Locale): string {
  if (locale !== "ru") return `${count} ${count === 1 ? "rule" : "rules"}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} правило`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} правила`;
  return `${count} правил`;
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function dateHeading(dateKey: string, locale: Locale): string {
  const today = localDateKey(new Date().toISOString());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate.toISOString());
  if (dateKey === today) return locale === "ru" ? "Сегодня" : "Today";
  if (dateKey === yesterday) return locale === "ru" ? "Вчера" : "Yesterday";
  return formatIsoDate(dateKey, locale);
}

function groupRulesByDate(rules: AiMemoryRule[]): { dateKey: string; rules: AiMemoryRule[] }[] {
  const groups = new Map<string, AiMemoryRule[]>();
  for (const rule of rules) {
    const dateKey = localDateKey(rule.lastSeenAt);
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), rule]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, groupedRules]) => ({
      dateKey,
      rules: groupedRules.sort((a, b) => b.weight - a.weight || b.lastSeenAt.localeCompare(a.lastSeenAt)),
    }));
}

export function AiMemoryCenter() {
  const locale = useStore((s) => s.locale);
  const budgetMonthStartDay = useStore((s) => s.budgetMonthStartDay);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const categoryBudgets = useStore((s) => s.categoryBudgets);
  const transactions = useTransactions();
  const categories = useCategories();
  const [learnedRules, setLearnedRules] = useState(() => getAiMemoryRules());
  const [openDateKey, setOpenDateKey] = useState<string | null>(null);
  const memorySignature = learnedRules
    .map((rule) => `${rule.phrase}:${rule.categoryId}:${rule.type}:${rule.weight}`)
    .join("|");

  const period = useMemo(
    () => getCurrentBudgetPeriod(budgetMonthStartDay),
    [budgetMonthStartDay],
  );

  const ctx = useMemo(() => {
    void memorySignature;
    return buildAiCoachingContext(
      transactions,
      savingsGoals,
      categoryBudgets,
      (id) => getCategoryLabel(id, categories, locale),
      period.from,
      period.to,
      categories,
      locale,
    );
  }, [
    categories,
    categoryBudgets,
    locale,
    memorySignature,
    period.from,
    period.to,
    savingsGoals,
    transactions,
  ]);

  const spotlight = buildFamilyAdvisorSpotlight(ctx, locale);
  const ruleGroups = groupRulesByDate(learnedRules);

  useEffect(() => {
    if (openDateKey && !ruleGroups.some((group) => group.dateKey === openDateKey)) {
      setOpenDateKey(null);
    }
  }, [openDateKey, ruleGroups]);

  const removeRule = (rule: AiMemoryRule) => {
    deleteAiMemoryRule(rule);
    setLearnedRules(getAiMemoryRules());
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-medium">
            {locale === "ru" ? "Финсоветник заметил" : "Advisor noticed"}
          </p>
        </div>
        {spotlight ? (
          <div
            className={cn(
              "rounded-md border bg-background/70 p-2.5 text-sm leading-snug",
              spotlight.tone === "risk"
                ? "border-red-500/20"
                : spotlight.tone === "watch"
                  ? "border-amber-500/25"
                  : "border-emerald-500/20",
            )}
          >
            <p className="font-medium">{spotlight.title}</p>
            <p className="mt-1 text-muted-foreground">{spotlight.text}</p>
            <p className="mt-2 text-xs font-medium text-foreground">{spotlight.action}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {locale === "ru"
              ? "Пока мало операций. Советник начнёт замечать привычки после нескольких записей."
              : "Not enough entries yet. The advisor will notice habits after a few records."}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {locale === "ru" ? "Финансовая память" : "Financial memory"}
          </p>
          <p className="text-xs text-muted-foreground">
            {ruleCountLabel(learnedRules.length, locale)}
          </p>
        </div>
        {learnedRules.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm leading-snug text-muted-foreground">
            {locale === "ru"
              ? "Память пустая. Запишите несколько операций голосом или текстом, а если категория ошиблась — исправьте её. Это самый сильный сигнал для обучения."
              : "Memory is empty. Add a few entries by voice or text, and correct the category when needed."}
          </p>
        ) : (
          <div className="max-h-[min(420px,52vh)] space-y-2 overflow-y-auto overscroll-contain rounded-md border border-border/70 p-2">
            {ruleGroups.map((group) => (
              <div key={group.dateKey} className="rounded-md border border-border/70 bg-background">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
                  onClick={() =>
                    setOpenDateKey((current) => (current === group.dateKey ? null : group.dateKey))
                  }
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">
                      {dateHeading(group.dateKey, locale)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {ruleCountLabel(group.rules.length, locale)}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      openDateKey === group.dateKey && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {openDateKey === group.dateKey ? (
                  <ul className="max-h-64 space-y-1.5 overflow-y-auto border-t border-border/70 p-2">
                    {group.rules.map((rule) => (
                      <li
                        key={`${rule.phrase}-${rule.categoryId}-${rule.type}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/70 p-2.5"
                      >
                        <div className="min-w-0 text-xs leading-snug">
                          <p className="truncate">
                            <span className="font-medium text-foreground">“{rule.phrase}”</span>
                            <span className="mx-1 text-muted-foreground" aria-hidden>
                              →
                            </span>
                            <span>{getCategoryLabel(rule.categoryId, categories, locale)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            {sourceLabel(rule.source, locale)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground"
                          onClick={() => removeRule(rule)}
                          aria-label={locale === "ru" ? "Удалить правило" : "Delete rule"}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
