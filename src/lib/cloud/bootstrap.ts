import { applyHouseholdSync } from "@/lib/cloud/apply-sync";
import { getCloudAuthBody } from "@/lib/cloud/auth-payload";
import { isCloudPaused } from "@/lib/cloud/cloud-pause";
import { isAuthSyncError, isSubscriptionSyncError } from "@/lib/cloud/sync-errors";
import { apiBootstrap, apiSubscriptionStatus, apiSync } from "@/lib/cloud/client";
import { getTelegramInitData } from "@/lib/cloud/telegram";
import { useCloudStore } from "@/store/useCloudStore";

function clearStaleHouseholdSession(): void {
  const { token, household } = useCloudStore.getState();
  if (token || household) {
    useCloudStore.getState().clearHouseholdSession();
  }
}

/** После смены секрета на сервере или 401 — перевыпустить токен из Telegram, не сбрасывать облако */
export async function refreshCloudSessionFromTelegram(): Promise<boolean> {
  if (isCloudPaused()) return false;
  const auth = getCloudAuthBody();
  if (!auth.initData && !auth.telegramLogin) return false;
  await runHouseholdBootstrap();
  return Boolean(useCloudStore.getState().token && useCloudStore.getState().household);
}

export async function runHouseholdBootstrap(): Promise<void> {
  if (isCloudPaused()) return;

  const auth = getCloudAuthBody();
  if (auth.initData || auth.telegramLogin) {
    const res = await apiBootstrap(auth);
    if (res.configured === false) {
      useCloudStore.getState().setServerConfigured(false);
      return;
    }
    useCloudStore.getState().setServerConfigured(true);

    if (res.subscription) {
      useCloudStore.getState().setSubscription(res.subscription);
    }

    if (res.user?.id) {
      useCloudStore.getState().setCloudUserId(res.user.id);
    }
    if (res.token && res.sync && res.household) {
      applyHouseholdSync(res.sync, res.token);
      useCloudStore.getState().touchSync();
    } else if (res.token && res.household) {
      useCloudStore.getState().setSession(res.token, res.household);
    } else if (!res.subscription?.enforced || res.subscription.active) {
      clearStaleHouseholdSession();
    }
    return;
  }

  const token = useCloudStore.getState().token;
  if (!token) return;

  try {
    const res = await apiSync(token);
    applyHouseholdSync(res.sync, token);
    useCloudStore.getState().setServerConfigured(true);
    useCloudStore.getState().touchSync();
  } catch (e) {
    if (isSubscriptionSyncError(e)) {
      try {
        const subRes = await apiSubscriptionStatus(token);
        useCloudStore.getState().setSubscription(subRes.subscription);
      } catch {
        /* ignore */
      }
      return;
    }
    if (isAuthSyncError(e)) {
      const refreshed = await refreshCloudSessionFromTelegram();
      if (!refreshed) clearStaleHouseholdSession();
    }
  }
}

export function canRunCloudBootstrap(): boolean {
  return Boolean(
    getTelegramInitData() ||
      getCloudAuthBody().telegramLogin ||
      useCloudStore.getState().token,
  );
}
