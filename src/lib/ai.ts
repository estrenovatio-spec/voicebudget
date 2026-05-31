import {
  type CategoryDefinition,
  detectCategoryId,
  detectTypeFromCategories,
  getCategoryIdsForPrompt,
  getDefaultCategories,
  getFallbackCategoryId,
  normalizeParsedCategory,
  refineParsedTransaction,
  sanitizeCategories,
} from "@/lib/categories";
import { APP_CURRENCY } from "@/lib/app-currency";
import { parseAmountFromTranscript, resolveTransactionAmount } from "@/lib/parse-amount";
import { isGarbageTranscript } from "@/lib/transcript-guard";
import { ownerHintsForPrompt } from "@/lib/detect-owner";
import { sanitizeTransactionNote } from "@/lib/transaction-note";
import type { Locale, ParsedTransaction, TxType } from "@/types";

export const PARSE_PROMPT = (
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
  partnerName?: string | null,
  myName?: string | null,
) => {
  const expenseIds = getCategoryIdsForPrompt(categories, "expense", locale);
  const incomeIds = getCategoryIdsForPrompt(categories, "income", locale);
  const ownerHints = ownerHintsForPrompt(locale, partnerName, myName);
  const partnerRule = ownerHints
    ? `${ownerHints}\n- «возврат» / refund for partner → income categoryId refund.`
    : "";
  return `
Extract financial transaction(s) from: "${transcript}"
Return ONLY valid JSON matching this schema:
{
  "transactions": [
    {
      "amount": number,
      "type": "income" or "expense",
      "categoryId": string,
      "currency": "RUB",
      "note": string,
      "date": "YYYY-MM-DD"
    }
  ]
}
Rules:
- ONE voice phrase may contain SEVERAL operations — return each as a separate object in "transactions".
- Examples: "500 на обед и 200 на такси" → 2 items; "потратил 300 на кофе, 1500 на продукты" → 2 items.
- Each item: its own amount, categoryId, and short note (only that operation, NOT the whole phrase).
- If only one operation → "transactions" array with exactly 1 element.
- Owner is per operation: «купил цветы жене» = user spent (not partner); «жена потратила» = partner.
- categoryId MUST be one of the allowed ids for the transaction type.
- Expense categoryIds: ${expenseIds}
- Income categoryIds: ${incomeIds}
- Russian amounts: "100 тысяч" / "100 тыс" = 100000; "1.5 млн" = 1500000; "100.000" rubles = 100000 (dot as thousands separator, NOT 100.0).
- "потратил 100 тысяч на ремонт" → amount 100000, categoryId housing if available.
- "ксюше возврат 100" / "вернули 100" → type income, categoryId refund.
- Rental income: "субаренда", "арендный доход", "за аренду", "сдача квартиры" → type income (freelance or income_other), NOT expense rent.
- currency MUST always be "RUB" (even if user says euro, dollar, €, $ — record amount as rubles).
- If amount missing for an item → 0. If type unclear → "expense". Locale: ${locale}.
${partnerRule}
`;
};

const INCOME_KEYWORDS_RU = [
  "получил",
  "получила",
  "получили",
  "зарплата",
  "доход",
  "пришло",
  "пришли",
  "зачислили",
  "зачисление",
  "поступило",
  "поступили",
  "возврат",
  "вернули",
  "вернула",
  "компенсация",
  "кэшбэк",
  "кешбэк",
  "субаренда",
  "субаренду",
  "субаренде",
  "арендный доход",
  "сдача квартиры",
  "сдаю квартиру",
  "сдали квартиру",
  "за аренду",
  "оплата аренды",
  "арендная плата",
];
const INCOME_KEYWORDS_EN = ["received", "salary", "income", "earned", "got paid"];
const EXPENSE_KEYWORDS_RU = ["потратил", "купил", "оплатил", "расход", "потратила"];
const EXPENSE_KEYWORDS_EN = ["spent", "bought", "paid", "expense"];

export function detectType(
  transcript: string,
  locale: Locale,
  categories?: CategoryDefinition[],
): TxType {
  if (categories?.length) {
    const fromCats = detectTypeFromCategories(transcript, categories);
    if (fromCats) return fromCats;
  }
  const lower = transcript.toLowerCase();
  const incomeKw = locale === "ru" ? INCOME_KEYWORDS_RU : INCOME_KEYWORDS_EN;
  const expenseKw = locale === "ru" ? EXPENSE_KEYWORDS_RU : EXPENSE_KEYWORDS_EN;
  const isIncome = incomeKw.some((w) => lower.includes(w));
  const isExpense = expenseKw.some((w) => lower.includes(w));
  return isIncome && !isExpense ? "income" : "expense";
}

export function splitTranscriptClauses(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const splitRe =
    /\s*[;,]\s*|\s+и\s+|\s+ещё?\s+|\s+потом\s+|\s+также\s+|\s+а\s+(?=потрат|куп|оплат|получ|заплат)|(?<=(?:на\s+[\p{L}\d-]+))\s+(?=\d[\d\s.,]*\s*(?:руб|₽|рубл(?:ей|я|ь)?))/iu;

  const parts = trimmed
    .split(splitRe)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts : [trimmed];
}

export function fallbackParse(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
): ParsedTransaction {
  if (isGarbageTranscript(transcript)) {
    return {
      amount: 0,
      type: "expense",
      categoryId: getFallbackCategoryId("expense"),
      currency: APP_CURRENCY,
      note: "",
      date: new Date().toISOString().slice(0, 10),
    };
  }

  const type = detectType(transcript, locale, sanitizeCategories(categories));
  const amount = parseAmountFromTranscript(transcript, locale);

  let resolvedType = type;
  if (/возврат|вернули|вернула|refund|cashback|кэшбэк|кешбэк/i.test(transcript)) {
    resolvedType = "income";
  }

  let categoryId = detectCategoryId(transcript, resolvedType, sanitizeCategories(categories));
  if (/возврат|вернули|refund/i.test(transcript) && resolvedType === "income") {
    const refundCat = sanitizeCategories(categories).find((c) => c.id === "refund");
    if (refundCat) categoryId = "refund";
  }

  return {
    amount,
    type: resolvedType,
    categoryId: categoryId || getFallbackCategoryId(resolvedType),
    currency: APP_CURRENCY,
    note: sanitizeTransactionNote(transcript.slice(0, 120), amount),
    date: new Date().toISOString().slice(0, 10),
  };
}

export function fallbackParseMany(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
): ParsedTransaction[] {
  const clauses = splitTranscriptClauses(transcript);
  const items = clauses
    .map((clause) => fallbackParse(clause, locale, categories))
    .filter((item) => item.amount > 0);

  if (items.length > 0) return items;

  const single = fallbackParse(transcript, locale, categories);
  return single.amount > 0 ? [single] : [];
}

export function normalizeAiParsed(
  raw: {
    amount: number;
    type: TxType;
    category?: string;
    categoryId?: string;
    currency: ParsedTransaction["currency"];
    note: string;
    date: string;
  },
  transcript: string,
  categories: CategoryDefinition[],
  locale: Locale,
): ParsedTransaction {
  const categoryId = normalizeParsedCategory(
    raw.categoryId ?? raw.category,
    transcript,
    raw.type,
    categories,
  );
  const amount = resolveTransactionAmount(transcript, raw.amount, locale);

  const base: ParsedTransaction = {
    amount,
    type: raw.type,
    categoryId,
    currency: APP_CURRENCY,
    note: sanitizeTransactionNote(raw.note || transcript.slice(0, 120), amount),
    date: raw.date,
  };
  return refineParsedTransaction(base, transcript, categories, detectType, locale);
}
