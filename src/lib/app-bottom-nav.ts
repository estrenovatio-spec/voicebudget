export type AppTabId = "family" | "business" | "more";

const TAB_STORAGE_KEY = "vb_app_tab_v1";

/** Preview-only: auto on Vercel preview builds, or NEXT_PUBLIC_APP_BOTTOM_NAV=true. */
export function bottomNavEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_APP_BOTTOM_NAV === "true") return true;
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
}

export function readStoredAppTab(): AppTabId {
  if (typeof window === "undefined") return "family";
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

export function writeStoredAppTab(tab: AppTabId): void {
  try {
    sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore */
  }
}
