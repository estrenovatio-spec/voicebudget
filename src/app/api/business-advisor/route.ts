import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLlmChatCompletion, getLlmClient, isLlmConfigured } from "@/lib/llm";
import { extractJsonFromLlmContent } from "@/lib/llm-json";

const signalSchema = z.object({
  label: z.string().min(1).max(40),
  text: z.string().min(1).max(800),
  tone: z.enum(["ok", "warn", "risk"]),
});

const bodySchema = z.object({
  locale: z.enum(["ru", "en"]),
  metrics: z.object({
    income: z.number(),
    expense: z.number(),
    profit: z.number(),
    margin: z.number(),
    safeWithdraw: z.number(),
    adSpend: z.number(),
    adShare: z.number(),
    taxReserve: z.number(),
    reserveMonths: z.number(),
    debtMinPayment: z.number(),
    cashGap: z.number(),
  }),
  signals: z.array(signalSchema).min(1).max(8),
});

const adviceSchema = z.object({
  summary: z.string().min(8).max(500),
  action: z.string().min(3).max(280),
  tone: z.enum(["ok", "warn", "risk"]),
});

type BusinessAdvisorInput = z.infer<typeof bodySchema>;
type BusinessAdvisorAdvice = z.infer<typeof adviceSchema>;

function fallbackAdvice(input: z.infer<typeof bodySchema>) {
  const topRisk = input.signals.find((s) => s.tone === "risk") ?? input.signals.find((s) => s.tone === "warn");
  if (input.locale === "en") {
    return {
      summary: topRisk?.text ?? "The business picture is stable. Keep tax, reserve, and withdrawal separate.",
      action: "This week: check one number manually — tax, reserve, ad ROI, or safe withdrawal.",
      tone: topRisk?.tone ?? ("ok" as const),
    };
  }
  return {
    summary: topRisk?.text ?? "Картина бизнеса спокойная. Держите отдельно налог, резерв и деньги к выводу.",
    action: "На этой неделе проверьте один показатель вручную: налог, резерв, окупаемость рекламы или безопасный вывод.",
    tone: topRisk?.tone ?? ("ok" as const),
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function limitText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 1).trimEnd();
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd > Math.floor(max * 0.45)) {
    return slice.slice(0, sentenceEnd + 1).trim();
  }
  const wordEnd = slice.lastIndexOf(" ");
  if (wordEnd > Math.floor(max * 0.65)) {
    return `${slice.slice(0, wordEnd).trimEnd()}…`;
  }
  return `${slice}…`;
}

function firstString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const object = item as Record<string, unknown>;
      const text =
        stringValue(object.summary)
        || stringValue(object.insight)
        || stringValue(object.advice)
        || stringValue(object.text)
        || stringValue(object.message)
        || stringValue(object.recommendation);
      if (text) return text;
    }
  }
  return "";
}

function normalizeTone(value: unknown, input: BusinessAdvisorInput): BusinessAdvisorAdvice["tone"] {
  const tone = stringValue(value).toLowerCase();
  if (tone === "risk" || tone === "danger" || tone === "critical") return "risk";
  if (tone === "warn" || tone === "warning" || tone === "caution") return "warn";
  if (tone === "ok" || tone === "good" || tone === "normal") return "ok";
  return input.signals.find((signal) => signal.tone === "risk")?.tone
    ?? input.signals.find((signal) => signal.tone === "warn")?.tone
    ?? "ok";
}

function normalizeAdvice(raw: unknown, input: BusinessAdvisorInput): BusinessAdvisorAdvice {
  const fallback = fallbackAdvice(input);
  if (typeof raw === "string" && raw.trim()) {
    return {
      summary: raw.trim(),
      action: fallback.action,
      tone: fallback.tone,
    };
  }

  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const object = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : {};
  const summary =
    stringValue(object.summary)
    || stringValue(object.insight)
    || stringValue(object.advice)
    || stringValue(object.text)
    || stringValue(object.message)
    || firstString(object.recommendations)
    || firstString(object.actions)
    || firstString(raw)
    || fallback.summary;
  const action =
    stringValue(object.action)
    || stringValue(object.next_action)
    || stringValue(object.nextStep)
    || stringValue(object.recommendation)
    || firstString(object.actions)
    || firstString(object.recommendations)
    || fallback.action;

  return {
    summary: limitText(summary, 500),
    action: limitText(action, 280),
    tone: normalizeTone(object.tone, input),
  };
}

function advisorPrompt(input: BusinessAdvisorInput): string {
  return `
You are a senior business financial advisor with 20 years of practical experience.
Write a short management insight for a small business/freelancer.

Rules:
- Use ONLY the provided calculated metrics and signals.
- Do not invent revenue sources, conversion, clients, profit, or legal/tax instructions.
- Keep it practical, calm, and owner-focused.
- Mention the main risk or opportunity.
- Give one action for this week.
- summary <= 280 characters, action <= 180 characters.
- Language: ${input.locale === "ru" ? "Russian" : "English"}.
- Return JSON only: { "summary": string, "action": string, "tone": "ok" | "warn" | "risk" }.

Calculated metrics:
${JSON.stringify(input.metrics, null, 2)}

Rule-based signals:
${JSON.stringify(input.signals, null, 2)}
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({
        success: true,
        advice: fallbackAdvice(parsed.data),
        fallback: true,
      });
    }

    const openai = getLlmClient();
    if (!openai) {
      return NextResponse.json({
        success: true,
        advice: fallbackAdvice(parsed.data),
        fallback: true,
      });
    }

    try {
      const completion = await createLlmChatCompletion(openai, {
        messages: [
          {
            role: "system",
            content:
              'You write one concise business finance insight. JSON only: { "summary": string, "action": string, "tone": "ok" | "warn" | "risk" }.',
          },
          { role: "user", content: advisorPrompt(parsed.data) },
        ],
        temperature: 0.3,
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("empty_business_advice");

      const raw: unknown = extractJsonFromLlmContent(content);
      const validated = adviceSchema.safeParse(normalizeAdvice(raw, parsed.data));
      if (!validated.success) throw new Error("invalid_business_advice_json");

      return NextResponse.json({ success: true, advice: validated.data });
    } catch (error) {
      console.warn("[business-advisor fallback]", error);
      return NextResponse.json({
        success: true,
        advice: fallbackAdvice(parsed.data),
        fallback: true,
      });
    }
  } catch (error) {
    console.error("[business-advisor POST]", error);
    return NextResponse.json({ error: "business_advisor_failed" }, { status: 500 });
  }
}
