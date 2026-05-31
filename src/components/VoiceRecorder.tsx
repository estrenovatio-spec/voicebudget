"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { hasPartnerBudget } from "@/lib/owner-labels";
import { tryParsePlanningInput, looksLikeGoalDeposit } from "@/lib/planning/parse-input";
import { formatMoney } from "@/lib/format-money";
import { t, ruPlural, enPlural } from "@/lib/i18n";
import { parseVoiceTranscripts } from "@/lib/voice";
import { useStore } from "@/store/useStore";

export function VoiceRecorder() {
  const locale = useStore((s) => s.locale);
  const categories = useStore((s) => s.categories);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const addTransaction = useStore((s) => s.addTransaction);
  const applyPlanningInput = useStore((s) => s.applyPlanningInput);
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const onAdd = useCallback(async () => {
    const value = text.trim();
    if (!value || busy) return;

    setBusy(true);
    try {
      const planning = tryParsePlanningInput(value, locale, savingsGoals);
      if (planning) {
        const ok = applyPlanningInput(planning);
        if (!ok) {
          toast(t(locale, "voiceTryManual"), "error");
          return;
        }
        setText("");
        if (
          planning.kind === "goal_deposit" ||
          planning.kind === "goal_deposit_by_name"
        ) {
          const name =
            planning.kind === "goal_deposit_by_name"
              ? planning.goalName
              : (savingsGoals.find((g) => g.id === planning.goalId)?.name ??
                planning.goalId);
          toast(
            t(locale, "planningGoalDepositSuccess", {
              amount: formatMoney(planning.amount, locale),
              name,
            }),
            "success",
          );
        } else {
          toast(t(locale, "planningInputSuccess"), "success");
        }
        return;
      }

      const parsed = await parseVoiceTranscripts(value, locale, categories, {
        partnerName,
        myName: userName,
        hasPartner: hasPartnerBudget(partnerName),
      });
      if (!parsed || parsed.items.length === 0) {
        toast(t(locale, "voiceTryManual"), "error");
        return;
      }

      // ИИ не знает про копилки — если фраза про отложить, но правила не сработали раньше, пробуем ещё раз
      const first = parsed.items[0];
      if (
        looksLikeGoalDeposit(value, locale) ||
        first.categoryId === "goal_jar"
      ) {
        const retry = tryParsePlanningInput(value, locale, savingsGoals);
        if (retry) {
          const ok = applyPlanningInput(retry);
          if (ok) {
            setText("");
            if (
              retry.kind === "goal_deposit" ||
              retry.kind === "goal_deposit_by_name"
            ) {
              const name =
                retry.kind === "goal_deposit_by_name"
                  ? retry.goalName
                  : (savingsGoals.find((g) => g.id === retry.goalId)?.name ??
                    retry.goalId);
              toast(
                t(locale, "planningGoalDepositSuccess", {
                  amount: formatMoney(retry.amount, locale),
                  name,
                }),
                "success",
              );
            } else {
              toast(t(locale, "planningInputSuccess"), "success");
            }
            return;
          }
        }
      }

      for (const item of parsed.items) {
        addTransaction(item, item.note?.trim() || value);
      }
      setText("");
      toast(
        parsed.items.length === 1
          ? t(locale, "voiceSuccess")
          : t(locale, "voiceSuccessMany", {
              count: String(parsed.items.length),
              word:
                locale === "ru"
                  ? ruPlural(parsed.items.length, "операция", "операции", "операций")
                  : enPlural(parsed.items.length, "entry", "entries"),
            }),
        "success",
      );
    } finally {
      setBusy(false);
    }
  }, [
    addTransaction,
    applyPlanningInput,
    busy,
    categories,
    locale,
    partnerName,
    savingsGoals,
    text,
    toast,
    userName,
  ]);

  return (
    <section className="flex flex-col items-center py-2">
      <div className="w-full max-w-md space-y-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(locale, "fallbackPlaceholder")}
          rows={2}
          disabled={busy}
          className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button
          type="button"
          variant="default"
          className="h-10 w-full"
          disabled={busy || !text.trim()}
          onClick={() => void onAdd()}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t(locale, "voiceProcessing")}
            </>
          ) : (
            t(locale, "fallbackSubmit")
          )}
        </Button>
      </div>
    </section>
  );
}
