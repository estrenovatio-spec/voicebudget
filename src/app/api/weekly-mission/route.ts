import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLlmChatCompletion, getLlmClient, isLlmConfigured } from "@/lib/llm";
import { extractJsonFromLlmContent } from "@/lib/llm-json";

const missionSchema = z.object({
  title: z.string().min(6).max(80),
  detail: z.string().min(20).max(360),
  tone: z.enum(["focus", "save", "learn", "habit"]),
});

const bodySchema = z.object({
  locale: z.enum(["ru", "en"]),
  periodStart: z.string().min(8),
  periodEnd: z.string().min(8),
  transactionsCount: z.number().min(0),
  learnedRulesCount: z.number().min(0),
  context: z.unknown(),
  ruleMissions: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        tone: z.enum(["focus", "save", "learn", "habit"]),
      }),
    )
    .max(3),
});

function fallbackMission(input: z.infer<typeof bodySchema>) {
  return (
    input.ruleMissions[0] ?? {
      title: input.locale === "ru" ? "5 дней без пропусков" : "5 days without gaps",
      detail:
        input.locale === "ru"
          ? "Записывайте хотя бы одну операцию в день. Цель — не идеальный бюджет, а непрерывность и привычка."
          : "Record at least one entry per day. The goal is continuity and habit, not a perfect budget.",
      tone: "habit" as const,
    }
  );
}

function missionPrompt(input: z.infer<typeof bodySchema>): string {
  const isRu = input.locale === "ru";
  return `
You are a senior financial advisor with 20 years of practical family-finance experience.
Choose ONE weekly mission that builds financial literacy and a useful money habit.

Strict principles:
- No shame, no fear, no harsh austerity.
- Do not suggest cutting health, children, education, emergency, debt minimum payments, taxes, or mandatory bills.
- If a sensitive category is visible, suggest planning, checking documents, splitting payments, insurance/tax deduction, or building reserve.
- The mission must be doable in 7 days and take 5-20 minutes or one small action.
- Prefer behavior change over generic advice.
- Use the user's own behavior: categories, repeated phrases, goals, limits, debts, cashflow risk, AI memory.
- Do not mention that you are an AI.
- Return JSON only: { "title": string, "detail": string, "tone": "focus" | "save" | "learn" | "habit" }.
- Language: ${isRu ? "Russian" : "English"}.

Good mission examples in Russian:
- "Разобрать один повторяющийся расход"
- "Проверить обязательный платёж"
- "Закрепить правило для ИИ"
- "Пополнить резерв малой суммой"

Period: ${input.periodStart} — ${input.periodEnd}
Transactions this week: ${input.transactionsCount}
Learned personal rules: ${input.learnedRulesCount}

Current rule-based candidates:
${JSON.stringify(input.ruleMissions, null, 2)}

User behavior context:
${JSON.stringify(input.context, null, 2)}
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
        mission: fallbackMission(parsed.data),
        fallback: true,
      });
    }

    const openai = getLlmClient();
    if (!openai) {
      return NextResponse.json({
        success: true,
        mission: fallbackMission(parsed.data),
        fallback: true,
      });
    }

    try {
      const completion = await createLlmChatCompletion(openai, {
        messages: [
          {
            role: "system",
            content:
              'You choose one weekly financial habit mission. JSON only: { "title": string, "detail": string, "tone": "focus" | "save" | "learn" | "habit" }.',
          },
          { role: "user", content: missionPrompt(parsed.data) },
        ],
        temperature: 0.35,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("empty_mission_response");

      const raw: unknown = extractJsonFromLlmContent(content);
      const validated = missionSchema.safeParse(raw);
      if (!validated.success) throw new Error("invalid_mission_json");

      return NextResponse.json({ success: true, mission: validated.data });
    } catch (error) {
      console.error("[weekly-mission]", error);
      return NextResponse.json({
        success: true,
        mission: fallbackMission(parsed.data),
        fallback: true,
      });
    }
  } catch (error) {
    console.error("[weekly-mission POST]", error);
    return NextResponse.json({ error: "weekly_mission_failed" }, { status: 500 });
  }
}
