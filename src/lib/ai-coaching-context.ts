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

export type FamilyAdvisorSpotlight = {
  title: string;
  text: string;
  action: string;
  tone: "ok" | "watch" | "risk";
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
  const safeDailySpend = balance > 0 ? Math.floor(balance / remainingDays) : null;
  const expectedPace = periodDays > 0 ? expenses / periodDays : expenses;
  const actualPace = elapsedDays > 0 ? expenses / elapsedDays : expenses;
  const spendingPace =
    actualPace > expectedPace * 1.18
      ? "above_normal"
      : actualPace < expectedPace * 0.82
        ? "below_normal"
        : "normal";
  const cashflowRisk = balance < 0 ? "high" : safeDailySpend === null || safeDailySpend < 500 ? "medium" : "low";
  const nextStep =
    locale === "ru"
      ? cashflowRisk === "high"
        ? "Сначала сверить обязательные платежи до конца периода и отделить их от гибких расходов."
        : cashflowRisk === "medium"
          ? "Держать покупки в режиме паузы 24 часа: сначала обязательное, потом комфорт."
          : "Выбрать одну категорию недели и удержать её без жёстких запретов."
      : cashflowRisk === "high"
        ? "First reconcile required payments until the period ends and separate them from flexible spending."
        : cashflowRisk === "medium"
          ? "Use a 24-hour pause for purchases: essentials first, comfort second."
          : "Pick one weekly category to keep steady without harsh restrictions.";

  return {
    savingsGoals,
    categoryBudgets,
    personalMemory: buildAiMemorySnapshot(transactions, categories, locale),
    smartSignals: {
      safeDailySpend,
      spendingPace,
      cashflowRisk,
      nextStep,
    },
  };
}

export function buildFamilyAdvisorSpotlight(
  ctx: AiCoachingContext,
  locale: Locale,
): FamilyAdvisorSpotlight | null {
  const isRu = locale === "ru";
  const overLimit = ctx.categoryBudgets
    .filter((budget) => budget.overLimit)
    .sort((a, b) => b.spent - b.limit - (a.spent - a.limit))[0];
  if (overLimit) {
    const over = Math.max(0, Math.round(overLimit.spent - overLimit.limit));
    return {
      title: isRu ? "Категория требует внимания" : "Category needs attention",
      text: isRu
        ? `${overLimit.category}: выше лимита на ${over.toLocaleString("ru-RU")} ₽. Это не повод ругать себя, а сигнал проверить, лимит реалистичный или расход разовый.`
        : `${overLimit.category}: ${over.toLocaleString("en-US")} RUB over limit. Not a reason to blame yourself — check if the limit is realistic or the spend was one-off.`,
      action: isRu
        ? `До конца недели держать ${overLimit.category} без новых необязательных покупок.`
        : `Keep ${overLimit.category} free of new non-essential purchases until week end.`,
      tone: "risk",
    };
  }

  const habit = ctx.personalMemory?.categoryHabits[0] ?? null;
  if (habit && habit.sharePercent >= 40) {
    return {
      title: isRu ? "Главная зона расходов" : "Main spending zone",
      text: isRu
        ? `${habit.category}: ${habit.sharePercent}% расходов периода, средний чек ${habit.avgAmount.toLocaleString("ru-RU")} ₽. Важно понять: это плановый блок или утечка.`
        : `${habit.category}: ${habit.sharePercent}% of period expenses, avg ${habit.avgAmount.toLocaleString("en-US")} RUB. Check whether this is planned or leaking money.`,
      action: isRu
        ? `Посмотреть 3 последние операции в категории «${habit.category}» и отметить одну, которую можно повторять реже.`
        : `Review the last 3 ${habit.category} entries and pick one to repeat less often.`,
      tone: "watch",
    };
  }

  const strongGoal = ctx.savingsGoals
    .filter((goal) => goal.progressPercent > 0)
    .sort((a, b) => b.progressPercent - a.progressPercent)[0];
  if (strongGoal?.onTrack) {
    return {
      title: isRu ? "Хороший финансовый темп" : "Good financial pace",
      text: isRu
        ? `Цель «${strongGoal.name}» уже закрыта на ${strongGoal.progressPercent}%. Это как раз та привычка, которая строит капитал без рывков.`
        : `Goal "${strongGoal.name}" is ${strongGoal.progressPercent}% funded. This is the kind of habit that builds capital steadily.`,
      action: isRu
        ? "Сохранить автопополнение или тот же взнос в следующем периоде."
        : "Keep the same transfer or contribution next period.",
      tone: "ok",
    };
  }

  if (ctx.smartSignals?.cashflowRisk === "high") {
    return {
      title: isRu ? "Нужна ревизия периода" : "Period review needed",
      text: isRu
        ? "По операциям свободный запас периода не виден. Это не оценка реального баланса: доход мог прийти раньше, а расходы идут сейчас."
        : "The entries do not show a free buffer for this period. This is not your real account balance: income may have arrived earlier while expenses are current.",
      action: isRu
        ? "Отделить обязательные платежи до конца периода от гибких расходов и выбрать одну категорию для паузы на 48 часов."
        : "Separate required payments from flexible spending and pause one category for 48 hours.",
      tone: "watch",
    };
  }

  const rulesCount = ctx.personalMemory?.learnedRules.length ?? 0;
  if (rulesCount >= 3) {
    return {
      title: isRu ? "Память уже помогает" : "Memory is already helping",
      text: isRu
        ? `Финансовая память знает ${rulesCount} правил: привычные слова будут точнее попадать в категории.`
        : `Financial memory knows ${rulesCount} rules: familiar words should land in better categories.`,
      action: isRu
        ? "Если категория ошиблась — исправьте её. Это самый сильный сигнал для обучения."
        : "If a category is wrong, correct it. That is the strongest learning signal.",
      tone: "ok",
    };
  }

  if (habit) {
    return {
      title: isRu ? "Появляется картина привычек" : "Habit picture is forming",
      text: isRu
        ? `${habit.category}: ${habit.sharePercent}% расходов периода. Пока это наблюдение, не вывод.`
        : `${habit.category}: ${habit.sharePercent}% of period expenses. For now this is an observation, not a verdict.`,
      action: isRu
        ? "Продолжить записывать обычные траты: через неделю совет будет точнее."
        : "Keep logging everyday expenses: next week the advice will be sharper.",
      tone: "ok",
    };
  }

  return null;
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
