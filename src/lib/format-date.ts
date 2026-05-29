import type { Locale } from "@/types";

/** ISO date (YYYY-MM-DD) or full ISO → localized short date */
export function formatTransactionDate(dateStr: string, locale: Locale): string {
  const raw = dateStr.trim();
  if (!raw) return "";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
