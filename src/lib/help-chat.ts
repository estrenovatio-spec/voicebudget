import { getCategoryLabel } from "@/lib/categories";
import { formatIsoPeriod } from "@/lib/format-date";
import { buildFaqKnowledgeText } from "@/lib/help-faq-content";
import {
  buildChatSummaryForQuestion,
  buildPeriodSummary,
  MAX_CHAT_ANALYSIS_DAYS,
  type MonthlySummary,
} from "@/lib/monthly-analysis";
import type { CategoryDefinition, Locale, Transaction } from "@/types";
import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";

/** Max messages sent to LLM per request (full history kept in UI/storage). */
export const HELP_CHAT_LLM_HISTORY_MAX = 40;
export const HELP_CHAT_RECENT_TX_LIMIT = 50;

export type HelpChatMessage = { role: "user" | "assistant"; content: string };

export type HelpChatDataSource = "cloud_db" | "client_device" | "none";

export interface HelpChatContext {
  locale: Locale;
  dataSource: HelpChatDataSource;
  partnerLabel: string | null;
  summary: MonthlySummary | null;
  recentTransactions: CompactTx[];
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
}

type CompactTx = {
  date: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  note: string;
  owner: string;
  goalAmount?: number;
};

function compactTransactions(
  transactions: Transaction[],
  categories: CategoryDefinition[],
  locale: Locale,
  partnerLabel: string | null,
  limit: number,
): CompactTx[] {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.slice(0, limit).map((tx) => ({
    date: tx.date,
    type: tx.type,
    amount: tx.amount,
    category: getCategoryLabel(tx.categoryId, categories, locale),
    note: (tx.note ?? "").slice(0, 80),
    owner:
      tx.owner === "partner" && partnerLabel?.trim()
        ? partnerLabel.trim()
        : tx.owner === "partner"
          ? "partner"
          : "me",
    ...(tx.goalAmount != null && tx.goalAmount > 0 ? { goalAmount: tx.goalAmount } : {}),
  }));
}

export function buildHelpChatContext(params: {
  locale: Locale;
  dataSource: HelpChatDataSource;
  transactions: Transaction[];
  categories: CategoryDefinition[];
  trackingStartedAt: string | null;
  partnerLabel: string | null;
  question: string;
  savingsGoals?: SavingsGoal[];
  categoryBudgets?: CategoryBudget[];
  recurringTransactions?: RecurringTransaction[];
}): HelpChatContext {
  const {
    locale,
    dataSource,
    transactions,
    categories,
    trackingStartedAt,
    partnerLabel,
    question,
    savingsGoals = [],
    categoryBudgets = [],
    recurringTransactions = [],
  } = params;

  const resolveLabel = (id: string) => getCategoryLabel(id, categories, locale);

  let summary: MonthlySummary | null = null;
  if (transactions.length > 0) {
    const base = buildPeriodSummary(
      transactions,
      trackingStartedAt,
      resolveLabel,
      MAX_CHAT_ANALYSIS_DAYS,
    );
    summary = buildChatSummaryForQuestion(
      question,
      base,
      transactions,
      trackingStartedAt,
      resolveLabel,
    );
  }

  return {
    locale,
    dataSource,
    partnerLabel,
    summary,
    recentTransactions: compactTransactions(
      transactions,
      categories,
      locale,
      partnerLabel,
      HELP_CHAT_RECENT_TX_LIMIT,
    ),
    savingsGoals,
    categoryBudgets,
    recurringTransactions,
  };
}

export function HELP_CHAT_SYSTEM(ctx: HelpChatContext): string {
  const lang = ctx.locale === "ru" ? "Russian" : "English";
  const sourceNote =
    ctx.dataSource === "cloud_db"
      ? "Financial data loaded from the user's cloud database (authoritative)."
      : ctx.dataSource === "client_device"
        ? "Financial data from this device (local store; may differ from cloud if not synced)."
        : "No transaction data available.";

  const financeBlock = ctx.summary
    ? `Summary JSON (period ${formatIsoPeriod(ctx.summary.periodStart, ctx.summary.periodEnd, ctx.locale)}, ${ctx.summary.monthTransactionCount} entries in period):
${JSON.stringify(ctx.summary, null, 2)}

Recent transactions (newest first, up to ${HELP_CHAT_RECENT_TX_LIMIT}):
${JSON.stringify(ctx.recentTransactions, null, 2)}

Savings goals: ${JSON.stringify(ctx.savingsGoals)}
Category monthly limits: ${JSON.stringify(ctx.categoryBudgets)}
Recurring rules: ${JSON.stringify(ctx.recurringTransactions)}
Partner label for "partner" owner: ${ctx.partnerLabel ?? "(not set)"}`
    : `No transactions yet. For spending/income questions, tell the user to log entries (voice, text, or bot).`;

  return `You are the assistant for the "Budget" (VoiceBudget) Telegram app — personal and family budget tracking.

Respond in ${lang}. Be concise (2–4 short paragraphs or a short list). Friendly, no shame.

The user has NO other help screens — all questions about how the app works must be answered from APP HELP below.
For their money, use only USER FINANCES JSON.

Rules:
- App usage, bot, cloud, subscription, voice, categories, planning → APP HELP only.
- Spending, income, trends, categories, goals → USER FINANCES only; never invent numbers.
- No tax, legal, or specific investment product advice.
- If finances are asked but data is empty, explain briefly and suggest logging a few transactions.
- ${sourceNote}

=== APP HELP (FAQ) ===
${buildFaqKnowledgeText(ctx.locale)}

=== USER FINANCES ===
${financeBlock}`;
}
