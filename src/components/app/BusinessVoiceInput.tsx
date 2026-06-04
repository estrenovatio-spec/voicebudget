"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { parseBusinessInput } from "@/lib/business/parse-input";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useStore } from "@/store/useStore";

export function BusinessVoiceInput({ unitId }: { unitId: string | null }) {
  const locale = useStore((s) => s.locale);
  const addOperatingTx = useBusinessStore((s) => s.addOperatingTx);
  const transferToCushion = useBusinessStore((s) => s.transferToCushion);
  const transferToFamily = useBusinessStore((s) => s.transferToFamily);
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const onAdd = useCallback(async () => {
    const value = text.trim();
    if (!value || busy || !unitId) return;

    setBusy(true);
    try {
      const parsed = parseBusinessInput(value);
      if (!parsed) {
        toast(t(locale, "bizVoiceTryManual"), "error");
        return;
      }

      if (parsed.kind === "tx") {
        addOperatingTx(unitId, parsed.type, parsed.amount, parsed.note);
        toast(
          parsed.type === "income"
            ? t(locale, "bizVoiceIncomeOk", { amount: formatMoney(parsed.amount, locale) })
            : t(locale, "bizVoiceExpenseOk", { amount: formatMoney(parsed.amount, locale) }),
          "success",
        );
      } else if (parsed.kind === "cushion") {
        transferToCushion(unitId, parsed.amount);
        toast(
          t(locale, "bizVoiceCushionOk", { amount: formatMoney(parsed.amount, locale) }),
          "success",
        );
      } else {
        const ok = transferToFamily(unitId, parsed.amount);
        if (!ok) {
          toast(t(locale, "bizVoiceFamilyFail"), "error");
          return;
        }
        toast(
          t(locale, "bizVoiceFamilyOk", { amount: formatMoney(parsed.amount, locale) }),
          "success",
        );
      }

      setText("");
    } finally {
      setBusy(false);
    }
  }, [
    text,
    busy,
    unitId,
    addOperatingTx,
    transferToCushion,
    transferToFamily,
    locale,
    toast,
  ]);

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-card to-primary/5 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t(locale, "bizVoiceHint")}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(locale, "bizVoicePlaceholder")}
        rows={2}
        disabled={!unitId || busy}
        className="w-full resize-none rounded-lg border border-border/80 bg-background px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void onAdd();
          }
        }}
      />
      <Button
        type="button"
        className="mt-2 w-full"
        disabled={!unitId || !text.trim() || busy}
        onClick={() => void onAdd()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : t(locale, "fallbackSubmit")}
      </Button>
    </div>
  );
}
