export type BusinessParsedInput =
  | { kind: "tx"; type: "income" | "expense"; amount: number; note: string }
  | { kind: "cushion"; amount: number }
  | { kind: "family"; amount: number };

function extractAmount(text: string): number | null {
  const m = text.match(/(\d[\d\s.,]*\d|\d+)/);
  if (!m) return null;
  const raw = m[1].replace(/\s/g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stripAmount(text: string): string {
  return text
    .replace(/(\d[\d\s.,]*\d|\d+)\s*(₽|руб\.?|rub)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CUSHION = /\b(подушк|в\s+резерв|cushion|reserve)\b/i;
const FAMILY = /\b(в\s+семью|себе|семейн|family|withdraw)\b/i;
const INCOME = /\b(доход|приход|получил|заработ|income|earned|received)\b/i;
const EXPENSE = /\b(расход|потрат|оплат|закуп|expense|spent|paid)\b/i;

/** Простой разбор текста для бизнес-операций (превью). */
export function parseBusinessInput(text: string): BusinessParsedInput | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const amount = extractAmount(trimmed);
  if (!amount) return null;

  const note = stripAmount(trimmed).slice(0, 120);

  if (CUSHION.test(trimmed)) return { kind: "cushion", amount };
  if (FAMILY.test(trimmed)) return { kind: "family", amount };

  if (INCOME.test(trimmed)) {
    return { kind: "tx", type: "income", amount, note: note || "Доход" };
  }
  if (EXPENSE.test(trimmed)) {
    return { kind: "tx", type: "expense", amount, note: note || "Расход" };
  }

  return { kind: "tx", type: "expense", amount, note: note || "Расход" };
}
