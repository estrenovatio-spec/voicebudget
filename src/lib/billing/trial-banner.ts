export const OPEN_SETTINGS_EVENT = "voicebudget:open-settings";

export function requestOpenSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

const DISMISS_KEY = "voicebudget-trial-banner-dismissed";

/** Hide banner until access period changes (new expiresAt). */
export function isTrialBannerDismissed(expiresAt: string | null): boolean {
  if (!expiresAt || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === expiresAt;
  } catch {
    return false;
  }
}

export function dismissTrialBanner(expiresAt: string | null): void {
  if (!expiresAt) return;
  try {
    localStorage.setItem(DISMISS_KEY, expiresAt);
  } catch {
    /* ignore */
  }
}
