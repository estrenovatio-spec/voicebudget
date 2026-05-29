import type { BudgetOwner, TxType } from "@/types";

export type SavingsGoalKind = "custom" | "emergency";

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  kind: SavingsGoalKind;
  /** 3 или 6 — только для kind=emergency */
  emergencyMonths: number | null;
  updatedAt?: string;
}

export interface CategoryBudget {
  categoryId: string;
  monthlyLimit: number;
  updatedAt?: string;
}

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringTransaction {
  id: string;
  amount: number;
  type: TxType;
  categoryId: string;
  note: string;
  owner: BudgetOwner;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  nextRunDate: string;
  enabled: boolean;
  updatedAt?: string;
}

export const EMERGENCY_GOAL_ID = "__emergency_fund__";

export type PlanningInputAction =
  | { kind: "goal_deposit"; goalId: string; amount: number }
  | { kind: "goal_create"; name: string; targetAmount: number }
  | { kind: "goal_deposit_by_name"; goalName: string; amount: number }
  | {
      kind: "income_with_goal";
      incomeAmount: number;
      goalAmount: number;
      goalName: string;
      goalId?: string;
      sourceText: string;
    };
