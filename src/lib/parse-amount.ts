import { roundMoneyUp } from "@/lib/format-money";
import type { Locale } from "@/types";

function normalizeNumberToken(raw: string): number {
  let s = raw.trim().replace(/\s/g, "");

  if (!s) return NaN;

  // 1.000.000 or 100.000 (тысячные разделители точкой)
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return Number(s.replace(/\./g, ""));
  }
  // 1,000,000 or 100,000
  if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    return Number(s.replace(/,/g, ""));
  }

  // десятичная дробь: 100,50 или 99.9 (не 100.000)
  if (/,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(",", "."));
  }
  if (/\.\d{1,2}$/.test(s) && !/\.\d{3}$/.test(s)) {
    return parseFloat(s);
  }

  // 100.000 — одна группа из 3 цифр после точки
  if (/^\d+\.\d{3}$/.test(s)) {
    return Number(s.replace(".", ""));
  }

  return parseFloat(s.replace(",", "."));
}

function applyMultiplier(base: number, multiplier: number): number {
  if (!Number.isFinite(base)) return 0;
  return roundMoneyUp(base * multiplier);
}

/**
 * Извлекает сумму из русской/английской речи и текста.
 * «100 тысяч» → 100000, «100.000» → 100000, «1,5 млн» → 1500000
 */
export function parseAmountFromTranscript(transcript: string, _locale: Locale): number {
  const text = transcript.toLowerCase().replace(/−/g, "-");

  // (?=...) вместо \b: в JS \b не работает после кириллицы («млн», «тысяч»)
  const afterWord = String.raw`(?=\s|$|[^а-яёa-z0-9])`;
  const patterns: { re: RegExp; mult: number }[] = [
    {
      re: new RegExp(String.raw`(\d[\d\s.,]*)\s*(?:млн|миллион[а-яё]*|million|mln)${afterWord}`, "i"),
      mult: 1_000_000,
    },
    {
      re: new RegExp(
        String.raw`(\d[\d\s.,]*)\s*(?:тысяч[а-яё]*|тысячи|тыс\.?|тыщ|thousand)${afterWord}`,
        "i",
      ),
      mult: 1_000,
    },
    { re: /(\d[\d\s.,]*)\s*k(?=\s|$|[^a-z0-9])/i, mult: 1_000 },
  ];

  for (const { re, mult } of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const base = normalizeNumberToken(m[1]);
      if (Number.isFinite(base) && base > 0) {
        return roundMoneyUp(applyMultiplier(base, mult));
      }
    }
  }

  // «сто тысяч» без цифр — пропускаем в MVP

  const numbers = [...text.matchAll(/\d[\d\s.,]*/g)]
    .map((m) => normalizeNumberToken(m[0]))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (numbers.length === 0) return 0;

  return roundMoneyUp(Math.max(...numbers));
}

/** Все суммы из фразы (для «зарплата 10000, 2000 на отпуск»). */
export function extractAllAmountsFromTranscript(transcript: string, locale: Locale): number[] {
  const text = transcript.toLowerCase().replace(/−/g, "-");
  const afterWord = String.raw`(?=\s|$|[^а-яёa-z0-9])`;
  const found: number[] = [];

  const patterns: { re: RegExp; mult: number }[] = [
    {
      re: new RegExp(String.raw`(\d[\d\s.,]*)\s*(?:млн|миллион[а-яё]*|million|mln)${afterWord}`, "gi"),
      mult: 1_000_000,
    },
    {
      re: new RegExp(
        String.raw`(\d[\d\s.,]*)\s*(?:тысяч[а-яё]*|тысячи|тыс\.?|тыщ|thousand)${afterWord}`,
        "gi",
      ),
      mult: 1_000,
    },
    { re: /(\d[\d\s.,]*)\s*k(?=\s|$|[^a-z0-9])/gi, mult: 1_000 },
  ];

  for (const { re, mult } of patterns) {
    for (const m of text.matchAll(re)) {
      if (!m[1]) continue;
      const base = normalizeNumberToken(m[1]);
      if (Number.isFinite(base) && base > 0) {
        found.push(roundMoneyUp(applyMultiplier(base, mult)));
      }
    }
  }

  const plain = [...text.matchAll(/\d[\d\s.,]*/g)]
    .map((m) => normalizeNumberToken(m[0]))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => roundMoneyUp(n));

  const unique = [...new Set([...found, ...plain])].sort((a, b) => b - a);
  return unique;
}

/** Если AI вернул 100, а в фразе «100 тысяч» — берём из фразы */
export function resolveTransactionAmount(
  transcript: string,
  aiAmount: number,
  locale: Locale,
): number {
  const fromSpeech = parseAmountFromTranscript(transcript, locale);
  if (fromSpeech <= 0) return aiAmount > 0 ? roundMoneyUp(aiAmount) : 0;
  if (aiAmount <= 0) return fromSpeech;

  const lower = transcript.toLowerCase();
  const hasMultiplier = /тысяч|тыс\.?|тыщ|млн|миллион|thousand|million|\bk\b/i.test(
    lower,
  );
  const hasThousandSep = /\d{1,3}[.,]\d{3}\b/.test(transcript);

  if (hasMultiplier || hasThousandSep) {
    if (fromSpeech > aiAmount) return fromSpeech;
  }

  // AI часто возвращает 1.5 вместо 1_500_000 для «1,5 млн»
  if (fromSpeech >= 10_000 && aiAmount > 0 && aiAmount < fromSpeech / 100) {
    return fromSpeech;
  }

  if (Math.abs(fromSpeech - aiAmount) / Math.max(aiAmount, 1) < 0.01) {
    return aiAmount;
  }

  return roundMoneyUp(fromSpeech >= aiAmount ? fromSpeech : aiAmount);
}
