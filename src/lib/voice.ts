/**
 * Одна кнопка: запись → серверный STT → ИИ разбирает сумму и категорию.
 */
import { fallbackParseMany, splitTranscriptClauses, detectType } from "@/lib/ai";
import { refineParsedTransaction, sanitizeCategories } from "@/lib/categories";
import {
  applyDetectedOwner,
  normalizeOwnerDetectOptions,
} from "@/lib/detect-owner";
import { hasPartnerBudget } from "@/lib/owner-labels";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { cleanTranscript, isGarbageTranscript } from "@/lib/transcript-guard";
import { transcribeUserAudioFile } from "@/lib/voice-transcribe-client";
import type { DictKey } from "@/lib/i18n";
import { detectAppLocale, inferParseLocale } from "@/lib/locale-infer";
import type { CategoryDefinition, Locale, ParsedTransaction } from "@/types";

const MIC_ASK_MS = 12_000;
const MIN_RECORD_MS = 800;

export type VoiceErrorCode =
  | "insecure"
  | "unavailable"
  | "mic_denied"
  | "mic_timeout"
  | "too_short"
  | "record_failed"
  | "recorder_start_failed"
  | "stt_not_configured"
  | "stt_failed"
  | "no_speech";

type LevelMeter = {
  getLevel: () => number;
  stop: () => void;
};

type ActiveSession = {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: BlobPart[];
  mime: string;
  startedAt: number;
  getLevel: () => number;
  stopMeter: () => void;
};

function attachLevelMeter(stream: MediaStream): LevelMeter {
  const noop: LevelMeter = { getLevel: () => 0, stop: () => {} };
  if (typeof window === "undefined") return noop;

  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return noop;

  let audioContext: AudioContext | null = null;
  try {
    audioContext = new Ctx();
  } catch {
    return noop;
  }

  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
  } catch {
    void audioContext.close();
    return noop;
  }

  const buf = new Uint8Array(analyser.fftSize);
  void audioContext.resume();

  return {
    getLevel: () => {
      if (!audioContext) return 0;
      if (audioContext.state === "suspended") void audioContext.resume();
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const n = (buf[i] - 128) / 128;
        sum += n * n;
      }
      return Math.min(1, Math.sqrt(sum / buf.length) * 5.5);
    },
    stop: () => {
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* ignore */
      }
      const ctx = audioContext;
      audioContext = null;
      void ctx?.close();
    },
  };
}

let session: ActiveSession | null = null;

function isMobileUa(): boolean {
  return typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const order = isMobileUa()
    ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const type of order) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function canUseVoiceInput(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

export function isVoiceRecording(): boolean {
  return session?.recorder.state === "recording";
}

export function getVoiceInputLevel(): number {
  if (!session || session.recorder.state !== "recording") return 0;
  try {
    return session.getLevel();
  } catch {
    return 0;
  }
}

export function getVoiceMinRecordMs(): number {
  return MIN_RECORD_MS;
}

export async function cancelVoiceRecording(): Promise<void> {
  const s = session;
  session = null;
  if (!s) return;
  s.stopMeter();
  try {
    if (s.recorder.state === "recording") s.recorder.stop();
  } catch {
    /* ignore */
  }
  s.stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

async function openMicStream(): Promise<MediaStream> {
  const ask = (constraints: MediaStreamConstraints) =>
    Promise.race([
      navigator.mediaDevices.getUserMedia(constraints),
      new Promise<MediaStream>((_, reject) => {
        window.setTimeout(() => reject(new Error("mic_timeout")), MIC_ASK_MS);
      }),
    ]);

  // На телефоне — простой запрос без обработки (AGC иногда глушит WebView)
  if (isMobileUa()) {
    try {
      return await ask({ audio: true });
    } catch {
      return ask({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    }
  }

  try {
    return await ask({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    return ask({ audio: true });
  }
}

function createRecorder(stream: MediaStream): MediaRecorder {
  const mime = pickMimeType();
  if (mime) {
    try {
      return new MediaRecorder(stream, { mimeType: mime });
    } catch {
      /* fallback */
    }
  }
  return new MediaRecorder(stream);
}

async function waitRecorderStart(recorder: MediaRecorder): Promise<void> {
  if (recorder.state === "recording") return;

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("start_timeout")), 5_000);
    recorder.onstart = () => {
      window.clearTimeout(timer);
      resolve();
    };
    recorder.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("record_failed"));
    };
    try {
      recorder.start(isMobileUa() ? 500 : 400);
    } catch {
      window.clearTimeout(timer);
      reject(new Error("record_failed"));
    }
  });
}

