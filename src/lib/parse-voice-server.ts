import { z } from "zod";
import { APP_CURRENCY } from "@/lib/app-currency";
import { PARSE_PROMPT, fallbackParse, normalizeAiParsed } from "@/lib/ai";
import { getDefaultCategories } from "@/lib/categories";
import {
  createLlmChatCompletion,
  getLlmBaseUrl,
  getLlmClient,
  getLlmModel,
  isLlmConfigured,
} from "@/lib/llm";
import { extractJsonFromLlmContent } from "@/lib/llm-json";
import {
  applyDetectedOwner,
  normalizeOwnerDetectOptions,
  type OwnerDetectOptions,
} from "@/lib/detect-owner";
import { hasPartnerBudget } from "@/lib/owner-labels";
import { sanitizeTransactionNote } from "@/lib/transaction-note";
import type { CategoryDefinition, Locale, ParsedTransaction } from "@/types";

const parsedSchema = z
  .object({
    amount: z.coerce.number(),
    type: z.enum(["income", "expense"]),
    categoryId: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    currency: z.enum(["RUB", "USD", "EUR"]).optional(),
    note: z.string().optional(),
    date: z.string().optional(),
  })
  .refine((d) => Boolean(d.categoryId || d.category), {
    message: "categoryId or category required",
  });

export async function parseTranscriptServer(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
  ownerCtx?: OwnerDetectOptions | string | null,
): Promise<{ data: ParsedTransaction; fallback: boolean }> {
  const text = transcript.trim();
  const ownerOpts = normalizeOwnerDetectOptions(ownerCtx, locale);
  if (ownerOpts.hasPartner === undefined) {
    ownerOpts.hasPartner = hasPartnerBudget(ownerOpts.partnerName);
  }

  if (!text) {
    return {
      data: fallbackParse(text, locale, categories),
      fallback: true,
    };
  }

  const withOwner = (data: ParsedTransaction) =>
    applyDetectedOwner(data, text, ownerOpts, data.owner ?? "me");

  if (!isLlmConfigured()) {
    return { data: withOwner(fallbackParse(text, locale, categories)), fallback: true };
  }

  const openai = getLlmClient();
  if (!openai) {
    return { data: withOwner(fallbackParse(text, locale, categories)), fallback: true };
  }

  try {
    const completion = await createLlmChatCompletion(openai, {
      messages: [
        {
          role: "system",
          content: "You extract financial transactions. Respond with JSON only.",
        },
        {
          role: "user",
          content: PARSE_PROMPT(
            text,
            locale,
            categories,
            ownerOpts.partnerName,
            ownerOpts.myName,
          ),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const raw: unknown = extractJsonFromLlmContent(content);
    const validated = parsedSchema.safeParse(raw);
    if (!validated.success) throw new Error("AI JSON validation failed");

    const today = new Date().toISOString().slice(0, 10);
    const normalized = {
      ...validated.data,
      currency: APP_CURRENCY,
      note: sanitizeTransactionNote(
        validated.data.note?.trim() || text.slice(0, 120),
        validated.data.amount,
      ),
      date:
        validated.data.date && /^\d{4}-\d{2}-\d{2}$/.test(validated.data.date)
          ? validated.data.date
          : today,
    };

    return {
      data: withOwner(normalizeAiParsed(normalized, text, categories, locale)),
      fallback: false,
    };
  } catch (err) {
    console.error("[parse-voice-server] LLM error", {
      message: err instanceof Error ? err.message : err,
      baseUrl: getLlmBaseUrl() ?? "(official OpenAI)",
      model: getLlmModel(),
    });
    return { data: withOwner(fallbackParse(text, locale, categories)), fallback: true };
  }
}
