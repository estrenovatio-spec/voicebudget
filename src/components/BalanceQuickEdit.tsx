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
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { useComputedBalance, useStore } from "@/store/useStore";
import type { BudgetOwner } from "@/types";

type BalanceQuickEditProps = {
  owner: BudgetOwner | "all";
  displayed: number;
  label: string;
  partnerDisplayed?: number;
  className?: string;
  amountsHidden?: boolean;
  /** Сообщает родителю об открытии/закрытии — чтобы не переключать скрытие баланса кликом «сквозь» диалог */
  onEditDialogOpenChange?: (open: boolean) => void;
  /** Вызывается до закрытия (на pointerDown) — блокирует «пробивной» клик */
  onBeforeEditDialogClose?: () => void;
};

function armDialogClose(onBeforeEditDialogClose?: () => void): void {
  onBeforeEditDialogClose?.();
}

export function BalanceQuickEdit({
  owner,
  displayed,
  label,
  partnerDisplayed = 0,
  className = "",
  amountsHidden = false,
  onEditDialogOpenChange,
  onBeforeEditDialogClose,
}: BalanceQuickEditProps) {
  const locale = useStore((s) => s.locale);
  const setActualCash = useStore((s) => s.setActualCash);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(String(displayed));

  const computedMe = useComputedBalance("me");
  const computedPartner = useComputedBalance("partner");

  useEffect(() => {
    if (open) setInput(String(displayed));
  }, [open, displayed]);

  const closeDialog = () => {
    setOpen(false);
  };

  const confirmDialogAction = (action: () => void) => {
    armDialogClose(onBeforeEditDialogClose);
    action();
  };

  const save = () => {
    const n = Number(String(input).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n)) return;
    const value = Math.round(n);
    if (owner === "me") {
      setActualCash("me", value);
    } else if (owner === "partner") {
      setActualCash("partner", value);
    } else {
      // общий баланс → подгоняем «я», партнёр не трогаем
      setActualCash("me", value - partnerDisplayed);
    }
    closeDialog();
  };

  const computedHint =
    owner === "me"
      ? computedMe
      : owner === "partner"
        ? computedPartner
        : computedMe + computedPartner;

  if (amountsHidden) {
    return (
      <span
        className={`select-none tabular-nums ${className}`}
        aria-hidden
      >
        {t(locale, "balanceAmountsHidden")} {t(locale, "currency")}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        data-balance-amount
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
          onEditDialogOpenChange?.(true);
        }}
        className={`rounded-md px-0.5 tabular-nums underline decoration-dotted underline-offset-2 transition-colors hover:bg-muted/60 hover:text-foreground ${className}`}
        aria-label={t(locale, "balanceTapToEdit")}
      >
        {formatMoney(displayed, locale)} {t(locale, "currency")}
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (open && !next) armDialogClose(onBeforeEditDialogClose);
          setOpen(next);
          onEditDialogOpenChange?.(next);
        }}
      >
        <DialogContent
          className="max-w-xs"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t(locale, "balanceFromTx", { amount: formatMoney(computedHint, locale) })}
          </p>
          <Input
            type="number"
            inputMode="numeric"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmDialogAction(save);
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onPointerDown={(e) => {
                e.preventDefault();
                armDialogClose(onBeforeEditDialogClose);
              }}
              onClick={(e) => {
                e.stopPropagation();
                closeDialog();
              }}
            >
              {t(locale, "cancel")}
            </Button>
            <Button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                armDialogClose(onBeforeEditDialogClose);
              }}
              onClick={(e) => {
                e.stopPropagation();
                save();
              }}
            >
              {t(locale, "balanceSaveActual")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
