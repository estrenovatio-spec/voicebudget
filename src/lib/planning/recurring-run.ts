import { advanceRecurringDate, todayIso } from "@/lib/planning/analytics";
import type { ParsedTransaction } from "@/types";
import type { RecurringTransaction } from "@/types/planning";

export function getDueRecurringItems(items: RecurringTransaction[]): RecurringTransaction[] {
  const today = todayIso();
  return items.filter((r) => r.enabled && r.nextRunDate <= today);
}

export function recurringToParsedTransaction(
  item: RecurringTransaction,
  runDate: string,
): ParsedTransaction {
  return {
    amount: item.amount,
    type: item.type,
    categoryId: item.categoryId,
    currency: "RUB",
    note: item.note ? `${item.note} (регулярно)` : "Регулярная операция",
    date: runDate,
    owner: item.owner,
  };
}

export function nextRunAfterProcessing(item: RecurringTransaction, today: string): string {
  let next = item.nextRunDate;
  while (next <= today) {
    next = advanceRecurringDate(next, item.frequency, item.dayOfMonth);
  }
  return next;
}
