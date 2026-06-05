import type { CategoryDefinition, Locale, ParsedTransaction, Transaction, TxType } from "@/types";

export type AiMemoryRule = {
  phrase: string;
  categoryId: string;
  type: TxType;
  weight: number;
  source: "voice" | "text" | "correction";
  lastSeenAt: string;
};

export type AiUserMemory = {
  version: 1;
  rules: AiMemoryRule[];
};

export type AiMemoryInsight = {
  title: string;
  detail: string;
  severity: "positive" | "neutral" | "warning";
};

const AI_MEMORY_KEY = "voicebudget-ai-memory-v1";
const MAX_RULES = 120;
const MAX_PHRASE_WORDS = 5;

function nowIso(): string {
  return new Date().toISOString();
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\b\d+[\d\s.,]*\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseCandidates(input: string): string[] {
  const text = normalizeText(input);
  if (!text) return [];
  const stop = new Set([
    "на",
    "за",
    "в",
    "и",
    "по",
    "руб",
    "рублей",
    "рубля",
    "потратил",
    "потратила",
    "купил",
    "купила",
    "оплатил",
    "оплатила",
    "получил",
    "получила",
    "spent",
    "paid",
    "bought",
    "received",
  ]);
  const words = text.split(" ").filter((w) => w.length >= 3 && !stop.has(w));
  const candidates = new Set<string>();
  for (let size = Math.min(MAX_PHRASE_WORDS, words.length); size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const phrase = words.slice(i, i + size).join(" ");
      if (phrase.length >= 3) candidates.add(phrase);
    }
  }
  return [...candidates].slice(0, 12);
}

function readAiMemory(): AiUserMemory {
  if (!canUseLocalStorage()) return { version: 1, rules: [] };
  try {
    const raw = localStorage.getItem(AI_MEMORY_KEY);
    if (!raw) return { version: 1, rules: [] };
    const parsed = JSON.parse(raw) as Partial<AiUserMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.rules)) {
      return { version: 1, rules: [] };
    }
    return {
      version: 1,
      rules: parsed.rules
        .filter(
          (r): r is AiMemoryRule =>
            Boolean(
              r &&
                typeof r.phrase === "string" &&
                typeof r.categoryId === "string" &&
                (r.type === "income" || r.type === "expense"),
            ),
        )
        .slice(0, MAX_RULES),
    };
  } catch {
    return { version: 1, rules: [] };
  }
}

function writeAiMemory(memory: AiUserMemory): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(AI_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    /* localStorage may be full or blocked */
  }
}

function rememberRule(rule: Omit<AiMemoryRule, "lastSeenAt">): void {
  const memory = readAiMemory();
  const phrase = normalizeText(rule.phrase);
  if (phrase.length < 3) return;
  const existing = memory.rules.find(
    (r) => r.phrase === phrase && r.categoryId === rule.categoryId && r.type === rule.type,
  );
  if (existing) {
    existing.weight = Math.min(99, existing.weight + rule.weight);
    existing.source = rule.source === "correction" ? "correction" : existing.source;
    existing.lastSeenAt = nowIso();
  } else {
    memory.rules.push({ ...rule, phrase, lastSeenAt: nowIso() });
  }
  memory.rules.sort((a, b) => b.weight - a.weight || b.lastSeenAt.localeCompare(a.lastSeenAt));
  writeAiMemory({ version: 1, rules: memory.rules.slice(0, MAX_RULES) });
}

export function recordAiInputLearning(
  transcript: string | undefined,
  tx: Pick<ParsedTransaction | Transaction, "categoryId" | "type" | "note">,
  source: "voice" | "text" = "text",
): void {
  const seed = `${transcript ?? ""} ${tx.note ?? ""}`.trim();
  if (!seed || !tx.categoryId) return;
  for (const phrase of phraseCandidates(seed).slice(0, 4)) {
    rememberRule({
      phrase,
      categoryId: tx.categoryId,
      type: tx.type,
      weight: source === "voice" ? 2 : 1,
      source,
    });
  }
}

