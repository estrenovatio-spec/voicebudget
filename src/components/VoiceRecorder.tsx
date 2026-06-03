"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { hasPartnerBudget } from "@/lib/owner-labels";
import {
  tryParsePlanningInput,
  looksLikeGoalDeposit,
  isIncomeReceiptPhrase,
} from "@/lib/planning/parse-input";
import { formatMoney } from "@/lib/format-money";
import { t, ruPlural, enPlural } from "@/lib/i18n";
import { inferParseLocale } from "@/lib/locale-infer";
import { isCloudSyncActive } from "@/lib/cloud/push";
import { mergeTransactionComment } from "@/lib/transaction-note";
import { parseVoiceTranscripts } from "@/lib/voice";
import { useCloudStore } from "@/store/useCloudStore";
import { useStore } from "@/store/useStore";

export function VoiceRecorder() {
  const locale = useStore((s) => s.locale);
  const categories = useStore((s) => s.categories);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const partnerKeywords = useStore((s) => s.partnerKeywords);
  const addTransaction = useStore((s) => s.addTransaction);
  const applyPlanningInput = useStore((s) => s.applyPlanningInput);
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [comment, setComment] = useState("");
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
        setComment("");
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

      const parseLocale = inferParseLocale(value, locale);
      const parsed = await parseVoiceTranscripts(value, parseLocale, categories, {
        partnerName,
        partnerKeywords,
        myName: userName,
        hasPartner: hasPartnerBudget(partnerName, partnerKeywords),
      });
      if (!parsed || parsed.items.length === 0) {
        toast(t(locale, "voiceTryManual"), "error");
        return;
      }

      // ИИ не знает про копилки — если фраза про отложить, но правила не сработали раньше, пробуем ещё раз
      const first = parsed.items[0];
      if (
        !isIncomeReceiptPhrase(value, locale) &&
        (looksLikeGoalDeposit(value, locale) || first.categoryId === "goal_jar")
      ) {
        const retry = tryParsePlanningInput(value, locale, savingsGoals);
        if (retry) {
          const ok = applyPlanningInput(retry);
          if (ok) {
            setText("");
            setComment("");
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

      const extraComment = comment.trim();
      for (const item of parsed.items) {
        const note = mergeTransactionComment(item.note, value, extraComment, item.amount);
        addTransaction({ ...item, note }, note || value);
      }
      setText("");
      setComment("");
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
      if (isCloudSyncActive()) {
        window.setTimeout(() => {
          if (useCloudStore.getState().lastWriteError) {
            toast(t(locale, "cloudWriteLocalOnly"), "error");
          }
        }, 700);
      }
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
    partnerKeywords,
    savingsGoals,
    comment,
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
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t(locale, "voiceCommentPlaceholder")}
          rows={1}
          maxLength={120}
          disabled={busy}
          className="flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
