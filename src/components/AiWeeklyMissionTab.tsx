"use client";

import { CheckCircle2, Circle, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
const AI_MISSION_CACHE_KEY = "voicebudget-ai-weekly-mission-v1";
const AI_MISSION_MIN_TRANSACTIONS = 1;

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

function readCachedAiMission(cacheId: string): AiMission | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AI_MISSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cacheId?: string; mission?: AiMission };
    return parsed.cacheId === cacheId && parsed.mission ? parsed.mission : null;
  } catch {
    return null;
  }
}

function writeCachedAiMission(cacheId: string, mission: AiMission): void {
  try {
    window.localStorage.setItem(AI_MISSION_CACHE_KEY, JSON.stringify({ cacheId, mission }));
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

function essentialCategoryKind(
  category: string,
): "child" | "health" | "debt" | "emergency" | null {
  const normalized = category.toLowerCase();
  if ([
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
  ].some((token) => normalized.includes(token))) {
    return "child";
  }
  if ([
    "здоров",
    "мед",
    "лекар",
    "аптек",
    "врач",
    "клиник",
    "анализ",
    "стомат",
    "health",
    "medical",
    "medicine",
    "pharmacy",
    "doctor",
    "clinic",
    "dental",
  ].some((token) => normalized.includes(token))) {
    return "health";
  }
  if ([
    "долг",
    "кредит",
    "заём",
    "займ",
    "ипотек",
    "loan",
    "debt",
    "credit",
    "mortgage",
  ].some((token) => normalized.includes(token))) {
    return "debt";
  }
  if ([
    "пожар",
    "авар",
    "сроч",
    "ремонт",
    "штраф",
    "emergency",
    "urgent",
    "repair",
    "fine",
  ].some((token) => normalized.includes(token))) {
    return "emergency";
  }
  return null;
}

function essentialHabitDetail(
  kind: NonNullable<ReturnType<typeof essentialCategoryKind>>,
  avgAmount: number,
  locale: Locale,
): string {
  const amount = formatMoney(avgAmount, locale);
  if (locale !== "ru") {
    if (kind === "health") {
      return `Average check ${amount}. Do not cut health blindly: check what is recurring, what can be planned, and whether documents/insurance can reduce pressure.`;
    }
    if (kind === "debt") {
      return `Average payment ${amount}. Debt is a priority: check rate, minimum payment, and choose avalanche or snowball repayment.`;
    }
    if (kind === "emergency") {
      return `Average check ${amount}. Treat it as an emergency signal: separate one-off fires from recurring risks and rebuild a small reserve.`;
    }
    return `Average check ${amount}. Do not cut child-related spending blindly: check what is included, payment plan, and safe optimizations.`;
  }
  if (kind === "health") {
    return `Средний чек ${amount}. Здоровье не режем вслепую: проверьте, что обязательно, что можно запланировать заранее, и где помогут документы, ДМС или налоговый вычет.`;
  }
  if (kind === "debt") {
    return `Средний платёж ${amount}. Долги — приоритет: проверьте ставку, минимальный платёж и выберите стратегию погашения — лавина или снежный ком.`;
  }
  if (kind === "emergency") {
    return `Средний чек ${amount}. Это не статья для жёсткой экономии, а сигнал: отделите разовый пожар от повторяющегося риска и восстановите небольшой резерв.`;
  }
  return `Средний чек ${amount}. Детские расходы не режем вслепую: проверьте, что входит в сумму, план платежей и где можно оптимизировать без вреда для ребёнка.`;
}

function buildWeeklyMissions(params: {
  locale: Locale;
  periodStart: string;
  periodEnd: string;
  habit: { category: string; avgAmount: number; sharePercent: number } | null;
  signals: ReturnType<typeof buildAiCoachingContext>["smartSignals"];
  categoryBudgets: ReturnType<typeof buildAiCoachingContext>["categoryBudgets"];
  savingsGoals: ReturnType<typeof buildAiCoachingContext>["savingsGoals"];
  debtFocus: { name: string; balance: number; minPayment: number; ratePct: number | null } | null;
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
    debtFocus,
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
    const essentialKind = essentialCategoryKind(habit.category);
    add({
      id: `habit:${habit.category}`,
      tone: "habit",
      title: isRu
        ? essentialKind
          ? `Проверить статью «${habit.category}»`
          : `Минус один чек: ${habit.category}`
        : essentialKind
          ? `Review "${habit.category}"`
          : `One less check: ${habit.category}`,
      detail: isRu
        ? essentialKind
          ? essentialHabitDetail(essentialKind, habit.avgAmount, locale)
          : `Средний чек ${formatMoney(habit.avgAmount, locale)}. Если убрать один такой расход в неделю, уже появится запас.`
        : essentialKind
          ? essentialHabitDetail(essentialKind, habit.avgAmount, locale)
          : `Average check ${formatMoney(habit.avgAmount, locale)}. Skip one this week to create breathing room.`,
    });
  }

  if (debtFocus) {
    add({
      id: `debt:${debtFocus.name}`,
      tone: "focus",
      title: isRu ? `Проверить долг «${debtFocus.name}»` : `Review debt "${debtFocus.name}"`,
      detail: isRu
        ? `Остаток ${formatMoney(debtFocus.balance, locale)}, минимальный платёж ${formatMoney(debtFocus.minPayment, locale)}${debtFocus.ratePct ? `, ставка ${debtFocus.ratePct}%` : ""}. Сначала обязательный платёж, затем копилки и комфорт.`
        : `Balance ${formatMoney(debtFocus.balance, locale)}, minimum payment ${formatMoney(debtFocus.minPayment, locale)}${debtFocus.ratePct ? `, rate ${debtFocus.ratePct}%` : ""}. Required payment first, then savings and comfort.`,
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
  const debts = useStore((s) => s.debts);
  const transactions = useViewerMappedTransactions(false);
  const categories = useCategories();
  const [doneMissions, setDoneMissions] = useState(readDoneMissions);
  const [aiMission, setAiMission] = useState<AiMission | null>(null);

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
  const debtFocus = useMemo(() => {
    const active = debts.filter((d) => d.balance > 0);
    if (active.length === 0) return null;
    return [...active].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
      const ar = a.ratePct ?? 0;
      const br = b.ratePct ?? 0;
      if (br !== ar) return br - ar;
      return a.balance - b.balance;
    })[0];
  }, [debts]);

  const ruleMissions = useMemo(
    () =>
      buildWeeklyMissions({
        locale,
        periodStart: period.from,
        periodEnd: period.to,
        habit: ctx.personalMemory?.categoryHabits[0] ?? null,
        signals: ctx.smartSignals,
        categoryBudgets: ctx.categoryBudgets,
        savingsGoals: ctx.savingsGoals,
        debtFocus,
        learnedRulesCount,
        transactionsCount: weekTransactionsCount,
      }),
    [
      ctx.categoryBudgets,
      ctx.personalMemory?.categoryHabits,
      ctx.savingsGoals,
      ctx.smartSignals,
      debtFocus,
      learnedRulesCount,
      locale,
      period.from,
      period.to,
      weekTransactionsCount,
    ],
  );
  const aiMissionCacheId = `${period.from}:${period.to}:${locale}:v2`;

  useEffect(() => {
    const cached = readCachedAiMission(aiMissionCacheId);
    if (cached) {
      setAiMission(cached);
      return;
    }
    if (weekTransactionsCount < AI_MISSION_MIN_TRANSACTIONS) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch("/api/weekly-mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            periodStart: period.from,
            periodEnd: period.to,
            transactionsCount: weekTransactionsCount,
            learnedRulesCount,
            context: {
              personalMemory: ctx.personalMemory,
              smartSignals: ctx.smartSignals,
              categoryBudgets: ctx.categoryBudgets,
              savingsGoals: ctx.savingsGoals,
              debtFocus,
            },
            ruleMissions: ruleMissions.map(({ title, detail, tone }) => ({
              title,
              detail,
              tone,
            })),
          }),
          signal: controller.signal,
        });
        const json = (await res.json()) as {
          success?: boolean;
          mission?: Omit<AiMission, "id">;
        };
        if (!res.ok || !json.success || !json.mission) return;
        const mission: AiMission = {
          id: `${period.from}:${period.to}:ai-fin-advisor`,
          ...json.mission,
        };
        setAiMission(mission);
        writeCachedAiMission(aiMissionCacheId, mission);
      } catch {
        /* Rules remain as a stable fallback. */
      }
    };
    void run();
    return () => controller.abort();
  }, [
    aiMissionCacheId,
    ctx.categoryBudgets,
    ctx.personalMemory,
    ctx.savingsGoals,
    ctx.smartSignals,
    debtFocus,
    learnedRulesCount,
    locale,
    period.from,
    period.to,
    ruleMissions,
    weekTransactionsCount,
  ]);

  const mainMission = aiMission ?? ruleMissions[0] ?? null;
  const supportMissions = mainMission
    ? ruleMissions
        .filter((mission) => mission.id !== mainMission.id && mission.title !== mainMission.title)
        .slice(0, 2)
    : [];
  const missions = mainMission ? [mainMission, ...supportMissions] : ruleMissions;
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
        <p className="mt-2 text-xs leading-snug text-primary">
          {aiMission
            ? locale === "ru"
              ? "Главная миссия выбрана по вашему поведению за неделю."
              : "The main mission was chosen from your weekly behavior."
            : locale === "ru"
              ? "Главная миссия уже выбрана по вашим данным. Она станет точнее, когда накопится достаточно свежих операций."
              : "The main mission is selected from your data. AI will strengthen it when there is enough fresh activity."}
        </p>
      </div>

      <ul className="space-y-1.5">
        {missions.map((mission, index) => {
          const done = doneMissions.has(mission.id);
          const isMain = index === 0;
          return (
            <li
              key={mission.id}
              className={`flex items-start gap-2 rounded-md border ${
                isMain ? "p-3 ring-1 ring-primary/15" : "p-2.5"
              } ${missionToneClass(mission.tone)} ${
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
                {isMain ? (
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-normal text-primary">
                    {locale === "ru" ? "Главная миссия недели" : "Main weekly mission"}
                  </p>
                ) : null}
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
