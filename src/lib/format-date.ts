import type { Locale } from "@/types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** YYYY-MM-DD → DD-MM-YYYY for display */
export function formatIsoDate(dateStr: string, _locale?: Locale): string {
  const raw = dateStr.trim();
  const m = ISO_DATE.exec(raw);
  if (!m) return raw;
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y}`;
}

export function formatIsoPeriod(from: string, to: string, locale?: Locale): string {
  return `${formatIsoDate(from, locale)} — ${formatIsoDate(to, locale)}`;
}

/** ISO date (YYYY-MM-DD) or full ISO → DD-MM-YYYY */
export function formatTransactionDate(dateStr: string, locale: Locale): string {
  const raw = dateStr.trim();
  if (!raw) return "";
  if (ISO_DATE.test(raw)) return formatIsoDate(raw, locale);
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}-${mo}-${y}`;
}
