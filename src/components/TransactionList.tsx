"use client";

import { ChevronDown, ChevronUp, List, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HouseholdFilterTabs } from "@/components/HouseholdControls";
import { TransactionEditDialog } from "@/components/TransactionEditDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryLabel } from "@/lib/categories";
import { formatTransactionDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { TRANSACTIONS_HIDDEN_KEY } from "@/lib/storage-reset";
import { displayTransactionNote } from "@/lib/transaction-note";
import { useCategories, useFilteredTransactions, useStore } from "@/store/useStore";
import type { Transaction, TxType } from "@/types";

const PINNED_COUNT = 3;

function readHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TRANSACTIONS_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(TRANSACTIONS_HIDDEN_KEY, "1");
    else localStorage.removeItem(TRANSACTIONS_HIDDEN_KEY);
  } catch {
    /* ignore */
  }
}

type TransactionRowProps = {
  tx: Transaction;
  locale: "ru" | "en";
  categories: ReturnType<typeof useCategories>;
  partnerName: string | null;
  onEdit: (tx: Transaction) => void;
};

function TransactionRow({ tx, locale, categories, partnerName, onEdit }: TransactionRowProps) {
  const note = displayTransactionNote(tx.note, tx.amount);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const goalName = tx.goalId ? savingsGoals.find((g) => g.id === tx.goalId)?.name : null;
  const goalPart =
    tx.goalAmount && tx.goalAmount > 0 && goalName
      ? t(locale, "txGoalLinked", {
          name: goalName,
          amount: formatMoney(tx.goalAmount, locale),
        })
      : null;
  const ownerPart =
    tx.owner === "partner" && partnerName?.trim() ? partnerName.trim() : null;
  const meta = [formatTransactionDate(tx.date, locale), ownerPart, note, goalPart]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border-2 border-border p-2 text-sm">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(tx)}>
        <p className="truncate font-medium">{getCategoryLabel(tx.categoryId, categories, locale)}</p>
        {meta ? <p className="truncate text-xs text-muted-foreground tabular-nums">{meta}</p> : null}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex flex-col items-end gap-1">
          <Badge variant={tx.type === "income" ? "success" : "danger"}>
            {tx.type === "income" ? t(locale, "income") : t(locale, "expense")}
          </Badge>
          <span className="font-semibold tabular-nums">
            {tx.type === "income" ? "+" : "-"}
            {formatMoney(tx.amount, locale)} {t(locale, "currency")}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t(locale, "txEdit")}
          onClick={() => onEdit(tx)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

export function TransactionList() {
  const locale = useStore((s) => s.locale);
  const partnerName = useStore((s) => s.partnerName);
  const categories = useCategories();
  const [filter, setFilter] = useState<"all" | TxType>("all");
  const transactions = useFilteredTransactions(filter);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readHidden());
  }, []);

  const show = useCallback(() => {
    setHidden(false);
    writeHidden(false);
  }, []);

  const hide = useCallback(() => {
    setHidden(true);
    writeHidden(true);
  }, []);

  const pinned = transactions.slice(0, PINNED_COUNT);
  const rest = transactions.slice(PINNED_COUNT);

  if (hidden) {
    return (
      <>
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <List className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{t(locale, "transactions")}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1" onClick={show}>
            <ChevronDown className="h-4 w-4" />
            {t(locale, "transactionsShow")}
          </Button>
        </div>
        <TransactionEditDialog
          transaction={editing}
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{t(locale, "transactions")}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-1 px-2 text-xs"
              onClick={hide}
            >
              <ChevronUp className="h-4 w-4" />
              {t(locale, "transactionsHide")}
            </Button>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | TxType)}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                {t(locale, "filterAll")}
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                {t(locale, "filterIncome")}
              </TabsTrigger>
              <TabsTrigger value="expense" className="flex-1">
                {t(locale, "filterExpense")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t(locale, "householdFilterLabel")}</p>
            <HouseholdFilterTabs />
          </div>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(locale, "noTransactions")}
            </p>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-2">
                {pinned.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    locale={locale}
                    categories={categories}
                    partnerName={partnerName}
                    onEdit={setEditing}
                  />
                ))}
              </ul>
              {rest.length > 0 && (
                <ul className="max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
                  {rest.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      locale={locale}
                      categories={categories}
                      partnerName={partnerName}
                      onEdit={setEditing}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionEditDialog
        transaction={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
