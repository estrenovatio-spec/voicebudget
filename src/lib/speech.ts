import type { Locale } from "@/types";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionAvailable(): boolean {
  return getRecognitionCtor() !== null;
}

export function localeToSpeechLang(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : "en-US";
}

export interface SpeechListenResult {
  transcript: string;
  error?: string;
}

const LISTEN_TIMEOUT_MS = 12_000;

export function listenOnce(locale: Locale): Promise<SpeechListenResult> {
  return new Promise((resolve) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      resolve({ transcript: "", error: "unavailable" });
      return;
    }

    let settled = false;
    const finish = (result: SpeechListenResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const recognition = new Ctor();
    recognition.lang = localeToSpeechLang(locale);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    const timer = setTimeout(() => {
      finish({ transcript: "", error: "timeout" });
    }, LISTEN_TIMEOUT_MS);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      finish({ transcript });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      finish({ transcript: "", error: event.error });
    };

    recognition.onend = () => {
      finish({ transcript: "", error: "no_result" });
    };

    try {
      recognition.start();
    } catch {
      finish({ transcript: "", error: "start_failed" });
    }
  });
}
