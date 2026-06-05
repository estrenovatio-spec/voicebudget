"use client";

import { BrainCircuit, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/categories";
import { buildAiCoachingContext } from "@/lib/ai-coaching-context";
import { getCurrentBudgetPeriod } from "@/lib/budget-period";
import {
  deleteAiMemoryRule,
  getAiMemoryRules,
  type AiMemoryRule,
} from "@/lib/ai-memory";
import { useCategories, useStore, useTransactions } from "@/store/useStore";

function sourceLabel(source: AiMemoryRule["source"], locale: "ru" | "en"): string {
  if (locale !== "ru") return source;
  if (source === "correction") return "исправление";
  if (source === "voice") return "голос";
  return "текст";
}

export function AiMemoryCenter() {
  const locale = useStore((s) => s.locale);
  const budgetMonthStartDay = useStore((s) => s.budgetMonthStartDay);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const categoryBudgets = useStore((s) => s.categoryBudgets);
  const transactions = useTransactions();
  const categories = useCategories();
  const [learnedRules, setLearnedRules] = useState(() => getAiMemoryRules());
  const memorySignature = learnedRules
    .map((rule) => `${rule.phrase}:${rule.categoryId}:${rule.type}:${rule.weight}`)
    .join("|");

  const ctx = useMemo(() => {
    void memorySignature;
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
  }, [
    budgetMonthStartDay,
    categories,
    categoryBudgets,
    locale,
    memorySignature,
    savingsGoals,
    transactions,
  ]);

  const habit = ctx.personalMemory?.categoryHabits[0] ?? null;
  const insights = ctx.personalMemory?.insights ?? [];
  const signals = ctx.smartSignals;
  const rules = learnedRules.slice(0, 24);

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
            {locale === "ru" ? "ИИ заметил" : "AI noticed"}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          {habit ? (
            <p className="rounded-md bg-background/70 p-2.5 leading-snug">
              {locale === "ru"
                ? `${habit.category}: ${habit.sharePercent}% расходов периода, средний чек ${habit.avgAmount} ₽.`
                : `${habit.category}: ${habit.sharePercent}% of period expenses, avg ${habit.avgAmount} RUB.`}
            </p>
          ) : null}
          {signals ? (
            <p className="rounded-md bg-background/70 p-2.5 leading-snug">
              {locale === "ru"
                ? `Безопасный ориентир: около ${signals.safeDailySpend ?? 0} ₽/день. ${signals.nextStep}`
                : `Safe guide: about ${signals.safeDailySpend ?? 0} RUB/day. ${signals.nextStep}`}
            </p>
          ) : null}
          {insights.slice(0, 2).map((item) => (
            <p key={item.title} className="rounded-md bg-background/70 p-2.5 leading-snug">
              <span className="font-medium">{item.title}: </span>
              {item.detail}
            </p>
          ))}
          {!habit && !signals && insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {locale === "ru"
                ? "Пока мало операций. ИИ начнёт замечать привычки после нескольких записей."
                : "Not enough entries yet. AI will notice habits after a few records."}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {locale === "ru" ? "Чему ИИ научился" : "What AI learned"}
          </p>
          <p className="text-xs text-muted-foreground">
            {locale === "ru" ? `${learnedRules.length} правил` : `${learnedRules.length} rules`}
          </p>
        </div>
        {rules.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm leading-snug text-muted-foreground">
            {locale === "ru"
              ? "Память пустая. Запишите несколько операций голосом или текстом, а если категория ошиблась — исправьте её. Это самый сильный сигнал для обучения."
              : "Memory is empty. Add a few entries by voice or text, and correct the category when needed."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rules.map((rule) => (
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
                    {sourceLabel(rule.source, locale)} · вес {rule.weight}
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
        )}
      </div>
    </div>
  );
}
