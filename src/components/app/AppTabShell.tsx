"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AppBottomNav } from "@/components/app/AppBottomNav";
import { BusinessTab } from "@/components/app/BusinessTab";
import { MoreTab } from "@/components/app/MoreTab";
import {
  readStoredAppTab,
  writeStoredAppTab,
  type AppTabId,
} from "@/lib/app-bottom-nav";

export function AppTabShell({ familyContent }: { familyContent: ReactNode }) {
  const [tab, setTab] = useState<AppTabId>("family");

  useEffect(() => {
    setTab(readStoredAppTab());
  }, []);

  const changeTab = (next: AppTabId) => {
    setTab(next);
    writeStoredAppTab(next);
  };

  return (
    <>
      <div className="min-h-0 flex-1">
        {tab === "family" ? familyContent : null}
        {tab === "business" ? <BusinessTab /> : null}
        {tab === "more" ? <MoreTab /> : null}
      </div>
      <AppBottomNav active={tab} onChange={changeTab} />
    </>
  );
}
