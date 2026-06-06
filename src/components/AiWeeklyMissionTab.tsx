"use client";

import { CheckCircle2, Circle, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildAiCoachingContext } from "@/lib/ai-coaching-context";
import { getAiMemoryRules } from "@/lib/ai-memory";
import { getCategoryLabel } from "@/lib/categories";
import { formatMoney } from "@/lib/format-money";
import { useCategories, useStore, useViewerMappedTransactions } from "@/store/useStore";
import type { Locale } from "@/types";

type AiMission = {
  id: string;
  title: string;
  detail: string;
  tone: "focus" | "save" | "learn" | "habit";
};

const MISSION_DONE_KEY = "voicebudget-ai-missions-done-v1";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCurrentWeekPeriod(ref = new Date()): { from: string; to: string } {
  const start = new Date(ref);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

function readDoneMissions(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MISSION_DONE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDoneMissions(done: Set<string>): void {
  try {
    window.localStorage.setItem(MISSION_DONE_KEY, JSON.stringify([...done]));
  } catch {
    /* localStorage may be blocked */
  }
}

function missionToneClass(tone: AiMission["tone"]): string {
  if (tone === "save") return "border-emerald-500/25 bg-emerald-500/5";
  if (tone === "learn") return "border-sky-500/25 bg-sky-500/5";
  if (tone === "habit") return "border-amber-500/25 bg-amber-500/5";
  return "border-primary/20 bg-primary/5";
}

function isChildCareCategory(category: string): boolean {
  const normalized = category.toLowerCase();
  return [
    "дет",
    "реб",
    "сад",
    "садик",
    "школ",
    "образован",
    "обуч",
    "круж",
    "секц",
    "child",
    "kid",
    "school",
    "education",
  ].some((token) => normalized.includes(token));
}

function buildWeeklyMissions(params: {
  locale: Locale;
  periodStart: string;
  periodEnd: string;
  habit: { category: string; avgAmount: number; sharePercent: number } | null;
  signals: ReturnType<typeof buildAiCoachingContext>["smartSignals"];
  categoryBudgets: ReturnType<typeof buildAiCoachingContext>["categoryBudgets"];
  savingsGoals: ReturnType<typeof buildAiCoachingContext>["savingsGoals"];
  learnedRulesCount: number;
  transactionsCount: number;
}): AiMission[] {
  const {
    locale,
    periodStart,
    periodEnd,
    habit,
    signals,
    categoryBudgets,
    savingsGoals,
    learnedRulesCount,
    transactionsCount,
  } = params;
  const isRu = locale === "ru";
  const prefix = `${periodStart}:${periodEnd}`;
  const missions: AiMission[] = [];
  const add = (mission: Omit<AiMission, "id"> & { id: string }) => {
    if (!missions.some((m) => m.id === `${prefix}:${mission.id}`)) {
      missions.push({ ...mission, id: `${prefix}:${mission.id}` });
    }
  };

  const overBudget = categoryBudgets.find((b) => b.overLimit);
  if (overBudget) {
    add({
      id: `over:${overBudget.category}`,
      tone: "focus",
      title: isRu
        ? `Пауза в «${overBudget.category}»`
        : `Pause ${overBudget.category}`,
      detail: isRu
        ? "Лимит уже превышен. Миссия: 48 часов без новых трат в этой категории."
        : "Limit is already over. Mission: 48 hours with no new spending there.",
    });
  } else if (
    signals?.cashflowRisk === "high" ||
    signals?.cashflowRisk === "medium"
  ) {
    add({
      id: "cashflow-pause",
      tone: "focus",
      title: isRu ? "48 часов финансовой паузы" : "48-hour spending pause",
      detail: isRu
        ? "Проверьте обязательные платежи и отложите необязательные покупки на два дня."
        : "Check required payments and postpone optional purchases for two days.",
    });
  }

  if (habit && habit.sharePercent >= 25) {
    const childCare = isChildCareCategory(habit.category);
    add({
      id: `habit:${habit.category}`,
      tone: "habit",
      title: isRu
        ? childCare
          ? `Проверить статью «${habit.category}»`
          : `Минус один чек: ${habit.category}`
        : childCare
          ? `Review "${habit.category}"`
          : `One less check: ${habit.category}`,
      detail: isRu
        ? childCare
          ? `Средний чек ${formatMoney(habit.avgAmount, locale)}. Детские расходы не режем вслепую: проверьте, что входит в сумму, план платежей и где можно оптимизировать без вреда для ребёнка.`
          : `Средний чек ${formatMoney(habit.avgAmount, locale)}. Если убрать один такой расход в неделю, уже появится запас.`
        : childCare
          ? `Average check ${formatMoney(habit.avgAmount, locale)}. Do not cut child-related spending blindly: check what is included, payment plan, and safe optimizations.`
          : `Average check ${formatMoney(habit.avgAmount, locale)}. Skip one this week to create breathing room.`,
    });
  }

  const goal = savingsGoals.find((g) => g.progressPercent < 100);
  if (goal) {
    const remaining = Math.max(0, goal.target - goal.saved);
    const planned =
      goal.monthlyContribution > 0
        ? Math.ceil(goal.monthlyContribution / 4)
        : 0;
    const amount = Math.max(
      100,
      Math.min(remaining, planned || Math.ceil(goal.target * 0.02)),
    );
    add({
      id: `goal:${goal.name}`,
      tone: "save",
      title: isRu ? `Пополнить «${goal.name}»` : `Top up "${goal.name}"`,
      detail: isRu
        ? `Мягкая цель недели: ${formatMoney(amount, locale)}. Даже маленькое пополнение закрепляет привычку.`
        : `Soft weekly target: ${formatMoney(amount, locale)}. Even a small deposit reinforces the habit.`,
    });
  }

  if (learnedRulesCount < 8) {
    add({
      id: "teach-ai",
      tone: "learn",
      title: isRu ? "Научить ИИ двум словам" : "Teach AI two phrases",
      detail: isRu
        ? "Запишите пару расходов обычными словами. Если категория ошиблась - исправьте, это усилит память."
        : "Add two natural-language expenses. If a category is wrong, correct it to strengthen memory.",
    });
  }

  if (transactionsCount < 10) {
    add({
      id: "five-days",
      tone: "habit",
      title: isRu ? "5 дней без пропусков" : "5 days without gaps",
      detail: isRu
        ? "Записывайте хотя бы одну операцию в день. Цель - не идеальный бюджет, а непрерывность."
        : "Record at least one entry per day. The goal is continuity, not perfection.",
    });
  }

  if (missions.length === 0) {
    add({
      id: "one-limit",
      tone: "focus",
      title: isRu ? "Выбрать один лимит недели" : "Pick one weekly limit",
      detail: isRu
        ? "Выберите категорию, которую хотите удержать, и проверяйте её каждый вечер."
        : "Choose one category to keep under control and check it every evening.",
    });
  }

  return missions.slice(0, 3);
}

export function AiWeeklyMissionTab() {
  const locale = useStore((s) => s.locale);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const categoryBudgets = useStore((s) => s.categoryBudgets);
  const transactions = useViewerMappedTransactions(false);
  const categories = useCategories();
  const [doneMissions, setDoneMissions] = useState(readDoneMissions);

  const period = useMemo(() => getCurrentWeekPeriod(), []);
  const personalTransactions = useMemo(
    () => transactions.filter((tx) => tx.owner === "me"),
    [transactions],
  );

  const learnedRulesCount = getAiMemoryRules().length;
  const weekTransactionsCount = useMemo(
    () =>
      personalTransactions.filter(
        (tx) =>
          tx.confirmed !== false &&
          tx.date >= period.from &&
          tx.date <= period.to,
      ).length,
    [period.from, period.to, personalTransactions],
  );
  const ctx = useMemo(
    () =>
      buildAiCoachingContext(
        personalTransactions,
        savingsGoals,
        categoryBudgets,
        (id) => getCategoryLabel(id, categories, locale),
        period.from,
        period.to,
        categories,
        locale,
      ),
    [
      categories,
      categoryBudgets,
      locale,
      period.from,
      period.to,
      personalTransactions,
      savingsGoals,
    ],
  );

  const missions = buildWeeklyMissions({
    locale,
    periodStart: period.from,
    periodEnd: period.to,
    habit: ctx.personalMemory?.categoryHabits[0] ?? null,
    signals: ctx.smartSignals,
    categoryBudgets: ctx.categoryBudgets,
    savingsGoals: ctx.savingsGoals,
    learnedRulesCount,
    transactionsCount: weekTransactionsCount,
  });
  const allMissionsDone =
    missions.length > 0 && missions.every((mission) => doneMissions.has(mission.id));

  const toggleMission = (id: string) => {
    const next = new Set(doneMissions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDoneMissions(next);
    writeDoneMissions(next);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-sm font-medium">
            {locale === "ru" ? "Миссия недели" : "Weekly mission"}
          </p>
        </div>
        <p className="text-sm leading-snug text-muted-foreground">
          {locale === "ru"
            ? "Одна неделя - один понятный финансовый шаг. Советник выбирает его по вашим операциям, лимитам, целям и памяти."
            : "One week, one clear money move. The advisor chooses it from your entries, limits, goals, and memory."}
        </p>
      </div>

      <ul className="space-y-1.5">
        {missions.map((mission) => {
          const done = doneMissions.has(mission.id);
          return (
            <li
              key={mission.id}
              className={`flex items-start gap-2 rounded-md border p-2.5 ${missionToneClass(mission.tone)} ${
                done ? "opacity-65" : ""
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-7 w-7 shrink-0"
                onClick={() => toggleMission(mission.id)}
                aria-label={done ? "Вернуть миссию" : "Отметить миссию"}
              >
                {done ? (
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                )}
              </Button>
              <div className="min-w-0 text-sm leading-snug">
                <p className={`font-medium ${done ? "line-through" : ""}`}>
                  {mission.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mission.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {allMissionsDone ? (
        <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-3">
          <div className="flex items-start gap-2">
            <Sparkles
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {locale === "ru"
                  ? "Все 3 цели недели закрыты"
                  : "All 3 weekly goals are done"}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-emerald-900/80 dark:text-emerald-100/80">
                {locale === "ru"
                  ? "Отличная работа: вы не просто ведёте учёт, а закрепляете финансовую привычку. На следующей неделе советник подберёт новый шаг."
                  : "Great work: you are not just tracking money, you are building the habit. Next week the advisor will suggest a new step."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
