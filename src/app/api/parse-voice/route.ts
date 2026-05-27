import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { PARSE_PROMPT, fallbackParse, normalizeAiParsed } from "@/lib/ai";
import { getDefaultCategories } from "@/lib/categories";
import type { Locale, ParsedTransaction } from "@/types";

const TELEGRAM_ORIGIN_PATTERN = /\.telegram\.org$/;

const parsedSchema = z
  .object({
    amount: z.number(),
    type: z.enum(["income", "expense"]),
    categoryId: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    currency: z.enum(["RUB", "USD", "EUR"]),
    note: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => Boolean(d.categoryId || d.category), {
    message: "categoryId or category required",
  });

const bodySchema = z.object({
  transcript: z.string().min(1),
  locale: z.enum(["ru", "en"]),
});

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin &&
    (origin === "https://web.telegram.org" || TELEGRAM_ORIGIN_PATTERN.test(new URL(origin).hostname));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://web.telegram.org",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const categories = getDefaultCategories();

  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { transcript, locale } = parsed.data;

    const respond = (data: ParsedTransaction, fallback = false) =>
      NextResponse.json(
        { success: true, data, fallback },
        { headers: corsHeaders(origin) },
      );

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return respond(fallbackParse(transcript, locale as Locale, categories), true);
    }

    const openai = new OpenAI({ apiKey });

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You extract financial transactions. Respond with JSON only.",
          },
          {
            role: "user",
            content: PARSE_PROMPT(transcript, locale as Locale, categories),
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");

      const raw: unknown = JSON.parse(content);
      const validated = parsedSchema.safeParse(raw);
      if (!validated.success) throw new Error("AI JSON validation failed");

      const data = normalizeAiParsed(validated.data, transcript, categories, locale as Locale);
      return respond(data);
    } catch {
      return respond(fallbackParse(transcript, locale as Locale, categories), true);
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to parse transcript" },
      { status: 400, headers: corsHeaders(origin) },
    );
  }
}
