"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { parseVoiceTranscript } from "@/lib/voice";
import { tryParsePlanningInput, looksLikeGoalDeposit } from "@/lib/planning/parse-input";
import { formatMoney } from "@/lib/format-money";
import { t } from "@/lib/i18n";
import { DismissibleHints } from "@/components/DismissibleHints";
import { useStore } from "@/store/useStore";
import { hasTelegramWebApp } from "@/lib/cloud/telegram";

const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_NAME?.replace(/^@/, "") ?? "";

export function VoiceRecorder() {
  const locale = useStore((s) => s.locale);
  const categories = useStore((s) => s.categories);
  const savingsGoals = useStore((s) => s.savingsGoals);
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

      const parsed = await parseVoiceTranscript(value, locale, categories, partnerName);
      if (!parsed) {
        toast(t(locale, "voiceTryManual"), "error");
        return;
      }

      // ИИ не знает про копилки — если фраза про отложить, но правила не сработали раньше, пробуем ещё раз
      if (
        looksLikeGoalDeposit(value, locale) ||
        parsed.data.categoryId === "goal_jar"
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

      addTransaction(parsed.data, value);
      setText("");
      toast(t(locale, "voiceSuccess"), "success");
    } finally {
      setBusy(false);
    }
  }, [addTransaction, applyPlanningInput, busy, categories, locale, partnerName, savingsGoals, text, toast]);

  return (
    <section className="flex flex-col items-center gap-3 py-4">
      <div className="w-full max-w-md space-y-2">
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
        <DismissibleHints
          zoneId="voice-input"
          lines={[
            ...(hasTelegramWebApp() && TG_BOT
              ? [t(locale, "voiceHintTelegram", { bot: TG_BOT })]
              : []),
            t(locale, "planningInputHint"),
          ]}
          className="min-h-[2.5rem]"
        />
      </div>
    </section>
  );
}
