import { cleanTranscript } from "@/lib/transcript-guard";
import type { SttProvider } from "@/lib/stt-providers";

export async function transcribeWhisperFetch(
  provider: SttProvider,
  file: File,
  locale: string,
  timeoutMs: number,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("model", provider.model);
  form.append("language", locale === "en" ? "en" : "ru");
  form.append("response_format", "json");
  form.append("temperature", "0");
  form.append(
    "prompt",
    locale === "en"
      ? "Personal finance: spent, bought, salary, lunch."
      : "Личные финансы: потратил, купил, зарплата, обед.",
  );

  const url = `${provider.baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      body: form,
      signal: controller.signal,
    });

    let json: { text?: string; error?: { message?: string } | string } = {};
    try {
      json = (await res.json()) as typeof json;
    } catch {
      /* empty */
    }

    if (!res.ok) {
      const msg =
        typeof json.error === "string"
          ? json.error
          : json.error?.message ?? `http_${res.status}`;
      throw new Error(`${provider.id}:${msg}`);
    }

    return cleanTranscript(json.text ?? "");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("stt_timeout");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
