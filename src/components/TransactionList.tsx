"use client";

import { ChevronDown, ChevronUp, List, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HouseholdFilterTabs } from "@/components/HouseholdControls";
import { TransactionEditDialog } from "@/components/TransactionEditDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HomeSectionCardHeader,
  HomeSectionCollapsedBar,
  homeSectionContentClassName,
  homeSectionPadX,
  sectionToggleButtonClassName,
} from "@/components/HomeSectionCardHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryLabel } from "@/lib/categories";
import { formatTransactionDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import {
  TRANSACTIONS_HIDDEN_KEY,
  TRANSACTIONS_TYPE_FILTER_KEY,
} from "@/lib/storage-reset";
import { hasPartnerBudget } from "@/lib/owner-labels";
import { displayTransactionNote } from "@/lib/transaction-note";
import {
  useCategories,
  useFilteredTransactions,
  useStore,
} from "@/store/useStore";
import type { Transaction, TxType } from "@/types";

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

function readTypeFilter(): "all" | TxType {
  if (typeof window === "undefined") return "all";
  try {
    const v = localStorage.getItem(TRANSACTIONS_TYPE_FILTER_KEY);
    if (v === "income" || v === "expense") return v;
  } catch {
    /* ignore */
  }
  return "all";
}

function writeTypeFilter(filter: "all" | TxType): void {
  try {
    if (filter === "all") localStorage.removeItem(TRANSACTIONS_TYPE_FILTER_KEY);
    else localStorage.setItem(TRANSACTIONS_TYPE_FILTER_KEY, filter);
  } catch {
    /* ignore */
  }
}

type TransactionRowProps = {
  tx: Transaction;
  locale: "ru" | "en";
  categories: ReturnType<typeof useCategories>;
  partnerName: string | null;
  userName: string | null;
  onEdit: (tx: Transaction) => void;
};

function TransactionRow({ tx, locale, categories, partnerName, userName, onEdit }: TransactionRowProps) {
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
  const owner = tx.owner === "partner" ? "partner" : "me";
  const showNames = hasPartnerBudget(partnerName);
  const ownerPart =
    owner === "partner" && partnerName?.trim()
      ? partnerName.trim()
      : owner === "me" && showNames && userName?.trim()
        ? userName.trim()
        : null;
  const meta = [formatTransactionDate(tx.date, locale), ownerPart, note, goalPart]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-md border-2 border-border p-2 text-sm">
      <button
        type="button"
        className="min-w-0 text-left"
        onClick={() => onEdit(tx)}
      >
        <p className="truncate font-medium leading-tight">
          {getCategoryLabel(tx.categoryId, categories, locale)}
        </p>
        {meta ? (
          <p className="truncate text-xs leading-snug text-muted-foreground tabular-nums">
            {meta}
          </p>
        ) : null}
      </button>
      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <Badge
          variant={tx.type === "income" ? "success" : "danger"}
          className="shrink-0 px-1.5 py-0 text-[10px]"
        >
          {tx.type === "income" ? t(locale, "income") : t(locale, "expense")}
        </Badge>
        <span className="whitespace-nowrap text-right font-semibold tabular-nums leading-none">
          {tx.type === "income" ? "+" : "−"}
          {formatMoney(tx.amount, locale)}
        </span>
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
  const userName = useStore((s) => s.userName);
  const categories = useCategories();
  const [filter, setFilter] = useState<"all" | TxType>("all");
  const transactions = useFilteredTransactions(filter);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readHidden());
    setFilter(readTypeFilter());
  }, []);

  const onTypeFilterChange = useCallback((value: string) => {
    const next = value as "all" | TxType;
    setFilter(next);
    writeTypeFilter(next);
  }, []);

  const show = useCallback(() => {
    setHidden(false);
    writeHidden(false);
  }, []);

  const hide = useCallback(() => {
    setHidden(true);
    writeHidden(true);
  }, []);

  if (hidden) {
    return (
      <>
        <HomeSectionCollapsedBar
          icon={List}
          title={t(locale, "transactions")}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={sectionToggleButtonClassName}
              onClick={show}
            >
              <ChevronDown className="h-4 w-4" />
              {t(locale, "transactionsShow")}
            </Button>
          }
        />
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
      <Card className="border-primary/20">
        <HomeSectionCardHeader
          icon={List}
          title={t(locale, "transactions")}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={sectionToggleButtonClassName}
              onClick={hide}
            >
              <ChevronUp className="h-4 w-4" />
              {t(locale, "transactionsHide")}
            </Button>
          }
        />
        <CardHeader className={`space-y-3 pb-2 pt-0 ${homeSectionPadX}`}>
          <Tabs value={filter} onValueChange={onTypeFilterChange}>
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
        <CardContent className={`space-y-3 ${homeSectionContentClassName}`}>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t(locale, "householdFilterLabel")}</p>
            <HouseholdFilterTabs />
          </div>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(locale, "noTransactions")}
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  locale={locale}
                  categories={categories}
                  partnerName={partnerName}
                  userName={userName}
                  onEdit={setEditing}
                />
              ))}
            </ul>
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
