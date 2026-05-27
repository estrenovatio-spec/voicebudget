import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import {
  AI_RECOMMENDATIONS_MIN_DAYS,
  type BudgetSummary,
} from "@/lib/budget-analytics";
import { getAdvisorConfig } from "@/lib/advisor-config";
import { RECOMMENDATIONS_PROMPT, ruleBasedRecommendations } from "@/lib/ai-recommendations";
import type { Locale } from "@/types";

const summarySchema = z.object({
  daysTracked: z.number(),
  transactionCount: z.number(),
  totalIncome: z.number(),
  totalExpense: z.number(),
  balance: z.number(),
  expenseByCategory: z.array(
    z.object({
      category: z.string(),
      amount: z.number(),
      sharePercent: z.number(),
    }),
  ),
  incomeByCategory: z.array(z.object({ category: z.string(), amount: z.number() })),
  monthlyExpenses: z.array(z.object({ month: z.string(), amount: z.number() })),
  firstDate: z.string().nullable(),
  lastDate: z.string().nullable(),
  currency: z.string(),
});

const bodySchema = z.object({
  locale: z.enum(["ru", "en"]),
  summary: summarySchema,
});

const tipsSchema = z.object({
  tips: z.array(z.string().min(1)).min(1).max(8),
});

export async function POST(request: NextRequest) {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { locale, summary } = parsed.data;
    const advisor = getAdvisorConfig();

    if (summary.transactionCount === 0) {
      return NextResponse.json(
        {
          error: "no_transactions",
          tips: ruleBasedRecommendations(summary, locale as Locale, advisor),
        },
        { status: 400 },
      );
    }

    if (summary.daysTracked < AI_RECOMMENDATIONS_MIN_DAYS) {
      const daysLeft = AI_RECOMMENDATIONS_MIN_DAYS - summary.daysTracked;
      return NextResponse.json(
        {
          error: "insufficient_history",
          daysTracked: summary.daysTracked,
          daysLeft,
          minDays: AI_RECOMMENDATIONS_MIN_DAYS,
        },
        { status: 403 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        tips: ruleBasedRecommendations(summary, locale as Locale, advisor),
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a senior financial advisor (20+ years). Output JSON only: { \"tips\": string[] }.",
          },
          {
            role: "user",
            content: RECOMMENDATIONS_PROMPT(
              summary as BudgetSummary,
              locale as Locale,
              advisor,
            ),
          },
        ],
        temperature: 0.6,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response");

      const raw: unknown = JSON.parse(content);
      const validated = tipsSchema.safeParse(raw);
      if (!validated.success) throw new Error("Invalid tips JSON");

      return NextResponse.json({ success: true, tips: validated.data.tips });
    } catch {
      return NextResponse.json({
        success: true,
        tips: ruleBasedRecommendations(summary, locale as Locale, advisor),
        fallback: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
