import {
  type CategoryDefinition,
  detectCategoryId,
  getCategoryIdsForPrompt,
  getDefaultCategories,
  getFallbackCategoryId,
  normalizeParsedCategory,
} from "@/lib/categories";
import { parseAmountFromTranscript, resolveTransactionAmount } from "@/lib/parse-amount";
import type { Locale, ParsedTransaction, TxType } from "@/types";

export const PARSE_PROMPT = (
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
) => {
  const expenseIds = getCategoryIdsForPrompt(categories, "expense", locale);
  const incomeIds = getCategoryIdsForPrompt(categories, "income", locale);
  return `
Extract financial transaction from: "${transcript}"
Return ONLY valid JSON matching this schema:
{
  "amount": number,
  "type": "income" or "expense",
  "categoryId": string,
  "currency": "RUB" | "USD" | "EUR",
  "note": string,
  "date": "YYYY-MM-DD"
}
Rules:
- categoryId MUST be one of the allowed ids for the transaction type.
- Expense categoryIds: ${expenseIds}
- Income categoryIds: ${incomeIds}
- Russian amounts: "100 тысяч" / "100 тыс" = 100000; "1.5 млн" = 1500000; "100.000" rubles = 100000 (dot as thousands separator, NOT 100.0).
- "потратил 100 тысяч на ремонт" → amount 100000, categoryId housing if available.
- If amount missing → 0. If type unclear → "expense". Locale: ${locale}.
`;
};

const INCOME_KEYWORDS_RU = ["получил", "зарплата", "доход", "пришло", "зачислили"];
const INCOME_KEYWORDS_EN = ["received", "salary", "income", "earned", "got paid"];
const EXPENSE_KEYWORDS_RU = ["потратил", "купил", "оплатил", "расход", "потратила"];
const EXPENSE_KEYWORDS_EN = ["spent", "bought", "paid", "expense"];

function detectType(transcript: string, locale: Locale): TxType {
  const lower = transcript.toLowerCase();
  const incomeKw = locale === "ru" ? INCOME_KEYWORDS_RU : INCOME_KEYWORDS_EN;
  const expenseKw = locale === "ru" ? EXPENSE_KEYWORDS_RU : EXPENSE_KEYWORDS_EN;
  const isIncome = incomeKw.some((w) => lower.includes(w));
  const isExpense = expenseKw.some((w) => lower.includes(w));
  return isIncome && !isExpense ? "income" : "expense";
}

export function fallbackParse(
  transcript: string,
  locale: Locale,
  categories: CategoryDefinition[] = getDefaultCategories(),
): ParsedTransaction {
  const type = detectType(transcript, locale);
  const amount = parseAmountFromTranscript(transcript, locale);

  const lower = transcript.toLowerCase();
  const currency: ParsedTransaction["currency"] =
    lower.includes("usd") || lower.includes("$")
      ? "USD"
      : lower.includes("eur") || lower.includes("€")
        ? "EUR"
        : locale === "ru"
          ? "RUB"
          : "USD";

  const categoryId = detectCategoryId(transcript, type, categories);

  return {
    amount,
    type,
    categoryId: categoryId || getFallbackCategoryId(type),
    currency,
    note: transcript.slice(0, 120),
    date: new Date().toISOString().slice(0, 10),
  };
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

  return {
    amount,
    type: raw.type,
    categoryId,
    currency: raw.currency,
    note: raw.note,
    date: raw.date,
  };
}
