import type { BudgetOwner, Locale } from "@/types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Варианты имени для поиска в речи (Ксюша → ксюша, ксюш, ксюше…). */
function partnerNameNeedles(partnerName: string): string[] {
  const raw = partnerName.trim().toLowerCase();
  if (!raw) return [];
  const first = raw.split(/\s+/)[0] ?? raw;
  const needles = new Set<string>([raw, first]);
  if (first.length >= 3) {
    needles.add(first.slice(0, -1));
    needles.add(first.slice(0, Math.max(3, first.length - 2)));
    if (first.length >= 4) needles.add(first.slice(0, 4));
  }
  return [...needles].filter((n) => n.length >= 3);
}

function mentionsPartner(text: string, partnerName: string): boolean {
  const lower = text.toLowerCase();
  for (const needle of partnerNameNeedles(partnerName)) {
    if (lower.includes(needle)) return true;
    const re = new RegExp(
      `(?:^|[\\s,.;:!?()—–-])${escapeRegExp(needle)}[a-zа-яё]{0,4}(?:[\\s,.;:!?()—–-]|$)`,
      "i",
    );
    if (re.test(` ${lower} `)) return true;
  }
  return false;
}

const ME_MARKERS_RU =
  /\b(?:^|\s)(?:мне|мной|мой|моя|моё|мои|моему|моей|моим|я)\b/i;
const ME_MARKERS_EN = /\b(?:^|\s)(?:my|mine|me|i)\b/i;

/**
 * Если в фразе есть имя партнёра («ксюше возврат») — owner=partner.
 * Если явно «мне/мой» без партнёра — owner=me.
 */
export function detectOwnerFromTranscript(
  transcript: string,
  partnerName: string | null | undefined,
  locale: Locale = "ru",
): BudgetOwner | null {
  const text = transcript.trim();
  if (!text || !partnerName?.trim()) return null;

  if (mentionsPartner(text, partnerName)) return "partner";

  const meRe = locale === "ru" ? ME_MARKERS_RU : ME_MARKERS_EN;
  if (meRe.test(text)) return "me";

  return null;
}

export function applyDetectedOwner<T extends { owner?: BudgetOwner }>(
  data: T,
  transcript: string,
  partnerName: string | null | undefined,
  fallbackOwner: BudgetOwner,
  locale: Locale = "ru",
): T & { owner: BudgetOwner } {
  if (data.owner) return { ...data, owner: data.owner };
  const detected = detectOwnerFromTranscript(transcript, partnerName, locale);
  return { ...data, owner: detected ?? fallbackOwner };
}
