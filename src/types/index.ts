export type TxType = "income" | "expense";

export interface CategoryDefinition {
  id: string;
  type: TxType;
  labels: { ru: string; en: string };
  keywords: string[];
  isSystem: boolean;
}
export type Currency = "RUB" | "USD" | "EUR";
export type BudgetOwner = "me" | "partner";
export type HouseholdFilter = "all" | BudgetOwner;

export interface Transaction {
  id: string;
  amount: number;
  type: TxType;
  categoryId: string;
  currency: Currency;
  note: string;
  date: string;
  owner: BudgetOwner;
  /** Сумма, переведённая в копилку из этой операции */
  goalId?: string | null;
  goalAmount?: number | null;
  /** ISO — с облака; для слияния при синхронизации */
  updatedAt?: string;
}
export type Locale = "ru" | "en";

export interface ParsedTransaction {
  amount: number;
  type: TxType;
  categoryId: string;
  currency: Currency;
  note: string;
  date: string;
  owner?: BudgetOwner;
  goalId?: string | null;
  goalAmount?: number | null;
}

/** @deprecated persisted legacy shape */
export interface LegacyTransaction extends Omit<Transaction, "categoryId" | "owner"> {
  category?: string;
}
