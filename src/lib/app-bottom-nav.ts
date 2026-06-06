export type AppTabId = "family" | "business" | "more";

const TAB_STORAGE_KEY = "vb_app_tab_v1";

/** Семья + Бизнес + Ещё. Отключить: NEXT_PUBLIC_APP_BOTTOM_NAV=false на Vercel. */
export function bottomNavEnabled(): boolean {
  return process.env.NEXT_PUBLIC_APP_BOTTOM_NAV !== "false";
}

export function readStoredAppTab(): AppTabId {
  if (typeof window === "undefined") return "family";
  const requested = readRequestedAppTab();
  if (requested) return requested;
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw === "family" || raw === "business" || raw === "more") {
      return raw;
    }
    if (raw === "learn") return "more";
  } catch {
    /* ignore */
  }
  return "family";
}

export function readRequestedAppTab(): AppTabId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("tab");
    if (raw === "family" || raw === "business" || raw === "more") return raw;
    if (raw === "learn") return "more";
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredAppTab(tab: AppTabId): void {
  try {
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore */
  }
}
