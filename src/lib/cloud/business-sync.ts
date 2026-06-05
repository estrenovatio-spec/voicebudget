import { mergeBusinessPayload } from "@/lib/business/db";
import type { BusinessCloudPayload } from "@/lib/business/types";
import { apiPullBusiness, apiPushBusiness } from "@/lib/cloud/client";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useCloudStore } from "@/store/useCloudStore";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** Не пушить в облако до первого pull — иначе пустое состояние затирает проекты на сервере. */
let businessCloudReady = false;

export function isBusinessCloudReady(): boolean {
  return businessCloudReady;
}

export async function pullBusinessFromCloud(): Promise<boolean> {
  const token = useCloudStore.getState().token;
  if (!token) return false;
  businessCloudReady = false;
  try {
    const res = await apiPullBusiness(token);
    if (!res.ok || !res.business) return false;
    const local = useBusinessStore.getState().exportPayload();
    const remote = res.business;
    const merged = mergeBusinessPayload(local, remote);
    const assetIds = new Set<string>();
    const mergedAssets: typeof merged.assets = [];
    for (const a of [...merged.assets, ...local.assets]) {
      if (!a?.id || assetIds.has(a.id)) continue;
      assetIds.add(a.id);
      mergedAssets.push(a);
    }
    merged.assets = mergedAssets;
    useBusinessStore.getState().importPayload(merged);
    useBusinessStore.getState().markCloudSynced();
    return true;
  } catch {
    return false;
  } finally {
    businessCloudReady = true;
  }
}

export function scheduleBusinessCloudPush(delayMs = 1200): void {
  const token = useCloudStore.getState().token;
  if (!token) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!businessCloudReady || !useBusinessStore.persist.hasHydrated()) return;
    void pushBusinessToCloud();
  }, delayMs);
}

export async function pushBusinessToCloud(): Promise<boolean> {
  const token = useCloudStore.getState().token;
  if (!token || !businessCloudReady || !useBusinessStore.persist.hasHydrated()) return false;
  try {
    const business: BusinessCloudPayload = useBusinessStore.getState().exportPayload();
    const res = await apiPushBusiness(token, business);
    if (!res.ok) return false;
    useBusinessStore.getState().markCloudSynced();
    return true;
  } catch {
    return false;
  }
}
