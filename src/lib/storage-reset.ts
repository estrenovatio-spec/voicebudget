const STORE_KEY = "voicebudget-store";
const CLOUD_KEY = "voicebudget-cloud";
const WEB_LOGIN_KEY = "voicebudget-tg-web-login";
const CLOUD_PAUSE_KEY = "voicebudget-cloud-paused";
const RECOMMENDATIONS_KEY = "voicebudget-recommendations";
const RECOMMENDATIONS_TS_KEY = "voicebudget-recommendations-ts";
const WEEKLY_KEY = "voicebudget-weekly-analysis-v2";
const WEEKLY_TS_KEY = "voicebudget-weekly-analysis-ts-v2";
const MONTHLY_KEY = "voicebudget-monthly-analysis-v1";
const MONTHLY_TS_KEY = "voicebudget-monthly-analysis-ts-v1";
const MONTHLY_CHAT_KEY = "voicebudget-monthly-chat-v1";
export const TIPS_TAB_ORDER_KEY = "voicebudget-tips-tab-order";
export const TRANSACTIONS_HIDDEN_KEY = "voicebudget-transactions-hidden";
export const TIPS_PANEL_HIDDEN_KEY = "voicebudget-tips-panel-hidden";
export const PLANNING_TIPS_HIDDEN_KEY = "voicebudget-planning-tips-hidden";
export const AI_RECOMMENDATIONS_HIDDEN_KEY = "voicebudget-ai-recommendations-hidden";
export const WEEKLY_ANALYSIS_HIDDEN_KEY = "voicebudget-weekly-analysis-hidden";
export const MONTHLY_ANALYSIS_HIDDEN_KEY = "voicebudget-monthly-analysis-hidden";
export const SUMMARY_INCOME_HIDDEN_KEY = "voicebudget-summary-income-hidden";
export const SUMMARY_EXPENSE_HIDDEN_KEY = "voicebudget-summary-expense-hidden";
export const CHART_HIDDEN_KEY = "voicebudget-chart-hidden";

export function clearAppStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(RECOMMENDATIONS_KEY);
    localStorage.removeItem(RECOMMENDATIONS_TS_KEY);
    localStorage.removeItem(WEEKLY_KEY);
    localStorage.removeItem(WEEKLY_TS_KEY);
    localStorage.removeItem(MONTHLY_KEY);
    localStorage.removeItem(MONTHLY_TS_KEY);
    localStorage.removeItem(MONTHLY_CHAT_KEY);
    localStorage.removeItem(TIPS_TAB_ORDER_KEY);
    localStorage.removeItem(TRANSACTIONS_HIDDEN_KEY);
    localStorage.removeItem(TIPS_PANEL_HIDDEN_KEY);
    localStorage.removeItem(PLANNING_TIPS_HIDDEN_KEY);
    localStorage.removeItem(AI_RECOMMENDATIONS_HIDDEN_KEY);
    localStorage.removeItem(WEEKLY_ANALYSIS_HIDDEN_KEY);
    localStorage.removeItem(MONTHLY_ANALYSIS_HIDDEN_KEY);
    localStorage.removeItem(SUMMARY_INCOME_HIDDEN_KEY);
    localStorage.removeItem(SUMMARY_EXPENSE_HIDDEN_KEY);
    localStorage.removeItem(CHART_HIDDEN_KEY);
    localStorage.removeItem(CLOUD_KEY);
    sessionStorage.removeItem(WEB_LOGIN_KEY);
    sessionStorage.removeItem(CLOUD_PAUSE_KEY);
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
