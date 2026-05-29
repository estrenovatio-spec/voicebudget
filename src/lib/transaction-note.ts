import { isGarbageTranscript } from "@/lib/transcript-guard";

/** Note is only for extra context — not a duplicate of the amount on the right */
export function isAmountOnlyNote(note: string, amount: number): boolean {
  const n = note.trim();
  if (!n) return true;

  const amt = Math.round(amount * 100) / 100;
  const asInt = Math.round(amt);
  if (n === String(amt) || n === String(asInt)) return true;

  const digits = n.replace(/[^\d.,]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(digits);
  if (Number.isFinite(parsed) && Math.abs(parsed - amt) < 0.01) {
    const letters = n.replace(/[\d\s.,₽рубrub]/gi, "").trim();
    if (letters.length < 4) return true;
  }

  return false;
}

export function sanitizeTransactionNote(note: string, amount: number): string {
  const n = note.trim();
  if (!n || isGarbageTranscript(n) || isAmountOnlyNote(n, amount)) return "";
  return n.slice(0, 120);
}

export function displayTransactionNote(note: string, amount: number): string | null {
  const clean = sanitizeTransactionNote(note, amount);
  return clean || null;
}
