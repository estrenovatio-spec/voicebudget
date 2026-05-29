import {
  buildBudgetSummary,
  getDaysTracked,
  type BudgetSummary,
} from "@/lib/budget-analytics";
import type { AdvisorConfig } from "@/lib/advisor-config";
import { advisorPlanningWithRu } from "@/lib/advisor-config";
import type { Locale, Transaction } from "@/types";

export const WEEKLY_ANALYSIS_DAYS = 7;
/** Минимум записей за 7 дней для полноценного AI-разбора */
export const WEEKLY_MIN_TRANSACTIONS = 5;
/** Минимум дней ведения бюджета до первого разбора */
export const WEEKLY_MIN_DAYS_TRACKED = 7;

export interface WeeklySummary extends BudgetSummary {
  periodStart: string;
  periodEnd: string;
  weekTransactionCount: number;
}

export type WeeklyGateReason =
  | "waiting_first_week"
  | "need_more_entries"
  | "sparse_week"
  | "ready";

export interface WeeklyGate {
  ready: boolean;
  reason: WeeklyGateReason;
  daysUntilFirst?: number;
  entriesNeeded?: number;
}

function parseDate(date: string): Date {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function buildWeeklySummary(
  transactions: Transaction[],
  trackingStartedAt: string | null,
  resolveCategoryLabel: (categoryId: string) => string,
): WeeklySummary {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - WEEKLY_ANALYSIS_DAYS);
  start.setHours(0, 0, 0, 0);

  const weekTxs = transactions.filter((tx) => {
    const d = parseDate(tx.date);
    return d >= start && d <= end;
  });

  const base = buildBudgetSummary(weekTxs, trackingStartedAt, resolveCategoryLabel);
  const daysTrackedAll = getDaysTracked(trackingStartedAt, transactions);

  return {
    ...base,
    daysTracked: daysTrackedAll,
    transactionCount: weekTxs.length,
    weekTransactionCount: weekTxs.length,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export function getWeeklyGate(
  summary: WeeklySummary,
  trackingStartedAt: string | null,
  transactions: Transaction[],
): WeeklyGate {
  const daysTracked = getDaysTracked(trackingStartedAt, transactions);

  if (daysTracked < WEEKLY_MIN_DAYS_TRACKED) {
    return {
      ready: false,
      reason: "waiting_first_week",
      daysUntilFirst: WEEKLY_MIN_DAYS_TRACKED - daysTracked,
    };
  }

  if (summary.weekTransactionCount < WEEKLY_MIN_TRANSACTIONS) {
    return {
      ready: false,
      reason: "need_more_entries",
      entriesNeeded: WEEKLY_MIN_TRANSACTIONS - summary.weekTransactionCount,
    };
  }

  const onlyExpenses = summary.totalIncome === 0 && summary.totalExpense > 0;
  if (onlyExpenses && summary.weekTransactionCount < WEEKLY_MIN_TRANSACTIONS + 2) {
    return { ready: false, reason: "sparse_week" };
  }

  return { ready: true, reason: "ready" };
}

/** @deprecated use getWeeklyGate */
export function isEligibleForWeeklyAnalysis(summary: WeeklySummary): boolean {
  return summary.weekTransactionCount >= WEEKLY_MIN_TRANSACTIONS;
}

export function getWeeklyWaitingMessages(
  gate: WeeklyGate,
  locale: Locale,
  summary: WeeklySummary,
): string[] {
  const isRu = locale === "ru";

  if (gate.reason === "waiting_first_week") {
    const d = gate.daysUntilFirst ?? WEEKLY_MIN_DAYS_TRACKED;
    return [
      isRu
        ? `Первый AI-разбор откроется через ${d} ${d === 1 ? "день" : d < 5 ? "дня" : "дней"}. Пока просто записывайте траты — без оценок.`
        : `First AI review unlocks in ${d} day(s). Just log expenses for now — no judgments.`,
    ];
  }

  if (gate.reason === "need_more_entries") {
    const n = gate.entriesNeeded ?? 1;
    return [
      isRu
        ? `За неделю ${summary.weekTransactionCount} ${summary.weekTransactionCount === 1 ? "запись" : "записи"} — для разбора нужно ещё ${n}. Добавьте доходы и расходы, тогда советы будут по делу.`
        : `${summary.weekTransactionCount} entries this week — add ${n} more (income and expenses) for a fair review.`,
    ];
  }

  if (gate.reason === "sparse_week") {
    return [
      isRu
        ? "Пока видны только расходы без доходов за неделю — рано делать выводы. Отметьте зарплату или поступления, и на следующей неделе разбор будет мягче и точнее."
        : "Only expenses logged this week — add income entries too before we draw conclusions.",
    ];
  }

  return [];
}

export const WEEKLY_ANALYSIS_PROMPT = (
  summary: WeeklySummary,
  locale: Locale,
  advisor: AdvisorConfig,
) => {
  const lang = locale === "ru" ? "Russian" : "English";
  const limited = summary.weekTransactionCount < 8;

  return `
You are a calm financial mentor. Weekly review for ${summary.periodStart} — ${summary.periodEnd}.

Data (JSON):
${JSON.stringify(summary, null, 2)}

Critical rules:
- Respond in ${lang}.
- Return ONLY JSON: { "tips": string[] }
- Give ${limited ? "2–3" : "4–5"} tips only.
- Tone: warm, zero shame, zero lecturing. User is learning to track money, not failing a test.
- ${limited ? "Data is LIMITED — say that explicitly. Do NOT invent patterns. No dramatic warnings." : "Use real numbers from data."}
- Never scold for one big expense or negative balance alone — suggest one small next step.
- Do NOT tell user to cut everything; max one gentle limit idea.
- Russia context: RUB, optional mention of subscriptions/inflation — no tax/legal advice.
- Last tip (optional, soft): ${locale === "ru" ? advisorPlanningWithRu(advisor) : `deeper plan with ${advisor.name} — ${advisor.contact}`}.
`;
};

export function ruleBasedWeeklyAnalysis(
  summary: WeeklySummary,
  locale: Locale,
  advisor: AdvisorConfig,
): string[] {
  const isRu = locale === "ru";

  return [
    isRu
      ? `За 7 дней: доход ${summary.totalIncome.toLocaleString("ru-RU")} ₽, расход ${summary.totalExpense.toLocaleString("ru-RU")} ₽. Это снимок, не приговор — продолжайте вести учёт.`
      : `7 days: income ${summary.totalIncome}, expenses ${summary.totalExpense}. A snapshot, not a verdict — keep logging.`,
    isRu
      ? "На следующей неделе картина станет яснее — главное не бросать записи."
      : "Next week the picture will be clearer — keep logging.",
    isRu
      ? advisorPlanningWithRu(advisor)
      : `Planning help — ${advisor.name}: ${advisor.contact}`,
  ];
}
