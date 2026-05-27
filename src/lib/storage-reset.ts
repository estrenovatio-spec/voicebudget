const STORE_KEY = "voicebudget-store";
const RECOMMENDATIONS_KEY = "voicebudget-recommendations";
const RECOMMENDATIONS_TS_KEY = "voicebudget-recommendations-ts";
export const PLANNING_TIPS_HIDDEN_KEY = "voicebudget-planning-tips-hidden";

export function clearAppStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(RECOMMENDATIONS_KEY);
    localStorage.removeItem(RECOMMENDATIONS_TS_KEY);
    localStorage.removeItem(PLANNING_TIPS_HIDDEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Полный сброс данных и перезагрузка страницы */
export function hardReloadApp(): void {
  clearAppStorage();
  if (typeof window === "undefined") return;
  window.location.replace(window.location.pathname + window.location.search);
}
