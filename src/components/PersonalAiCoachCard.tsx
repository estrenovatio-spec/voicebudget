"use client";

import { BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  HomeSectionCardHeader,
  HomeSectionCollapsedBar,
  sectionToggleButtonClassName,
} from "@/components/HomeSectionCardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCategoryLabel } from "@/lib/categories";
import { buildAiCoachingContext } from "@/lib/ai-coaching-context";
import { getCurrentBudgetPeriod } from "@/lib/budget-period";
import { useCategories, useStore, useTransactions } from "@/store/useStore";
import type { Locale } from "@/types";

const AI_COACH_CARD_HIDDEN_KEY = "voicebudget-ai-coach-card-hidden";

function readHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AI_COACH_CARD_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(AI_COACH_CARD_HIDDEN_KEY, "1");
    else window.localStorage.removeItem(AI_COACH_CARD_HIDDEN_KEY);
  } catch {
    /* localStorage may be blocked */
  }
}

function advisorySignalText(
  signals: ReturnType<typeof buildAiCoachingContext>["smartSignals"],
  locale: Locale,
): string | null {
  if (!signals) return null;
  const isRu = locale === "ru";
  if (signals.cashflowRisk === "high") {
    return isRu
      ? `Денежный поток напряжён. Сначала сверить обязательные платежи и отделить их от гибких расходов.`
      : `Cash flow is tight. First reconcile required payments and separate them from flexible spending.`;
  }
  if (signals.safeDailySpend === null) {
    return isRu
      ? "Запас на свободные траты пока не сформирован. Сначала обязательное, потом комфорт."
      : "There is no clear free-spending buffer yet. Essentials first, comfort second.";
  }
  return isRu
    ? `Ориентир на свободные траты: около ${signals.safeDailySpend.toLocaleString("ru-RU")} ₽/день. ${signals.nextStep}`
    : `Flexible-spend guide: about ${signals.safeDailySpend.toLocaleString("en-US")} RUB/day. ${signals.nextStep}`;
}

export function PersonalAiCoachCard() {
  const locale = useStore((s) => s.locale);
  const budgetMonthStartDay = useStore((s) => s.budgetMonthStartDay);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const categoryBudgets = useStore((s) => s.categoryBudgets);
  const transactions = useTransactions();
  const categories = useCategories();
  const [hidden, setHidden] = useState(readHidden);

  const ctx = useMemo(() => {
    const period = getCurrentBudgetPeriod(budgetMonthStartDay);
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
  }, [budgetMonthStartDay, categories, categoryBudgets, locale, savingsGoals, transactions]);

  const insights = ctx.personalMemory?.insights ?? [];
  const habit = ctx.personalMemory?.categoryHabits[0] ?? null;
  const learnedRules = ctx.personalMemory?.learnedRules ?? [];
  const rulesCount = ctx.personalMemory?.learnedRules.length ?? 0;
  const signals = ctx.smartSignals;
  const advisoryText = advisorySignalText(signals, locale);
  const title = locale === "ru" ? "ИИ заметил" : "AI noticed";

  if (transactions.length < 3 && rulesCount === 0) return null;

  const show = () => {
    setHidden(false);
    writeHidden(false);
  };

  const hide = () => {
    setHidden(true);
    writeHidden(true);
  };

  if (hidden) {
    return (
      <HomeSectionCollapsedBar
        icon={BrainCircuit}
        title={title}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={sectionToggleButtonClassName}
            onClick={show}
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
            {locale === "ru" ? "Показать" : "Show"}
          </Button>
        }
      />
    );
  }

  return (
    <Card className="border-primary/20">
      <HomeSectionCardHeader
        icon={BrainCircuit}
        title={title}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={sectionToggleButtonClassName}
            onClick={hide}
          >
            <ChevronUp className="h-4 w-4" aria-hidden />
            {locale === "ru" ? "Скрыть" : "Hide"}
          </Button>
        }
      />
      <CardContent className="space-y-2 text-sm">
        {habit ? (
          <p className="rounded-md bg-primary/5 p-2.5 leading-snug">
            {locale === "ru"
              ? `${habit.category}: ${habit.sharePercent}% расходов периода, средний чек ${habit.avgAmount} ₽.`
              : `${habit.category}: ${habit.sharePercent}% of period expenses, avg ${habit.avgAmount} RUB.`}
          </p>
        ) : null}
        {signals ? (
          <p className="rounded-md bg-secondary/70 p-2.5 leading-snug">
            {advisoryText}
          </p>
        ) : null}
        {insights.slice(0, 1).map((item) => (
          <p key={item.title} className="rounded-md border border-border/70 p-2.5 leading-snug">
            <span className="font-medium">{item.title}: </span>
            {item.detail}
          </p>
        ))}
        {rulesCount > 0 ? (
          <div className="space-y-1.5 rounded-md border border-primary/15 bg-primary/5 p-2.5">
            <p className="text-xs font-medium text-foreground">
              {locale === "ru"
                ? `Персональная память: ${rulesCount} правил`
                : `Personal memory: ${rulesCount} rules`}
            </p>
            <div className="space-y-1">
              {learnedRules.slice(0, 4).map((rule) => (
                <p
                  key={`${rule.phrase}-${rule.categoryId}-${rule.type}`}
                  className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">“{rule.phrase}”</span>
                  <span aria-hidden>→</span>
                  <span>{getCategoryLabel(rule.categoryId, categories, locale)}</span>
                  <span className="rounded-sm bg-background/80 px-1 py-0.5 text-[10px] uppercase tracking-normal">
                    {rule.source === "correction"
                      ? locale === "ru"
                        ? "исправление"
                        : "correction"
                      : rule.source === "voice"
                        ? locale === "ru"
                          ? "голос"
                          : "voice"
                        : locale === "ru"
                          ? "текст"
                          : "text"}
                  </span>
                </p>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {locale === "ru"
                ? "Исправление категории усиливает правило сильнее обычного ввода."
                : "Correcting a category makes that rule stronger than a regular entry."}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
