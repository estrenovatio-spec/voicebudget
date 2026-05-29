import { NextResponse } from "next/server";
import { getLlmBaseUrl, getLlmModel, getSttModel, isLlmConfigured } from "@/lib/llm";
import { getSttProviders, listSttProviderIds } from "@/lib/stt-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = getSttProviders();
  const llm = isLlmConfigured();

  if (providers.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "no_stt_key",
      sttProviders: [],
      hint:
        "Для голоса в боте задайте на Vercel: GROQ_API_KEY или STT_API_KEY + STT_BASE_URL=https://apinet.cloud/v1 → Redeploy",
    });
  }

  return NextResponse.json({
    ok: true,
    sttReady: true,
    sttProviders: listSttProviderIds(),
    llmConfigured: llm,
    baseUrl: getLlmBaseUrl() ?? "(openai direct)",
    sttModel: getSttModel(),
    llmModel: getLlmModel(),
    hint: "Голос в боте идёт через Groq/apinet Whisper, не через xinghu. Текст — через LLM как раньше.",
  });
}
