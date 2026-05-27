"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { TransactionEditDialog } from "@/components/TransactionEditDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCategoryLabel } from "@/lib/categories";
import { t } from "@/lib/i18n";
import { useCategories, useFilteredTransactions, useStore } from "@/store/useStore";
import type { Transaction, TxType } from "@/types";

export function TransactionList() {
  const locale = useStore((s) => s.locale);
  const partnerName = useStore((s) => s.partnerName);
  const categories = useCategories();
  const [filter, setFilter] = useState<"all" | TxType>("all");
  const transactions = useFilteredTransactions(filter);
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t(locale, "transactions")}</CardTitle>
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
        <CardContent>
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {transactions.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                {t(locale, "noTransactions")}
              </li>
            )}
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditing(tx)}
                >
                  <p className="truncate font-medium">
                    {getCategoryLabel(tx.categoryId, categories, locale)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                  {partnerName && (
                    <span className="mr-1 text-primary">
                      {tx.owner === "partner" ? partnerName : t(locale, "ownerMe")} ·
                    </span>
                  )}
                  {tx.note || tx.date}
                </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={tx.type === "income" ? "success" : "danger"}>
                      {tx.type === "income" ? t(locale, "income") : t(locale, "expense")}
                    </Badge>
                    <span className="font-semibold tabular-nums">
                      {tx.type === "income" ? "+" : "-"}
                      {tx.amount} {tx.currency}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t(locale, "txEdit")}
                    onClick={() => setEditing(tx)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
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