export async function startVoiceRecording(
  _locale: Locale,
): Promise<{ ok: boolean; error?: VoiceErrorCode }> {
  if (!canUseVoiceInput()) return { ok: false, error: "unavailable" };
  if (!window.isSecureContext) return { ok: false, error: "insecure" };

  await cancelVoiceRecording();

  try {
    const stream = await openMicStream();
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== "live") {
      stream.getTracks().forEach((t) => t.stop());
      return { ok: false, error: "mic_denied" };
    }

    const mime = pickMimeType();
    const recorder = createRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunks.push(e.data);
    };

    const meter = attachLevelMeter(stream);

    session = {
      stream,
      recorder,
      chunks,
      mime,
      startedAt: Date.now(),
      getLevel: meter.getLevel,
      stopMeter: meter.stop,
    };

    await waitRecorderStart(recorder);
    if (recorder.state !== "recording") {
      await cancelVoiceRecording();
      return { ok: false, error: "recorder_start_failed" };
    }

    return { ok: true };
  } catch (e) {
    await cancelVoiceRecording();
    const msg = e instanceof Error ? e.message : "";
    if (msg === "mic_timeout") return { ok: false, error: "mic_timeout" };
    if (msg === "record_failed" || msg === "start_timeout") {
      return { ok: false, error: "recorder_start_failed" };
    }
    return { ok: false, error: "mic_denied" };
  }
}

async function stopRecorderBlob(s: ActiveSession): Promise<Blob> {
  const { recorder, chunks, mime } = s;
  const minBytes = isMobileUa() ? 48 : 200;

  return new Promise((resolve, reject) => {
    const build = () => {
      const first = chunks[0];
      const chunkType = first instanceof Blob ? first.type : "";
      const type = mime || recorder.mimeType || chunkType || "audio/webm";
      return new Blob(chunks, { type });
    };

    const finish = () => {
      const b = build();
      if (b.size < minBytes) reject(new Error("too_short"));
      else resolve(b);
    };

    if (recorder.state === "inactive") {
      finish();
      return;
    }

    recorder.onstop = () => window.setTimeout(finish, isMobileUa() ? 400 : 250);
    recorder.onerror = () => reject(new Error("record_failed"));

    try {
      if (typeof recorder.requestData === "function") recorder.requestData();
      recorder.stop();
    } catch {
      reject(new Error("record_failed"));
    }
  });
}

export async function finalizeVoiceCapture(
  locale: Locale,
): Promise<{ text: string; error?: VoiceErrorCode }> {
  const s = session;
  if (!s) return { text: "", error: "unavailable" };

  session = null;
  s.stopMeter();

  let blob: Blob;
  try {
    blob = await stopRecorderBlob(s);
  } catch (e) {
    s.stream.getTracks().forEach((t) => t.stop());
    const msg = e instanceof Error ? e.message : "";
    return { text: "", error: msg === "too_short" ? "too_short" : "record_failed" };
  }

  s.stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });

  const file = new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
  const tgLang =
    typeof window !== "undefined"
      ? window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
      : undefined;
  const sttLocale = detectAppLocale(tgLang);
  const server = await transcribeUserAudioFile(file, sttLocale);
  if (server.text) return server;
  return { text: "", error: server.error ?? "stt_failed" };
}

export type ParseVoiceOwnerContext = {
  partnerName?: string | null;
  partnerKeywords?: readonly string[];
  myName?: string | null;
  hasPartner?: boolean;
};

