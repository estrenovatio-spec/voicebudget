"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getCategoriesByType, getCategoryLabel } from "@/lib/categories";
import { formatTransactionDate } from "@/lib/format-date";
import { t } from "@/lib/i18n";
import { hasPartnerBudget, myDisplayName, partnerDisplayName } from "@/lib/owner-labels";
import { parseAmountFromTranscript } from "@/lib/parse-amount";
import { roundMoneyUp } from "@/lib/format-money";
import { clearCachedRecommendations } from "@/lib/storage";
import { normalizeGoalAmount } from "@/lib/goal-from-transaction";
import { useCategories, useStore } from "@/store/useStore";
import type { BudgetOwner, Transaction, TxType } from "@/types";
import { getFallbackCategoryId } from "@/lib/categories";

interface TransactionEditDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionEditDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionEditDialogProps) {
  const locale = useStore((s) => s.locale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const categories = useCategories();
  const savingsGoals = useStore((s) => s.savingsGoals);
  const updateTransaction = useStore((s) => s.updateTransaction);
  const deleteTransaction = useStore((s) => s.deleteTransaction);

  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<TxType>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [owner, setOwner] = useState<BudgetOwner>("me");
  const [goalId, setGoalId] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      return;
    }
    if (!transaction) return;
    setAmount(String(transaction.amount));
    setTxType(transaction.type);
    setCategoryId(transaction.categoryId);
    setOwner(transaction.owner ?? "me");
    setGoalId(transaction.goalId ?? "");
    setGoalAmount(
      transaction.goalAmount && transaction.goalAmount > 0
        ? String(transaction.goalAmount)
        : "",
    );
    setConfirmDelete(false);
  }, [transaction, open]);

  if (!transaction) return null;

  const typeCategories = getCategoriesByType(categories, txType);

  const handleTypeChange = (next: TxType) => {
    setTxType(next);
    const valid = categories.some((c) => c.id === categoryId && c.type === next);
    if (!valid) {
      setCategoryId(getFallbackCategoryId(next));
    }
    if (next !== "income") {
      setGoalId("");
      setGoalAmount("");
    }
  };

  const handleSave = () => {
    const parsed = parseAmountFromTranscript(amount, locale);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const parsedGoal = goalId ? parseAmountFromTranscript(goalAmount || amount, locale) : 0;

    updateTransaction(transaction.id, {
      amount: roundMoneyUp(parsed),
      type: txType,
      categoryId,
      owner: partnerName ? owner : undefined,
      goalId: txType === "income" && goalId ? goalId : null,
      goalAmount:
        txType === "income" && goalId
          ? normalizeGoalAmount(parsedGoal > 0 ? parsedGoal : parsed)
          : null,
    });
    clearCachedRecommendations();
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteTransaction(transaction.id);
    clearCachedRecommendations();
    onOpenChange(false);
  };

  const parsedAmount = parseAmountFromTranscript(amount, locale);
  const canSave =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    categoryId.length > 0 &&
    typeCategories.some((c) => c.id === categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t(locale, "txEditTitle")}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatTransactionDate(transaction.date, locale)}
          </p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">{t(locale, "txType")}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={txType === "expense" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleTypeChange("expense")}
              >
                {t(locale, "expense")}
              </Button>
              <Button
                type="button"
                variant={txType === "income" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleTypeChange("income")}
              >
                {t(locale, "income")}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="tx-amount">
              {t(locale, "txAmount")}
            </label>
            <Input
              id="tx-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="tx-category">
              {t(locale, "txCategory")}
            </label>
            <select
              id="tx-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {typeCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {getCategoryLabel(cat.id, categories, locale)}
                </option>
              ))}
            </select>
          </div>
          {txType === "income" && savingsGoals.length > 0 ? (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">{t(locale, "txGoal")}</p>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t(locale, "txGoalNone")}</option>
                {savingsGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              {goalId ? (
                <>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                    placeholder={t(locale, "txGoalAmount")}
                  />
                  <p className="text-xs text-muted-foreground">{t(locale, "txGoalHint")}</p>
                </>
              ) : null}
            </div>
          ) : null}
          {hasPartnerBudget(partnerName) && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="tx-owner">
                {t(locale, "txOwner")}
              </label>
              <select
                id="tx-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value as BudgetOwner)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="me">{myDisplayName(locale, userName)}</option>
                <option value="partner">{partnerDisplayName(partnerName)}</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t(locale, "cancel")}
            </Button>
            <Button type="button" className="flex-1" disabled={!canSave} onClick={handleSave}>
              {t(locale, "confirm")}
            </Button>
          </div>
          <div className="border-t pt-3">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">
                  {t(locale, "txDeleteConfirm")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t(locale, "cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDelete}
                  >
                    {t(locale, "txDeleteYes")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
              >
                {t(locale, "txDelete")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
