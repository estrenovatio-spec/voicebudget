import { mergeBusinessPayload } from "@/lib/business/db";
import type { BusinessCloudPayload } from "@/lib/business/types";
import { apiPullBusiness, apiPushBusiness } from "@/lib/cloud/client";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useCloudStore } from "@/store/useCloudStore";

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export async function pullBusinessFromCloud(): Promise<boolean> {
  const token = useCloudStore.getState().token;
  if (!token) return false;
  try {
    const res = await apiPullBusiness(token);
    if (!res.ok || !res.business) return false;
    const local = useBusinessStore.getState().exportPayload();
    const merged = mergeBusinessPayload(local, res.business);
    useBusinessStore.getState().importPayload(merged);
    useBusinessStore.getState().markCloudSynced();
    return true;
  } catch {
    return false;
  }
}

export function scheduleBusinessCloudPush(delayMs = 1200): void {
  const token = useCloudStore.getState().token;
  if (!token) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushBusinessToCloud();
  }, delayMs);
}

export async function pushBusinessToCloud(): Promise<boolean> {
  const token = useCloudStore.getState().token;
  if (!token) return false;
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
