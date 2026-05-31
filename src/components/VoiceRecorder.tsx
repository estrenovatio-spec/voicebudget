"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { hasPartnerBudget } from "@/lib/owner-labels";
import { tryParsePlanningInput, looksLikeGoalDeposit } from "@/lib/planning/parse-input";
import { formatMoney } from "@/lib/format-money";
import { t, ruPlural, enPlural } from "@/lib/i18n";
import { inferParseLocale } from "@/lib/locale-infer";
import { transcribeUserAudioFile } from "@/lib/voice-transcribe-client";
import {
  canUseVoiceInput,
  finalizeVoiceCapture,
  isVoiceRecording,
  mapVoiceError,
  parseVoiceTranscripts,
  startVoiceRecording,
} from "@/lib/voice";
import { useStore } from "@/store/useStore";

export function VoiceRecorder() {
  const locale = useStore((s) => s.locale);
  const categories = useStore((s) => s.categories);
  const savingsGoals = useStore((s) => s.savingsGoals);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const addTransaction = useStore((s) => s.addTransaction);
  const applyPlanningInput = useStore((s) => s.applyPlanningInput);
  const setIsRecording = useStore((s) => s.setIsRecording);
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitTranscript = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;

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

        const parseLocale = inferParseLocale(value, locale);
        const parsed = await parseVoiceTranscripts(value, parseLocale, categories, {
          partnerName,
          myName: userName,
          hasPartner: hasPartnerBudget(partnerName),
        });
        if (!parsed || parsed.items.length === 0) {
          toast(t(locale, "voiceTryManual"), "error");
          return;
        }

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
        if (parsed.usedFallback) {
          toast(t(locale, "aiFallbackNotice"));
        }
      } finally {
        setBusy(false);
      }
    },
    [
      addTransaction,
      applyPlanningInput,
      categories,
      locale,
      partnerName,
      savingsGoals,
      toast,
      userName,
    ],
  );

  const stopMicRecording = useCallback(async () => {
    setRecording(false);
    setIsRecording(false);
    setBusy(true);
    try {
      const { text: transcript, error } = await finalizeVoiceCapture(locale);
      if (!transcript) {
        toast(t(locale, mapVoiceError(error)), "error");
        return;
      }
      setText(transcript);
      await submitTranscript(transcript);
    } finally {
      setBusy(false);
    }
  }, [locale, setIsRecording, submitTranscript, toast]);

  const startMicRecording = useCallback(async () => {
    if (busy || recording) return;
    const started = await startVoiceRecording();
    if (!started.ok) {
      toast(t(locale, mapVoiceError(started.error)), "error");
      return;
    }
    setRecording(true);
    setIsRecording(true);
  }, [busy, locale, recording, setIsRecording, toast]);

  const onMicClick = useCallback(() => {
    if (busy && !recording) return;
    if (isVoiceRecording() || recording) {
      void stopMicRecording();
      return;
    }
    void startMicRecording();
  }, [busy, recording, startMicRecording, stopMicRecording]);

  const onPickAudio = useCallback(
    async (file: File) => {
      if (busy) return;
      setBusy(true);
      try {
        const { text: transcript, error } = await transcribeUserAudioFile(file, locale);
        if (!transcript) {
          toast(t(locale, mapVoiceError(error === "stt_not_configured" ? error : "stt_failed")), "error");
          return;
        }
        setText(transcript);
        await submitTranscript(transcript);
      } finally {
        setBusy(false);
      }
    },
    [busy, locale, submitTranscript, toast],
  );

  const micAvailable = canUseVoiceInput();
  const statusLine = recording
    ? t(locale, "voiceTapToStop")
    : busy
      ? t(locale, "voiceTranscribing")
      : micAvailable
        ? t(locale, "voiceRecordingMic")
        : t(locale, "speechUnavailable");

  return (
    <section className="flex flex-col items-center gap-3 py-2">
      {micAvailable ? (
        <button
          type="button"
          onClick={onMicClick}
          disabled={busy && !recording}
          className={[
            "relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform",
            "active:scale-95 hover:scale-105 disabled:opacity-50",
            recording ? "animate-pulse" : "",
          ].join(" ")}
          aria-label={
            recording ? t(locale, "voiceStopAria") : t(locale, "voiceRecordAria")
          }
        >
          {busy && !recording ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : recording ? (
            <Square className="h-7 w-7 fill-current" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </button>
      ) : null}

      <p className="min-h-[1.25rem] text-center text-xs text-muted-foreground">{statusLine}</p>

      <div className="w-full max-w-md space-y-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(locale, "fallbackPlaceholder")}
          rows={2}
          disabled={busy}
          className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="default"
            className="h-10 flex-1"
            disabled={busy || !text.trim()}
            onClick={() => void submitTranscript(text)}
          >
            {busy && !recording ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t(locale, "voiceProcessing")}
              </>
            ) : (
              t(locale, "fallbackSubmit")
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 shrink-0 px-3 text-xs"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {t(locale, "voicePickAudioButton")}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onPickAudio(file);
          }}
        />
      </div>
    </section>
  );
}
