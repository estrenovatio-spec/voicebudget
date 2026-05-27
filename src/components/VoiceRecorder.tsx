"use client";

import { Loader2, Mic } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EntryOwnerToggle } from "@/components/HouseholdControls";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fallbackParse } from "@/lib/ai";
import { t } from "@/lib/i18n";
import { isSpeechRecognitionAvailable, listenOnce } from "@/lib/speech";
import type { ParsedTransaction } from "@/types";
import { useStore } from "@/store/useStore";

type RecorderState = "idle" | "recording" | "processing" | "success" | "error";

export function VoiceRecorder() {
  const locale = useStore((s) => s.locale);
  const categories = useStore((s) => s.categories);
  const addTransaction = useStore((s) => s.addTransaction);
  const setIsRecording = useStore((s) => s.setIsRecording);
  const { toast } = useToast();

  const [state, setState] = useState<RecorderState>("idle");
  const [speechOk, setSpeechOk] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    setSpeechOk(isSpeechRecognitionAvailable());
  }, []);

  const isBusy = state === "recording" || state === "processing";

  const saveTransaction = useCallback(
    (data: ParsedTransaction, transcript: string, usedFallback?: boolean) => {
      addTransaction(data, transcript);
      setText("");
      setState("success");
      toast(t(locale, "voiceSuccess"), "success");
      if (usedFallback) {
        toast(t(locale, "aiFallbackNotice"));
      }
      setTimeout(() => setState("idle"), 1500);
    },
    [addTransaction, locale, toast],
  );

  const trySave = useCallback(
    (data: ParsedTransaction, transcript: string, usedFallback?: boolean) => {
      saveTransaction(data, transcript, usedFallback);
    },
    [saveTransaction],
  );

  const submitTranscript = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) {
        toast(t(locale, "enterText"), "error");
        return;
      }

      setState("processing");
      try {
        const res = await fetch("/api/parse-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: value, locale }),
        });

        let json: {
          success?: boolean;
          data?: ParsedTransaction;
          fallback?: boolean;
        } = {};

        try {
          json = (await res.json()) as typeof json;
        } catch {
          /* empty body */
        }

        if (res.ok && json.success && json.data) {
          trySave(json.data, value, json.fallback);
          return;
        }

        const local = fallbackParse(value, locale, categories);
        if (local.amount > 0) {
          trySave(local, value, true);
          return;
        }

        setState("error");
        toast(t(locale, "voiceError"), "error");
        setTimeout(() => setState("idle"), 1200);
      } catch {
        const local = fallbackParse(value, locale, categories);
        if (local.amount > 0) {
          trySave(local, value, true);
          return;
        }
        setState("error");
        toast(t(locale, "voiceError"), "error");
        setTimeout(() => setState("idle"), 1200);
      }
    },
    [categories, locale, toast, trySave],
  );

  const handleAddClick = () => {
    if (isBusy) return;
    void submitTranscript(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddClick();
  };

  const handleVoice = async () => {
    if (isBusy) return;

    setState("recording");
    setIsRecording(true);
    const { transcript, error } = await listenOnce(locale);
    setIsRecording(false);

    if (error || !transcript) {
      setState("error");
      toast(t(locale, "voiceError"), "error");
      setTimeout(() => setState("idle"), 1200);
      return;
    }

    setText(transcript);
    await submitTranscript(transcript);
  };

  const statusText = (): string => {
    switch (state) {
      case "recording":
        return t(locale, "voiceRecording");
      case "processing":
        return t(locale, "voiceProcessing");
      case "success":
        return t(locale, "voiceSuccess");
      case "error":
        return t(locale, "voiceError");
      default:
        return speechOk ? t(locale, "voiceIdle") : t(locale, "speechUnavailable");
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <section className="relative z-30 flex flex-col items-center gap-4 py-4">
      {speechOk && (
        <button
          type="button"
          onClick={handleVoice}
          disabled={isBusy}
          className={[
            "relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform",
            "active:scale-95 hover:scale-105 motion-safe:transition-transform disabled:opacity-50",
            state === "recording" ? "animate-pulseRing" : "",
          ].join(" ")}
          aria-label={t(locale, "voiceIdle")}
        >
          {state === "processing" || state === "recording" ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : (
            <Mic className="h-9 w-9" />
          )}
        </button>
      )}

      <EntryOwnerToggle />

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(locale, "fallbackPlaceholder")}
          rows={3}
          disabled={isBusy}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button
          className="relative z-30 h-11 w-full touch-manipulation text-base"
          type="button"
          onClick={handleAddClick}
          aria-disabled={isBusy || !hasText}
          style={{
            opacity: isBusy || !hasText ? 0.55 : 1,
            pointerEvents: isBusy ? "none" : "auto",
          }}
        >
          {state === "processing" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(locale, "voiceProcessing")}
            </>
          ) : (
            t(locale, "fallbackSubmit")
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">{statusText()}</p>
    </section>
  );
}
