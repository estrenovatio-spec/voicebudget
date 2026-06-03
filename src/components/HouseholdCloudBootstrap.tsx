"use client";

import { useEffect } from "react";
import { canRunCloudBootstrap, runHouseholdBootstrap } from "@/lib/cloud/bootstrap";
import { waitForTelegramInitData, shouldWaitForTelegramInitData } from "@/lib/cloud/wait-telegram-init";
import { hasTelegramWebApp } from "@/lib/cloud/telegram";
import { useCloudAutoSync } from "@/hooks/useCloudAutoSync";
import { useCloudStore } from "@/store/useCloudStore";

/** Cloud bootstrap on load (after persist rehydrate) + auto-sync while tab is open. */
export function HouseholdCloudBootstrap() {
  useCloudAutoSync();

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (cancelled) return;

      if (shouldWaitForTelegramInitData()) {
        await waitForTelegramInitData(6000);
        if (cancelled) return;
      }

      if (!canRunCloudBootstrap()) return;
      await runHouseholdBootstrap();
    };

    void boot();

    const persistApi = useCloudStore.persist;
    const afterHydrate = () => {
      void boot();
    };

    if (persistApi?.hasHydrated?.()) {
      void boot();
    } else {
      const unsub = persistApi?.onFinishHydration?.(afterHydrate);
      if (unsub) {
        return () => {
          cancelled = true;
          unsub();
        };
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible" && hasTelegramWebApp()) {
        void boot();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