export async function parseVoiceTranscripts(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[],
  ownerCtx?: ParseVoiceOwnerContext | string | null,
): Promise<{ items: ParsedTransaction[]; usedFallback: boolean } | null> {
  const text = cleanTranscript(transcript);
  if (!text || isGarbageTranscript(text)) return null;
  const parseLocale = inferParseLocale(text, locale);

  const mergedCategories = sanitizeCategories(categories);

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    const res = await fetchWithRetry(`${window.location.origin}/api/parse-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        transcript: text,
        locale: parseLocale,
        categories: mergedCategories,
        partnerName:
          typeof ownerCtx === "string"
            ? ownerCtx
            : (ownerCtx?.partnerName ?? null),
        partnerKeywords:
          typeof ownerCtx === "string" ? undefined : ownerCtx?.partnerKeywords,
        myName: typeof ownerCtx === "string" ? null : (ownerCtx?.myName ?? null),
        hasPartner:
          typeof ownerCtx === "string" ? undefined : ownerCtx?.hasPartner,
      }),
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json()) as {
        success?: boolean;
        data?: ParsedTransaction;
        items?: ParsedTransaction[];
        fallback?: boolean;
      };
      const rawItems = (json.items ?? (json.data ? [json.data] : [])).filter(
        (item) => item.amount > 0,
      );
      if (json.success && rawItems.length > 0) {
        const clauses = splitTranscriptClauses(text);
        const ownerOpts = normalizeOwnerDetectOptions(ownerCtx, parseLocale);
        if (ownerOpts.hasPartner === undefined) {
          ownerOpts.hasPartner = hasPartnerBudget(
          ownerOpts.partnerName,
          ownerOpts.partnerKeywords,
        );
        }
        const items = rawItems.map((item, index) => {
          const clause = clauses[index]?.trim() || item.note?.trim() || text;
          return applyDetectedOwner(
            refineParsedTransaction(
              item,
              clause,
              mergedCategories,
              detectType,
              parseLocale,
            ),
            clause,
            ownerOpts,
            "me",
          );
        });
        return {
          items,
          usedFallback: Boolean(json.fallback),
        };
      }
    }
  } catch {
    /* локальный разбор ниже */
  }

  const local = fallbackParseMany(text, parseLocale, mergedCategories);
  if (local.length > 0) {
    const ownerOpts = normalizeOwnerDetectOptions(
      typeof ownerCtx === "string" ? { partnerName: ownerCtx, locale } : { ...ownerCtx, locale },
      locale,
    );
    if (ownerOpts.hasPartner === undefined) {
      ownerOpts.hasPartner = hasPartnerBudget(
        ownerOpts.partnerName,
        ownerOpts.partnerKeywords,
      );
    }
    const clauses = splitTranscriptClauses(text);
    const items = local.map((item, index) =>
      applyDetectedOwner(item, clauses[index]?.trim() || item.note?.trim() || text, ownerOpts, "me"),
    );
    return { items, usedFallback: true };
  }
  return null;
}

export async function parseVoiceTranscript(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[],
  ownerCtx?: ParseVoiceOwnerContext | string | null,
): Promise<{ data: ParsedTransaction; usedFallback: boolean } | null> {
  const parsed = await parseVoiceTranscripts(transcript, locale, categories, ownerCtx);
  if (!parsed?.items[0]) return null;
  return { data: parsed.items[0], usedFallback: parsed.usedFallback };
}

export function mapVoiceError(code: VoiceErrorCode | undefined): DictKey {
  switch (code) {
    case "insecure":
      return "voiceInsecure";
    case "mic_denied":
      return "micDenied";
    case "mic_timeout":
      return "voiceMicTimeout";
    case "too_short":
      return "voiceTooShort";
    case "recorder_start_failed":
    case "record_failed":
      return "voiceRecorderFailed";
    case "stt_not_configured":
      return "voiceSttUnavailable";
    case "stt_failed":
      return "voiceSttFailed";
    case "no_speech":
      return "voiceNoSpeech";
    default:
      return "voiceTryManual";
  }
}
