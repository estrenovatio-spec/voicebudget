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

/** Ласкательные и роли — партнёр как субъект (именительный / явный агент). */
const PARTNER_ROLE_SUBJECT_RU = [
  "любимая",
  "любимый",
  "любимые",
  "дорогая",
  "дорогой",
  "дорогие",
  "жена",
  "муж",
  "супруга",
  "супруг",
  "партнёр",
  "партнер",
  "зайка",
  "котик",
  "солнышко",
  "милая",
  "милый",
  "милашка",
  "лапочка",
  "лапуля",
  "зайчик",
];

/** Падеж «кому» — получатель подарка, не тот кто тратил */
const PARTNER_DATIVE_RU = [
  "жене",
  "мужу",
  "любимой",
  "любимому",
  "дорогой",
  "дорогому",
  "партнёру",
  "партнеру",
  "зайке",
  "котику",
  "солнышку",
  "милой",
  "милому",
  "милашке",
  "лапочке",
  "зайчику",
  "супруге",
  "супругу",
];

const GIFT_VERBS_RU = [
  "купил",
  "купила",
  "подарил",
  "подарила",
  "дал",
  "дала",
  "взял",
  "взяла",
  "заказал",
  "заказала",
  "перевёл",
  "перевел",
  "перевела",
  "отправил",
  "отправила",
  "заплатил",
  "заплатила",
];

/** «жена потратила», «потратила жена», «милая купила» */
const PARTNER_AGENT_RE_RU =
  /(?:^|[\s,.;:!?()—–-])(?:жена|муж|любим(?:ая|ый|ой|ому)|мила(?:я|ый|ому)|дорог(?:ая|ой|ому)|партн(?:ёр|ер)(?:ка)?|зайка|солнышко|милашка|лапочка|зайчик|супруг(?:а)?)\s+(?:потратил|потратила|купил|купила|заплатил|заплатила|оплатил|оплатила|получил|получила|отдал|отдала|заказал|заказала)(?:[\s,.;:!?()—–-]|$)|(?:^|[\s,.;:!?()—–-])(?:потратил|потратила|купил|купила|заплатил|заплатила|оплатил|оплатила|получил|получила|отдал|отдала|заказал|заказала)\s+(?:[\p{L}\s]{0,16}\s+)?(?:жена|муж|любим(?:ая|ый)|мила(?:я|ый)|дорог(?:ая|ой)|партн(?:ёр|ер)|зайка|солнышко|милашка|супруг(?:а)?)(?:[\s,.;:!?()—–-]|$)/iu;

/** @deprecated — полный список для подсказок LLM; для detect используйте role-subject + agent/beneficiary */
const PARTNER_WORDS_RU = [
  ...PARTNER_ROLE_SUBJECT_RU,
  "любимой",
  "любимому",
  "любимую",
  "дорогой",
  "дорогому",
  "дорогую",
  "жене",
  "женой",
  "жену",
  "мужу",
  "мужем",
  "мужа",
  "супруге",
  "супругой",
  "супругу",
  "партнёру",
  "партнеру",
  "партнёра",
  "партнера",
  "зайке",
  "зайку",
  "котику",
  "солнышку",
  "милой",
  "милому",
  "милую",
  "милашке",
  "милашку",
  "лапочке",
  "лапуля",
  "зайчику",
];

/** «милая моя», «моя милая» — обращение к партнёру, не «моя операция». */
const PARTNER_AFFECTIONATE_WITH_MOYA_RE = new RegExp(
  [
    String.raw`\b(?:милая|милый|милой|милому|милашка|милашке|лапочка|лапуля|зайчик|зайка|любимая|любимый|любимой|дорогая|дорогой|дорогому|солнышко)\s+моя\b`,
    String.raw`\bмоя\s+(?:милая|милый|милой|милашка|лапочка|лапуля|зайчик|зайка|любимая|любимый|любимой|дорогая|дорогой|солнышко)\b`,
  ].join("|"),
  "iu",
);

const PARTNER_BENEFICIARY_RE_EN =
  /\b(?:bought|buy|bought|got|gave|gifted|ordered|paid\s+for|for)\s+(?:[\w\s]{0,35}\s+)?(?:wife|husband|spouse|partner|darling|sweetheart|honey|beloved|dear|hubby|wifey)\b/i;

const PARTNER_AGENT_RE_EN =
  /\b(?:wife|husband|spouse|partner|darling|sweetheart|honey|beloved|dear)\s+(?:spent|bought|paid|ordered|received)\b|\b(?:spent|bought|paid|ordered|received)\s+(?:[\w\s]{0,16}\s+)?(?:wife|husband|spouse|partner|darling|sweetheart|honey|beloved|dear)\b/i;

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

