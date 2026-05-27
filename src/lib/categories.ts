import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import type { CategoryDefinition, Locale, TxType } from "@/types";

export type { CategoryDefinition } from "@/types";

export { DEFAULT_CATEGORIES };

const LEGACY_LABEL_TO_ID: Record<string, string> = {
  еда: "food",
  food: "food",
  такси: "transport",
  transport: "transport",
  прочее: "other",
  other: "other",
  доход: "income_other",
  income: "income_other",
  "прочий доход": "income_other",
  "other income": "income_other",
  зарплата: "salary",
  salary: "salary",
  аренда: "rent",
  rent: "rent",
  одежда: "clothing",
  clothing: "clothing",
  "банки и кредиты": "banking",
  банк: "banking",
  кредит: "banking",
  отдых: "leisure",
  отпуск: "vacation",
  развлечения: "entertainment",
  подарки: "gifts",
  подарок: "gifts",
  пожертвование: "charity",
  пожертвования: "charity",
  "регулярные платежи": "recurring",
  услуги: "services",
  хознужды: "household_supplies",
  "хоз нужды": "household_supplies",
};

export function getDefaultCategories(): CategoryDefinition[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, keywords: [...c.keywords] }));
}

function normalizeCategory(raw: unknown, fallback?: CategoryDefinition): CategoryDefinition | null {
  if (!raw || typeof raw !== "object") return fallback ?? null;
  const item = raw as Partial<CategoryDefinition>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : fallback?.id;
  const type =
    item.type === "income" || item.type === "expense" ? item.type : fallback?.type ?? "expense";
  if (!id) return fallback ?? null;

  const labelsRaw = item.labels as { ru?: string; en?: string } | undefined;
  const ru =
    typeof labelsRaw?.ru === "string" && labelsRaw.ru.trim()
      ? labelsRaw.ru.trim()
      : (fallback?.labels.ru ?? id);
  const en =
    typeof labelsRaw?.en === "string" && labelsRaw.en.trim()
      ? labelsRaw.en.trim()
      : (fallback?.labels.en ?? ru);

  const keywords = Array.isArray(item.keywords)
    ? item.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim().toLowerCase()).filter(Boolean)
    : (fallback?.keywords ?? []);

  return {
    id,
    type,
    labels: { ru, en },
    keywords,
    isSystem: Boolean(item.isSystem ?? fallback?.isSystem),
  };
}

/** Восстанавливает категории из localStorage — битые записи не роняют UI */
export function sanitizeCategories(input: unknown): CategoryDefinition[] {
  const defaults = getDefaultCategories();
  const byId = new Map(defaults.map((c) => [c.id, { ...c }]));

  if (Array.isArray(input)) {
    for (const raw of input) {
      const id =
        raw && typeof raw === "object" && typeof (raw as CategoryDefinition).id === "string"
          ? (raw as CategoryDefinition).id
          : null;
      const normalized = normalizeCategory(raw, id ? byId.get(id) : undefined);
      if (!normalized) continue;
      const existing = byId.get(normalized.id);
      if (existing?.isSystem && normalized.isSystem) {
        const keywords = [
          ...new Set([...existing.keywords, ...normalized.keywords].map((k) => k.toLowerCase())),
        ];
        byId.set(normalized.id, { ...existing, ...normalized, keywords });
      } else {
        byId.set(normalized.id, normalized);
      }
    }
  }

  return Array.from(byId.values());
}

export function getCategoryLabel(
  categoryId: string,
  categories: CategoryDefinition[],
  locale: Locale,
): string {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat?.labels) return categoryId;
  const label = locale === "ru" ? cat.labels.ru : cat.labels.en;
  return label?.trim() || categoryId;
}

export function getCategoriesByType(
  categories: CategoryDefinition[],
  type: TxType,
): CategoryDefinition[] {
  return categories.filter((c) => c.type === type);
}

export function getFallbackCategoryId(type: TxType): string {
  return type === "income" ? "income_other" : "other";
}

function scoreCategory(text: string, category: CategoryDefinition): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of category.keywords) {
    if (kw && lower.includes(kw.toLowerCase())) {
      score += kw.length >= 5 ? 3 : 2;
    }
  }
  const labelRu = category.labels?.ru?.toLowerCase() ?? "";
  const labelEn = category.labels?.en?.toLowerCase() ?? "";
  if (labelRu.length > 2 && lower.includes(labelRu)) score += 4;
  if (labelEn.length > 2 && lower.includes(labelEn)) score += 4;
  return score;
}

export function detectCategoryId(
  text: string,
  type: TxType,
  categories: CategoryDefinition[],
): string {
  const pool = getCategoriesByType(categories, type).filter((c) => c.id !== getFallbackCategoryId(type));
  let bestId = getFallbackCategoryId(type);
  let bestScore = 0;

  for (const cat of pool) {
    const score = scoreCategory(text, cat);
    if (score > bestScore) {
      bestScore = score;
      bestId = cat.id;
    }
  }

  return bestId;
}

export function matchCategoryIdFromText(
  raw: string,
  type: TxType,
  categories: CategoryDefinition[],
): string {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return getFallbackCategoryId(type);

  const byId = categories.find((c) => c.id.toLowerCase() === normalized && c.type === type);
  if (byId) return byId.id;

  const legacy = LEGACY_LABEL_TO_ID[normalized];
  if (legacy && categories.some((c) => c.id === legacy && c.type === type)) {
    return legacy;
  }

  for (const cat of categories) {
    if (cat.type !== type) continue;
    const ru = cat.labels?.ru?.toLowerCase() ?? "";
    const en = cat.labels?.en?.toLowerCase() ?? "";
    if (ru === normalized || en === normalized) {
      return cat.id;
    }
  }

  const detected = detectCategoryId(raw, type, categories);
  if (detected !== getFallbackCategoryId(type)) return detected;

  return detectCategoryId(raw, type, categories);
}

export function normalizeParsedCategory(
  rawCategory: string | undefined,
  transcript: string,
  type: TxType,
  categories: CategoryDefinition[],
): string {
  const text = `${transcript} ${rawCategory ?? ""}`.trim();
  if (rawCategory?.trim()) {
    const matched = matchCategoryIdFromText(rawCategory, type, categories);
    if (matched !== getFallbackCategoryId(type)) return matched;
  }
  return detectCategoryId(text, type, categories);
}

export function getCategoryIdsForPrompt(
  categories: CategoryDefinition[],
  type: TxType,
  locale: Locale,
): string {
  return getCategoriesByType(categories, type)
    .map((c) => `${c.id} (${locale === "ru" ? c.labels.ru : c.labels.en})`)
    .join(", ");
}

export function slugifyCategoryId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || `custom-${Date.now()}`
  );
}
