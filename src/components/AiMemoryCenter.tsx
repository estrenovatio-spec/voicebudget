"use client";

import { BrainCircuit, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCategoryLabel } from "@/lib/categories";
import { buildAiCoachingContext } from "@/lib/ai-coaching-context";
import { getCurrentBudgetPeriod } from "@/lib/budget-period";
import { formatIsoDate } from "@/lib/format-date";
import {
  deleteAiMemoryRule,
  getAiMemoryRules,
  type AiMemoryRule,
} from "@/lib/ai-memory";
import { useCategories, useStore, useTransactions } from "@/store/useStore";
import type { Locale } from "@/types";

function advisorySignalText(
  signals: ReturnType<typeof buildAiCoachingContext>["smartSignals"],
  locale: Locale,
): string | null {
  if (!signals) return null;
  const isRu = locale === "ru";
  if (signals.cashflowRisk === "high") {
    return isRu
      ? `Денежный поток напряжён. Советник бы начал не с запретов, а с ревизии: что точно нужно оплатить до конца периода, а что можно перенести. ${signals.nextStep}`
      : `Cash flow is tight. Start with a review, not a ban: what must be paid before period end, and what can move. ${signals.nextStep}`;
  }
  if (signals.safeDailySpend === null) {
    return isRu
      ? `Запас на свободные траты пока не сформирован. Это не повод паниковать: отделите обязательные платежи от гибких расходов и выберите один рычаг на неделю.`
      : `There is no clear free-spending buffer yet. No panic: separate required payments from flexible spending and choose one lever for the week.`;
  }
  if (signals.cashflowRisk === "medium") {
    return isRu
      ? `Запас небольшой: ориентир на свободные траты около ${signals.safeDailySpend.toLocaleString("ru-RU")} ₽/день. ${signals.nextStep}`
      : `Buffer is modest: flexible-spend guide is about ${signals.safeDailySpend.toLocaleString("en-US")} RUB/day. ${signals.nextStep}`;
  }
  return isRu
    ? `Картина спокойная: ориентир на свободные траты около ${signals.safeDailySpend.toLocaleString("ru-RU")} ₽/день. ${signals.nextStep}`
    : `Picture is steady: flexible-spend guide is about ${signals.safeDailySpend.toLocaleString("en-US")} RUB/day. ${signals.nextStep}`;
}

function sourceLabel(source: AiMemoryRule["source"], locale: "ru" | "en"): string {
  if (locale !== "ru") return source;
  if (source === "correction") return "исправление";
  if (source === "voice") return "голос";
  return "текст";
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

  const habit = ctx.personalMemory?.categoryHabits[0] ?? null;
  const insights = ctx.personalMemory?.insights ?? [];
  const signals = ctx.smartSignals;
  const advisoryText = advisorySignalText(signals, locale);
  const ruleGroups = groupRulesByDate(learnedRules);

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
              {advisoryText}
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
        {learnedRules.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm leading-snug text-muted-foreground">
            {locale === "ru"
              ? "Память пустая. Запишите несколько операций голосом или текстом, а если категория ошиблась — исправьте её. Это самый сильный сигнал для обучения."
              : "Memory is empty. Add a few entries by voice or text, and correct the category when needed."}
          </p>
        ) : (
          <div className="max-h-[min(420px,52vh)] space-y-3 overflow-y-auto overscroll-contain rounded-md border border-border/70 p-2">
            {ruleGroups.map((group) => (
              <div key={group.dateKey} className="space-y-1.5">
                <div className="sticky top-0 z-10 bg-background/95 py-1 backdrop-blur">
                  <p className="text-xs font-medium text-muted-foreground">
                    {dateHeading(group.dateKey, locale)} · {group.rules.length}
                  </p>
                </div>
                <ul className="space-y-1.5">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
