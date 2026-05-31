import { z } from "zod";
import { APP_CURRENCY } from "@/lib/app-currency";
import {
  PARSE_PROMPT,
  fallbackParse,
  fallbackParseMany,
  normalizeAiParsed,
  splitTranscriptClauses,
} from "@/lib/ai";
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

const MAX_TRANSACTIONS = 10;

const parsedItemSchema = z
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

const parsedManySchema = z.object({
  transactions: z.array(parsedItemSchema).min(1).max(MAX_TRANSACTIONS),
});

type ParsedItem = z.infer<typeof parsedItemSchema>;

function emptyFallback(locale: Locale, categories: CategoryDefinition[]): ParsedTransaction {
  return fallbackParse("", locale, categories);
}

function itemToParsedTransaction(
  item: ParsedItem,
  clause: string,
  locale: Locale,
  categories: CategoryDefinition[],
): ParsedTransaction {
  const today = new Date().toISOString().slice(0, 10);
  const normalized = {
    ...item,
    currency: APP_CURRENCY,
    note: sanitizeTransactionNote(item.note?.trim() || clause.slice(0, 120), item.amount),
    date: item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : today,
  };
  return normalizeAiParsed(normalized, clause, categories, locale);
}

function extractParsedItems(raw: unknown): ParsedItem[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      const parsed = parsedItemSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("AI JSON validation failed");
  }

  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.transactions)) {
    const validated = parsedManySchema.safeParse(obj);
    if (!validated.success) throw new Error("AI JSON validation failed");
    return validated.data.transactions;
  }

  const single = parsedItemSchema.safeParse(obj);
  if (single.success) return [single.data];

  throw new Error("AI JSON validation failed");
}

function applyOwnersToItems(
  items: ParsedTransaction[],
  fullText: string,
  ownerOpts: OwnerDetectOptions,
): ParsedTransaction[] {
  const clauses = splitTranscriptClauses(fullText);
  return items.map((item, index) => {
    const clause = clauses[index]?.trim() || item.note?.trim() || fullText;
    return applyDetectedOwner(item, clause, ownerOpts, item.owner ?? "me");
  });
}

export async function parseTranscriptServerMany(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
  ownerCtx?: OwnerDetectOptions | string | null,
): Promise<{ items: ParsedTransaction[]; fallback: boolean }> {
  const text = transcript.trim();
  const ownerOpts = normalizeOwnerDetectOptions(ownerCtx, locale);
  if (ownerOpts.hasPartner === undefined) {
    ownerOpts.hasPartner = hasPartnerBudget(ownerOpts.partnerName);
  }

  const withOwner = (items: ParsedTransaction[]) =>
    applyOwnersToItems(items, text, ownerOpts);

  if (!text) {
    return { items: withOwner([emptyFallback(locale, categories)]), fallback: true };
  }

  const clauses = splitTranscriptClauses(text);

  if (!isLlmConfigured()) {
    return { items: withOwner(fallbackParseMany(text, locale, categories)), fallback: true };
  }

  const openai = getLlmClient();
  if (!openai) {
    return { items: withOwner(fallbackParseMany(text, locale, categories)), fallback: true };
  }

  try {
    const completion = await createLlmChatCompletion(openai, {
      messages: [
        {
          role: "system",
          content:
            "You extract one or more financial transactions from a phrase. Respond with JSON only.",
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
    const parsedItems = extractParsedItems(raw);

    const items = parsedItems
      .map((item, index) =>
        itemToParsedTransaction(
          item,
          clauses[index] ?? item.note?.trim() ?? text,
          locale,
          categories,
        ),
      )
      .filter((item) => item.amount > 0);

    if (items.length === 0) throw new Error("No valid transactions");

    return { items: withOwner(items), fallback: false };
  } catch (err) {
    console.error("[parse-voice-server] LLM error", {
      message: err instanceof Error ? err.message : err,
      baseUrl: getLlmBaseUrl() ?? "(official OpenAI)",
      model: getLlmModel(),
    });
    return { items: withOwner(fallbackParseMany(text, locale, categories)), fallback: true };
  }
}

/** @deprecated prefer parseTranscriptServerMany — returns first item only */
export async function parseTranscriptServer(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
  ownerCtx?: OwnerDetectOptions | string | null,
): Promise<{ data: ParsedTransaction; fallback: boolean }> {
  const { items, fallback } = await parseTranscriptServerMany(
    transcript,
    locale,
    categories,
    ownerCtx,
  );
  return {
    data: items[0] ?? emptyFallback(locale, categories),
    fallback,
  };
}