function isPartnerBeneficiaryPhraseRu(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bдля\s+(?:жены|мужа|любимой|любимого|партн(?:ё|е)ра|супруги|супруга)\b/i.test(lower)) {
    return true;
  }
  const verbHit = GIFT_VERBS_RU.some((verb) => lower.includes(verb));
  if (!verbHit) return false;
  return PARTNER_DATIVE_RU.some((word) => {
    const idx = lower.indexOf(word);
    if (idx < 0) return false;
    const before = lower.slice(0, idx);
    return GIFT_VERBS_RU.some((verb) => before.includes(verb));
  });
}

function stripPartnerBeneficiaryRu(text: string): string {
  let result = text;
  for (const verb of GIFT_VERBS_RU) {
    for (const word of PARTNER_DATIVE_RU) {
      result = result.replace(
        new RegExp(`${escapeRegExp(verb)}\\s+(?:[\\p{L}\\d\\s]{0,40}\\s+)?${escapeRegExp(word)}`, "giu"),
        " ",
      );
    }
  }
  return result.replace(
    /\bдля\s+(?:жены|мужа|любимой|любимого|партн(?:ё|е)ра|супруги|супруга)\b/giu,
    " ",
  );
}

function isPartnerBeneficiaryPhrase(text: string, locale: Locale): boolean {
  if (locale === "ru") return isPartnerBeneficiaryPhraseRu(text);
  return PARTNER_BENEFICIARY_RE_EN.test(text);
}

function stripPartnerBeneficiary(text: string, locale: Locale): string {
  if (locale === "ru") {
    return isPartnerBeneficiaryPhraseRu(text) ? stripPartnerBeneficiaryRu(text) : text;
  }
  return PARTNER_BENEFICIARY_RE_EN.test(text)
    ? text.replace(PARTNER_BENEFICIARY_RE_EN, " ")
    : text;
}

function mentionsPartnerAsAgent(text: string, locale: Locale): boolean {
  if (locale === "ru") return PARTNER_AGENT_RE_RU.test(text);
  return PARTNER_AGENT_RE_EN.test(text);
}

function textForPartnerRoleDetection(text: string, locale: Locale): string {
  return stripPartnerBeneficiary(text, locale);
}

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
  const words =
    locale === "ru"
      ? PARTNER_ROLE_SUBJECT_RU
      : PARTNER_WORDS_EN;
  return words.filter((w) => w.length >= 3);
}

function meSynonymNeedles(locale: Locale): string[] {
  const words = locale === "ru" ? ME_WORDS_RU : ME_WORDS_EN;
  return words.filter((w) => w.length >= 2);
}

function mentionsPartnerAffectionateCompoundRu(text: string): boolean {
  return PARTNER_AFFECTIONATE_WITH_MOYA_RE.test(text);
}

function mentionsPartnerSynonyms(text: string, locale: Locale): boolean {
  if (locale === "ru" && mentionsPartnerAffectionateCompoundRu(text)) return true;
  if (mentionsPartnerAsAgent(text, locale)) return true;
  return mentionsByNeedles(text, partnerSynonymNeedles(locale));
}

const ME_POSSESSIVE_RU = new Set([
  "мой",
  "моя",
  "моё",
  "мои",
  "моей",
  "моему",
  "моим",
  "моих",
  "моего",
]);

function mentionsMeSynonyms(text: string, locale: Locale): boolean {
  let needles = meSynonymNeedles(locale);
  if (locale === "ru" && mentionsPartnerAffectionateCompoundRu(text)) {
    needles = needles.filter((w) => !ME_POSSESSIVE_RU.has(w));
  }
  return mentionsByNeedles(text, needles);
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
    "любимая, милая, дорогая, жена, муж, партнёр, зайка, солнышко; «милая моя» / «моя милая» — партнёр";
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
      ? `- Также партнёр: ${syn} (например «милая моя потратила», «любимая потратила»).`
      : `- Also partner: ${syn}.`,
  );
  lines.push(
    locale === "ru"
      ? `- «купил цветы жене», «подарил мужу» — owner "me" (покупка ДЛЯ партнёра, не его трата).`
      : `- "bought flowers for wife" → owner "me" (gift for partner, not partner's expense).`,
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
  const scoped = textForPartnerRoleDetection(text, locale);

  const partnerCustom = options.partnerName?.trim();
  if (partnerCustom && mentionsByNeedles(scoped, nameNeedles(partnerCustom))) {
    return "partner";
  }

  if (hasPartner && mentionsPartnerSynonyms(scoped, locale)) {
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
