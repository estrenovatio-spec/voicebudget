import { roundMoneyUp } from "@/lib/format-money";
import { getCurrentBudgetPeriod, isDateInBudgetPeriod } from "@/lib/budget-period";
import type { Transaction } from "@/types";
import type { SavingsGoal } from "@/types/planning";
import { EMERGENCY_GOAL_ID } from "@/types/planning";

/** @deprecated use getCurrentBudgetPeriod */
export function currentMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

export function monthSpentByCategory(
  transactions: Transaction[],
  categoryId: string,
  monthStartDay = 1,
): number {
  const period = getCurrentBudgetPeriod(monthStartDay);
  return transactions
    .filter(
      (tx) =>
        tx.type === "expense" &&
        tx.categoryId === categoryId &&
        isDateInBudgetPeriod(tx.date, period),
    )
    .reduce((s, tx) => s + tx.amount, 0);
}

/** Средний месячный расход за последние 90 дней */
export function avgMonthlyExpenses(transactions: Transaction[], days = 90): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const total = transactions
    .filter((tx) => tx.type === "expense" && new Date(tx.date) >= cutoff)
    .reduce((s, tx) => s + tx.amount, 0);
  return roundMoneyUp(total / Math.max(1, days / 30));
}

export function emergencyTargetAmount(
  transactions: Transaction[],
  months: number,
): number {
  return roundMoneyUp(avgMonthlyExpenses(transactions) * months);
}

export function resolveGoalTarget(goal: SavingsGoal, transactions: Transaction[]): number {
  if (goal.kind === "emergency" && goal.emergencyMonths) {
    return emergencyTargetAmount(transactions, goal.emergencyMonths);
  }
  return goal.targetAmount;
}

export function goalProgressPercent(goal: SavingsGoal, transactions: Transaction[]): number {
  const target = resolveGoalTarget(goal, transactions);
  if (target <= 0) return 0;
  return Math.min(100, Math.round((goal.savedAmount / target) * 100));
}

/** Сколько полных календарных месяцев осталось до срока (минимум 1). */
export function monthsUntilDeadline(deadline: string, fromDate: Date = new Date()): number {
  const end = new Date(`${deadline}T12:00:00`);
  const from = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
    12,
    0,
    0,
  );
  if (Number.isNaN(end.getTime())) return 1;
  if (end.getTime() <= from.getTime()) return 1;

  let months =
    (end.getFullYear() - from.getFullYear()) * 12 + (end.getMonth() - from.getMonth());
  if (end.getDate() < from.getDate()) months -= 1;
  return Math.max(1, months);
}

/** План в месяц: (цель − накоплено) / месяцев до срока. */
export function computeGoalMonthlyContribution(
  targetAmount: number,
  savedAmount: number,
  deadline: string | null,
  fromDate?: Date,
): number | null {
  if (!deadline || targetAmount <= 0) return null;
  const remaining = Math.max(0, roundMoneyUp(targetAmount) - roundMoneyUp(savedAmount));
  if (remaining <= 0) return null;
  const months = monthsUntilDeadline(deadline, fromDate);
  return roundMoneyUp(remaining / months);
}

export function resolveGoalMonthlyContribution(goal: SavingsGoal): number | null {
  return computeGoalMonthlyContribution(goal.targetAmount, goal.savedAmount, goal.deadline);
}

export function applyGoalMonthlyToGoal(goal: SavingsGoal): SavingsGoal {
  return {
    ...goal,
    monthlyContribution: computeGoalMonthlyContribution(
      goal.targetAmount,
      goal.savedAmount,
      goal.deadline,
    ),
  };
}

export function budgetUsagePercent(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.round((spent / limit) * 100);
}

export function advanceRecurringDate(
  dateIso: string,
  frequency: "weekly" | "monthly" | "yearly",
  dayOfMonth: number | null,
): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (frequency === "monthly") {
    d.setMonth(d.getMonth() + 1);
    if (dayOfMonth) d.setDate(Math.min(dayOfMonth, 28));
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export function defaultEmergencyGoal(emergencyMonths = 6): SavingsGoal {
  return {
    id: EMERGENCY_GOAL_ID,
    name: "Подушка безопасности",
    targetAmount: 0,
    savedAmount: 0,
    deadline: null,
    monthlyContribution: null,
    kind: "emergency",
    emergencyMonths,
  };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
