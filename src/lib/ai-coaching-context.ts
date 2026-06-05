import type { CategoryBudget, SavingsGoal } from "@/types/planning";
import type { CategoryDefinition, Locale, Transaction } from "@/types";
import { buildAiMemorySnapshot, type AiMemoryInsight, type AiMemoryRule } from "@/lib/ai-memory";

export type AiCoachingContext = {
  savingsGoals: {
    name: string;
    saved: number;
    target: number;
    monthlyContribution: number;
    progressPercent: number;
    onTrack: boolean;
  }[];
  categoryBudgets: {
    category: string;
    limit: number;
    spent: number;
    remaining: number;
    overLimit: boolean;
  }[];
  personalMemory?: {
    learnedRules: AiMemoryRule[];
    frequentMerchants: { phrase: string; categoryId: string; count: number }[];
    categoryHabits: { category: string; count: number; avgAmount: number; sharePercent: number }[];
    insights: AiMemoryInsight[];
  };
  smartSignals?: {
    safeDailySpend: number | null;
    spendingPace: "below_normal" | "normal" | "above_normal";
    cashflowRisk: "low" | "medium" | "high";
    nextStep: string;
  };
};

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1);
}

export function buildAiCoachingContext(
  transactions: Transaction[],
  goals: SavingsGoal[],
  budgets: CategoryBudget[],
  resolveCategoryLabel: (id: string) => string,
  periodStart: string,
  periodEnd: string,
  categories: CategoryDefinition[] = [],
  locale: Locale = "ru",
): AiCoachingContext {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  end.setHours(23, 59, 59, 999);

  const inPeriod = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d >= start && d <= end && tx.confirmed !== false;
  });

  const savingsGoals = goals
    .filter((g) => g.targetAmount > 0)
    .map((g) => {
      const progressPercent =
        g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0;
      const monthly = g.monthlyContribution ?? 0;
      const onTrack = monthly > 0 ? g.savedAmount >= monthly * 0.5 : g.savedAmount > 0;
      return {
        name: g.name,
        saved: g.savedAmount,
        target: g.targetAmount,
        monthlyContribution: monthly,
        progressPercent,
        onTrack,
      };
    });

  const categoryBudgets = budgets
    .filter((b) => b.monthlyLimit > 0)
    .map((b) => {
      const spent = inPeriod
        .filter((tx) => tx.type === "expense" && tx.categoryId === b.categoryId)
        .reduce((s, tx) => s + tx.amount, 0);
      const remaining = Math.max(0, b.monthlyLimit - spent);
      return {
        category: resolveCategoryLabel(b.categoryId),
        limit: b.monthlyLimit,
        spent,
        remaining,
        overLimit: spent > b.monthlyLimit,
      };
    });

  const income = inPeriod
    .filter((tx) => tx.type === "income")
    .reduce((s, tx) => s + tx.amount, 0);
  const expenses = inPeriod
    .filter((tx) => tx.type === "expense")
    .reduce((s, tx) => s + tx.amount, 0);
  const periodDays = daysBetween(periodStart, periodEnd);
  const elapsedDays = Math.min(periodDays, daysBetween(periodStart, new Date().toISOString().slice(0, 10)));
  const remainingDays = Math.max(1, periodDays - elapsedDays);
  const balance = income - expenses;
  const safeDailySpend = balance > 0 ? Math.floor(balance / remainingDays) : 0;
  const expectedPace = periodDays > 0 ? expenses / periodDays : expenses;
  const actualPace = elapsedDays > 0 ? expenses / elapsedDays : expenses;
  const spendingPace =
    actualPace > expectedPace * 1.18
      ? "above_normal"
      : actualPace < expectedPace * 0.82
        ? "below_normal"
        : "normal";
  const cashflowRisk = balance < 0 ? "high" : safeDailySpend < 500 ? "medium" : "low";

  return {
    savingsGoals,
    categoryBudgets,
    personalMemory: buildAiMemorySnapshot(transactions, categories, locale),
    smartSignals: {
      safeDailySpend,
      spendingPace,
      cashflowRisk,
      nextStep:
        locale === "ru"
          ? cashflowRisk === "high"
            ? "Сначала найти обязательные платежи и остановить необязательные расходы на 48 часов."
            : "Выбрать один лимит на ближайшие 7 дней и отслеживать его ежедневно."
          : cashflowRisk === "high"
            ? "Find required payments first and pause non-essential spending for 48 hours."
            : "Pick one limit for the next 7 days and check it daily.",
    },
  };
}

export function coachingPromptBlock(ctx: AiCoachingContext, locale: Locale): string {
  if (
    ctx.savingsGoals.length === 0 &&
    ctx.categoryBudgets.length === 0 &&
    !ctx.personalMemory?.learnedRules.length &&
    !ctx.personalMemory?.categoryHabits.length &&
    !ctx.smartSignals
  ) {
    return "";
  }

  const isRu = locale === "ru";
  return `
Coaching data (praise progress, never shame):
${JSON.stringify(ctx, null, 2)}

Coaching rules:
- ${isRu ? "Если копилка пополняется или прогресс хороший — похвалите искренне." : "If savings goals show deposits or good progress — praise warmly."}
- ${isRu ? "Если лимит категории НЕ превышен — отметьте это позитивно." : "If category limit NOT exceeded — mention positively."}
- ${isRu ? "Если лимит превышен — НЕ ругайте. Мягко: «вижу перерасход, в следующем месяце можно сдвинуть лимит или чуть сократить траты»." : "If over limit — NO scolding. Gentle: note overspend, suggest adjusting limit next month."}
- ${isRu ? "Используйте personalMemory как память привычек: частые места, исправления категорий, типичные суммы. Не называйте это слежкой." : "Use personalMemory as habit memory: frequent merchants, corrections, typical amounts. Do not make it creepy."}
- ${isRu ? "Если smartSignals.cashflowRisk high/medium — дайте один практический шаг на 24–48 часов." : "If smartSignals.cashflowRisk is high/medium, give one practical 24–48h step."}
- Do not invent goals or limits not in JSON.
	`;
}
