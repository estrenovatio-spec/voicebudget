const RECOMMENDATIONS_KEY = "voicebudget-recommendations";
const RECOMMENDATIONS_TS_KEY = "voicebudget-recommendations-ts";
export const RECOMMENDATIONS_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedRecommendations {
  items: string[];
  generatedAt: number;
}

export function getCachedRecommendations(): CachedRecommendations | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RECOMMENDATIONS_KEY);
    const ts = localStorage.getItem(RECOMMENDATIONS_TS_KEY);
    if (!raw || !ts) return null;
    const generatedAt = Number(ts);
    if (Date.now() - generatedAt > RECOMMENDATIONS_TTL_MS) return null;
    return { items: JSON.parse(raw) as string[], generatedAt };
  } catch {
    return null;
  }
}

export function setCachedRecommendations(items: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECOMMENDATIONS_KEY, JSON.stringify(items));
  localStorage.setItem(RECOMMENDATIONS_TS_KEY, String(Date.now()));
}

export function clearCachedRecommendations(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RECOMMENDATIONS_KEY);
  localStorage.removeItem(RECOMMENDATIONS_TS_KEY);
}

// TODO: migrate to Supabase/PostgreSQL
