import type { Category, Transaction as DbTransaction } from "@prisma/client";
import { migrateCategoryId } from "@/lib/categories";
import { normalizeAppCurrency } from "@/lib/app-currency";
import type { CategoryDefinition, Transaction } from "@/types";

export function dbCategoryToApp(row: Category): CategoryDefinition {
  const id = migrateCategoryId(row.id);
  return {
    id,
    type: row.type,
    labels: { ru: row.labelRu, en: row.labelEn },
    keywords: row.keywords ?? [],
    isSystem: row.isSystem,
  };
}

export function dbTransactionToApp(row: DbTransaction): Transaction {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type,
    categoryId: migrateCategoryId(row.categoryId),
    currency: normalizeAppCurrency(row.currency),
    note: row.note,
    date: row.date,
    owner: (row.owner === "partner" ? "partner" : "me") as Transaction["owner"],
    goalId: row.goalId ?? null,
    goalAmount: row.goalAmount ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function appCategoryToDb(
  householdId: string,
  cat: CategoryDefinition,
): Omit<Category, "householdId"> & { householdId: string } {
  return {
    householdId,
    id: cat.id,
    type: cat.type,
    labelRu: cat.labels.ru,
    labelEn: cat.labels.en,
    keywords: cat.keywords,
    isSystem: cat.isSystem,
  };
}

export function appTransactionToDb(
  householdId: string,
  tx: Transaction,
  createdBy?: string,
): Omit<DbTransaction, "createdAt" | "updatedAt"> {
  return {
    id: tx.id,
    householdId,
    amount: tx.amount,
    type: tx.type,
    categoryId: migrateCategoryId(tx.categoryId),
    currency: normalizeAppCurrency(tx.currency),
    note: tx.note,
    date: tx.date,
    owner: tx.owner ?? "me",
    createdBy: createdBy ?? null,
    goalId: tx.goalId ?? null,
    goalAmount: tx.goalAmount ?? null,
  };
}
