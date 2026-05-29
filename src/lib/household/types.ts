import type { CategoryDefinition, Transaction } from "@/types";
import type { CategoryBudget, RecurringTransaction, SavingsGoal } from "@/types/planning";

export interface HouseholdPublic {
  id: string;
  name: string;
  mode: "solo" | "shared";
  inviteCode: string;
  partnerLabel: string | null;
  memberCount: number;
}

export interface SyncPayload {
  household: HouseholdPublic;
  transactions: Transaction[];
  categories: CategoryDefinition[];
  savingsGoals: SavingsGoal[];
  categoryBudgets: CategoryBudget[];
  recurringTransactions: RecurringTransaction[];
}
