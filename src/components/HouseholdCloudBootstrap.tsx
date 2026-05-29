"use client";

import { useEffect } from "react";
import { canRunCloudBootstrap, runHouseholdBootstrap } from "@/lib/cloud/bootstrap";
import { useCloudAutoSync } from "@/hooks/useCloudAutoSync";
import { useCloudStore } from "@/store/useCloudStore";

/** Cloud bootstrap on load (after persist rehydrate) + auto-sync while tab is open. */
export function HouseholdCloudBootstrap() {
  useCloudAutoSync();

  useEffect(() => {
    const boot = () => {
      if (!canRunCloudBootstrap()) return;
      void runHouseholdBootstrap();
    };

    boot();

    const persistApi = useCloudStore.persist;
    if (persistApi?.hasHydrated?.()) {
      boot();
    } else {
      const unsub = persistApi?.onFinishHydration?.(() => {
        boot();
      });
      return () => unsub?.();
    }
  }, []);

  return null;
}
