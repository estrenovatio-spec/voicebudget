import type { Locale, TxType } from "@/types";

export interface CategoryDefinition {
  id: string;
  type: TxType;
  labels: { ru: string; en: string };
  keywords: string[];
  isSystem: boolean;
}

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: "food",
    type: "expense",
    labels: { ru: "Еда", en: "Food" },
    keywords: [
      "еда",
      "обед",
      "завтрак",
      "ужин",
      "продукт",
      "продукты",
      "магазин",
      "супермаркет",
      "ресторан",
      "кафе",
      "кофе",
      "пицц",
      "бургер",
      "доставк",
      "перекус",
      "lunch",
      "dinner",
      "breakfast",
      "food",
      "grocery",
      "groceries",
      "restaurant",
      "cafe",
      "coffee",
      "snack",
      "uber eats",
      "delivery",
    ],
    isSystem: true,
  },
  {
    id: "transport",
    type: "expense",
    labels: { ru: "Транспорт", en: "Transport" },
    keywords: [
      "такси",
      "метро",
      "автобус",
      "трамвай",
      "бензин",
      "азс",
      "заправ",
      "парков",
      "каршер",
      "яндекс go",
      "uber",
      "bolt",
      "проезд",
      "transport",
      "taxi",
      "fuel",
      "gas",
      "parking",
      "metro",
      "bus",
      "train",
    ],
    isSystem: true,
  },
  {
    id: "housing",
    type: "expense",
    labels: { ru: "Жильё", en: "Housing" },
    keywords: [
      "аренд",
      "квартир",
      "ипотек",
      "жкх",
      "коммунал",
      "электрич",
      "вода",
      "газ",
      "интернет",
      "дом",
      "ремонт",
      "отделк",
      "renovation",
      "repair",
      "rent",
      "mortgage",
      "utilities",
      "housing",
      "landlord",
    ],
    isSystem: true,
  },
  {
    id: "shopping",
    type: "expense",
    labels: { ru: "Покупки", en: "Shopping" },
    keywords: [
      "одежд",
      "обув",
      "маркетплейс",
      "wildberries",
      "ozon",
      "amazon",
      "шопинг",
      "покупк",
      "shopping",
      "clothes",
      "shoes",
      "mall",
    ],
    isSystem: true,
  },
  {
    id: "health",
    type: "expense",
    labels: { ru: "Здоровье", en: "Health" },
    keywords: [
      "аптек",
      "врач",
      "клиник",
      "стоматолог",
      "лекарств",
      "больниц",
      "фитнес",
      "спортзал",
      "health",
      "pharmacy",
      "doctor",
      "medicine",
      "gym",
      "dental",
    ],
    isSystem: true,
  },
  {
    id: "entertainment",
    type: "expense",
    labels: { ru: "Развлечения", en: "Entertainment" },
    keywords: [
      "кино",
      "театр",
      "концерт",
      "игр",
      "netflix",
      "spotify",
      "подписк",
      "развлеч",
      "бар",
      "entertainment",
      "movie",
      "games",
      "concert",
    ],
    isSystem: true,
  },
  {
    id: "subscriptions",
    type: "expense",
    labels: { ru: "Подписки", en: "Subscriptions" },
    keywords: [
      "подписк",
      "subscription",
      "icloud",
      "youtube premium",
      "chatgpt",
      "сервис",
      "абонемент",
    ],
    isSystem: true,
  },
  {
    id: "education",
    type: "expense",
    labels: { ru: "Образование", en: "Education" },
    keywords: [
      "курс",
      "обучен",
      "университет",
      "школ",
      "книг",
      "учеб",
      "education",
      "course",
      "tuition",
      "books",
    ],
    isSystem: true,
  },
  {
    id: "other",
    type: "expense",
    labels: { ru: "Прочее", en: "Other" },
    keywords: [],
    isSystem: true,
  },
  {
    id: "salary",
    type: "income",
    labels: { ru: "Зарплата", en: "Salary" },
    keywords: ["зарплат", "оклад", "аванс", "salary", "paycheck", "wage", "payroll"],
    isSystem: true,
  },
  {
    id: "freelance",
    type: "income",
    labels: { ru: "Фриланс", en: "Freelance" },
    keywords: ["фриланс", "подработ", "проект", "freelance", "contract", "invoice"],
    isSystem: true,
  },
  {
    id: "income_other",
    type: "income",
    labels: { ru: "Прочий доход", en: "Other income" },
    keywords: ["доход", "получил", "зачислили", "income", "received", "refund", "возврат"],
    isSystem: true,
  },
];

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
      if (normalized) byId.set(normalized.id, normalized);
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
