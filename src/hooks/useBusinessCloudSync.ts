"use client";

import { useEffect } from "react";
import { bottomNavEnabled } from "@/lib/app-bottom-nav";
import {
  pullBusinessFromCloud,
  scheduleBusinessCloudPush,
} from "@/lib/cloud/business-sync";
import { useBusinessStore } from "@/store/useBusinessStore";
import { useCloudStore } from "@/store/useCloudStore";

/** Синхронизация бизнес-контура с облаком (preview, личные данные пользователя). */
export function useBusinessCloudSync() {
  const token = useCloudStore((s) => s.token);
  const preview = bottomNavEnabled();

  useEffect(() => {
    if (!preview || !token) return;
    void pullBusinessFromCloud();
  }, [preview, token]);

  useEffect(() => {
    if (!preview || !token) return;
    const unsub = useBusinessStore.subscribe(() => {
      scheduleBusinessCloudPush();
    });
    return unsub;
  }, [preview, token]);
}
