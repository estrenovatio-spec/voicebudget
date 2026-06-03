import type { CategoryBudget, SavingsGoal } from "@/types/planning";
import type { Locale, Transaction } from "@/types";

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
};

export function buildAiCoachingContext(
  transactions: Transaction[],
  goals: SavingsGoal[],
  budgets: CategoryBudget[],
  resolveCategoryLabel: (id: string) => string,
  periodStart: string,
  periodEnd: string,
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

  return { savingsGoals, categoryBudgets };
}

export function coachingPromptBlock(ctx: AiCoachingContext, locale: Locale): string {
  if (ctx.savingsGoals.length === 0 && ctx.categoryBudgets.length === 0) return "";

  const isRu = locale === "ru";
  return `
Coaching data (praise progress, never shame):
${JSON.stringify(ctx, null, 2)}

Coaching rules:
- ${isRu ? "Если копилка пополняется или прогресс хороший — похвалите искренне." : "If savings goals show deposits or good progress — praise warmly."}
- ${isRu ? "Если лимит категории НЕ превышен — отметьте это позитивно." : "If category limit NOT exceeded — mention positively."}
- ${isRu ? "Если лимит превышен — НЕ ругайте. Мягко: «вижу перерасход, в следующем месяце можно сдвинуть лимит или чуть сократить траты»." : "If over limit — NO scolding. Gentle: note overspend, suggest adjusting limit next month."}
- Do not invent goals or limits not in JSON.
`;
}
