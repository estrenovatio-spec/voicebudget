import type { BudgetOwner, Locale } from "@/types";

export type OwnerDetectOptions = {
  partnerName?: string | null;
  /** «Моё имя» из настроек — для фраз «Алексей потратил» */
  myName?: string | null;
  locale?: Locale;
  /** Есть строка партнёра в балансе — включить синонимы (любимая, жена…) */
  hasPartner?: boolean;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Варианты имени для поиска в речи (Ксюша → ксюша, ксюш; Любимка → любимк…). */
function nameNeedles(name: string): string[] {
  const raw = name.trim().toLowerCase();
  if (!raw) return [];
  const first = raw.split(/\s+/)[0] ?? raw;
  const needles = new Set<string>([raw, first]);
  if (first.length >= 3) {
    needles.add(first.slice(0, -1));
    needles.add(first.slice(0, Math.max(3, first.length - 2)));
    if (first.length >= 4) needles.add(first.slice(0, 4));
    if (first.length >= 5) needles.add(first.slice(0, 5));
  }
  return [...needles].filter((n) => n.length >= 3);
}

function mentionsByNeedles(text: string, needles: string[]): boolean {
  if (!needles.length) return false;
  const lower = text.toLowerCase();
  const padded = ` ${lower} `;
  for (const needle of needles) {
    if (lower.includes(needle)) {
      const re = new RegExp(
        `(?:^|[\\s,.;:!?()—–-])${escapeRegExp(needle)}[a-zа-яё]{0,5}(?:[\\s,.;:!?()—–-]|$)`,
        "i",
      );
      if (re.test(padded)) return true;
    }
  }
  return false;
}

/** Ласкательные и роли — партнёр (не имя из настроек). */
const PARTNER_WORDS_RU = [
  "любимая",
  "любимой",
  "любимую",
  "любимые",
  "любимый",
  "любимому",
  "дорогая",
  "дорогой",
  "дорогую",
  "дорогие",
  "жена",
  "жене",
  "женой",
  "жену",
  "муж",
  "мужу",
  "мужем",
  "мужа",
  "супруга",
  "супруге",
  "супругой",
  "супругу",
  "супруг",
  "супругу",
  "партнёр",
  "партнер",
  "партнёру",
  "партнеру",
  "партнёра",
  "партнера",
  "зайка",
  "зайке",
  "зайку",
  "котик",
  "котику",
  "солнышко",
  "солнышку",
];

const PARTNER_WORDS_EN = [
  "wife",
  "husband",
  "spouse",
  "partner",
  "darling",
  "sweetheart",
  "honey",
  "beloved",
  "dear",
  "hubby",
  "wifey",
];

const ME_WORDS_RU = [
  "мне",
  "мной",
  "меня",
  "мой",
  "моя",
  "моё",
  "мои",
  "моему",
  "моей",
  "моим",
  "моих",
  "моего",
  "моей",
  "я",
  "для меня",
  "у меня",
  "сам",
  "сама",
  "само",
  "сами",
];

const ME_WORDS_EN = ["my", "mine", "me", "i", "myself", "for me"];

function partnerSynonymNeedles(locale: Locale): string[] {
  const words = locale === "ru" ? PARTNER_WORDS_RU : PARTNER_WORDS_EN;
  return words.filter((w) => w.length >= 3);
}

function meSynonymNeedles(locale: Locale): string[] {
  const words = locale === "ru" ? ME_WORDS_RU : ME_WORDS_EN;
  return words.filter((w) => w.length >= 2);
}

function mentionsPartnerSynonyms(text: string, locale: Locale): boolean {
  return mentionsByNeedles(text, partnerSynonymNeedles(locale));
}

function mentionsMeSynonyms(text: string, locale: Locale): boolean {
  return mentionsByNeedles(text, meSynonymNeedles(locale));
}

/** Подсказка для LLM — те же слова, что и в detect-owner */
export function ownerHintsForPrompt(
  locale: Locale,
  partnerName?: string | null,
  myName?: string | null,
): string {
  const partner = partnerName?.trim();
  const me = myName?.trim();
  const synRu =
    "любимая, дорогая, жена, муж, партнёр, зайка, солнышко";
  const synEn = "wife, husband, partner, darling, honey, sweetheart";
  const syn = locale === "ru" ? synRu : synEn;
  const lines: string[] = [];
  if (partner) {
    lines.push(
      locale === "ru"
        ? `- Имя партнёра в настройках: «${partner}» (и склонения) → owner "partner".`
        : `- Partner display name: «${partner}» → owner "partner".`,
    );
  }
  lines.push(
    locale === "ru"
      ? `- Также партнёр: ${syn} (например «любимая потратила», «дорогой купил»).`
      : `- Also partner: ${syn}.`,
  );
  if (me) {
    lines.push(
      locale === "ru"
        ? `- Имя «я» в настройках: «${me}» → owner "me".`
        : `- My display name «${me}» → owner "me".`,
    );
  }
  lines.push(
    locale === "ru"
      ? `- «мне», «мой», «я», «для меня» → owner "me".`
      : `- "my", "me", "I" → owner "me".`,
  );
  return lines.join("\n");
}

/**
 * Кто совершил операцию: сначала партнёр (имя + синонимы), потом «я».
 */
export function detectOwnerFromTranscript(
  transcript: string,
  opts: OwnerDetectOptions | string | null | undefined,
  legacyLocale?: Locale,
): BudgetOwner | null {
  const options: OwnerDetectOptions =
    typeof opts === "string" || opts === null || opts === undefined
      ? { partnerName: opts, locale: legacyLocale ?? "ru" }
      : opts;

  const text = transcript.trim();
  if (!text) return null;

  const locale = options.locale ?? "ru";
  const hasPartner = options.hasPartner ?? Boolean(options.partnerName?.trim());

  const partnerCustom = options.partnerName?.trim();
  if (partnerCustom && mentionsByNeedles(text, nameNeedles(partnerCustom))) {
    return "partner";
  }

  if (hasPartner && mentionsPartnerSynonyms(text, locale)) {
    return "partner";
  }

  const myCustom = options.myName?.trim();
  if (myCustom && mentionsByNeedles(text, nameNeedles(myCustom))) {
    return "me";
  }

  if (mentionsMeSynonyms(text, locale)) {
    return "me";
  }

  return null;
}

export function normalizeOwnerDetectOptions(
  ctx: OwnerDetectOptions | string | null | undefined,
  locale: Locale,
): OwnerDetectOptions {
  if (typeof ctx === "string") {
    return { partnerName: ctx, locale };
  }
  if (!ctx) return { locale };
  return { ...ctx, locale: ctx.locale ?? locale };
}

export function applyDetectedOwner<T extends { owner?: BudgetOwner }>(
  data: T,
  transcript: string,
  opts: OwnerDetectOptions | string | null | undefined,
  fallbackOwner: BudgetOwner,
  legacyLocale?: Locale,
): T & { owner: BudgetOwner } {
  if (data.owner === "me" || data.owner === "partner") {
    return { ...data, owner: data.owner };
  }
  const detectOpts: OwnerDetectOptions =
    typeof opts === "string" || opts === null || opts === undefined
      ? { partnerName: opts, locale: legacyLocale ?? "ru" }
      : opts;
  const detected = detectOwnerFromTranscript(transcript, detectOpts);
  return { ...data, owner: detected ?? fallbackOwner };
}