export function recordAiCorrectionLearning(params: {
  before?: Pick<Transaction, "categoryId" | "type" | "note"> | null;
  after: Pick<Transaction, "categoryId" | "type" | "note">;
}): void {
  const { before, after } = params;
  if (before?.categoryId === after.categoryId && before?.type === after.type) return;
  for (const phrase of phraseCandidates(after.note).slice(0, 6)) {
    rememberRule({
      phrase,
      categoryId: after.categoryId,
      type: after.type,
      weight: 7,
      source: "correction",
    });
  }
}

export function enrichCategoriesWithAiMemory(
  categories: CategoryDefinition[],
): CategoryDefinition[] {
  const memory = readAiMemory();
  if (memory.rules.length === 0) return categories;
  const extraByCategory = new Map<string, Set<string>>();
  for (const rule of memory.rules) {
    if (rule.weight < 2) continue;
    const set = extraByCategory.get(rule.categoryId) ?? new Set<string>();
    set.add(rule.phrase);
    extraByCategory.set(rule.categoryId, set);
  }
  return categories.map((cat) => {
    const extra = extraByCategory.get(cat.id);
    if (!extra?.size) return cat;
    return {
      ...cat,
      keywords: [...new Set([...cat.keywords, ...extra])],
    };
  });
}

export function buildAiMemorySnapshot(
  transactions: Transaction[],
  categories: CategoryDefinition[],
  locale: Locale,
): {
  learnedRules: AiMemoryRule[];
  frequentMerchants: { phrase: string; categoryId: string; count: number }[];
  categoryHabits: { category: string; count: number; avgAmount: number; sharePercent: number }[];
  insights: AiMemoryInsight[];
} {
  const memory = readAiMemory();
  const confirmed = transactions.filter((tx) => tx.confirmed !== false);
  const expense = confirmed.filter((tx) => tx.type === "expense");
  const totalExpense = expense.reduce((s, tx) => s + tx.amount, 0);
  const byCategory = new Map<string, { count: number; amount: number }>();
  for (const tx of expense) {
    const prev = byCategory.get(tx.categoryId) ?? { count: 0, amount: 0 };
    prev.count += 1;
    prev.amount += tx.amount;
    byCategory.set(tx.categoryId, prev);
  }
  const label = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? (locale === "ru" ? cat.labels.ru : cat.labels.en) : id;
  };
  const categoryHabits = [...byCategory.entries()]
    .map(([categoryId, v]) => ({
      category: label(categoryId),
      count: v.count,
      avgAmount: Math.round(v.amount / Math.max(1, v.count)),
      sharePercent: totalExpense > 0 ? Math.round((v.amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.sharePercent - a.sharePercent)
    .slice(0, 6);

  const phraseMap = new Map<string, { categoryId: string; count: number }>();
  for (const tx of confirmed) {
    for (const phrase of phraseCandidates(tx.note).slice(0, 2)) {
      const prev = phraseMap.get(phrase) ?? { categoryId: tx.categoryId, count: 0 };
      prev.count += 1;
      phraseMap.set(phrase, prev);
    }
  }
  const frequentMerchants = [...phraseMap.entries()]
    .map(([phrase, v]) => ({ phrase, categoryId: v.categoryId, count: v.count }))
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const insights: AiMemoryInsight[] = [];
  const top = categoryHabits[0];
  if (top) {
    insights.push({
      title: locale === "ru" ? "Главная привычка периода" : "Main habit this period",
      detail:
        locale === "ru"
          ? `${top.category}: ${top.sharePercent}% расходов, средний чек ${top.avgAmount} ₽.`
          : `${top.category}: ${top.sharePercent}% of expenses, avg ${top.avgAmount} RUB.`,
      severity: top.sharePercent >= 35 ? "warning" : "neutral",
    });
  }
  if (memory.rules.some((r) => r.source === "correction")) {
    insights.push({
      title: locale === "ru" ? "ИИ учится на исправлениях" : "AI learns from corrections",
      detail:
        locale === "ru"
          ? "Исправленные категории уже добавлены в персональные правила распознавания."
          : "Corrected categories are now used as personal recognition rules.",
      severity: "positive",
    });
  }

  return {
    learnedRules: memory.rules.slice(0, 20),
    frequentMerchants,
    categoryHabits,
    insights,
  };
}
