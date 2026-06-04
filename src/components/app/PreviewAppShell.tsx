"use client";

import type { ReactNode } from "react";
import { BusinessTab } from "@/components/app/BusinessTab";
import { MoreTab } from "@/components/app/MoreTab";
import { PreviewViewChrome } from "@/components/app/PreviewViewChrome";
import { useBusinessCloudSync } from "@/hooks/useBusinessCloudSync";
import {
  writeStoredAppTab,
  type AppTabId,
} from "@/lib/app-bottom-nav";

/** Preview: семья как на проде + переключение Biz / Ещё через шапку. */
export function PreviewAppShell({
  familyContent,
  previewNav,
}: {
  familyContent: ReactNode;
  previewNav: { active: AppTabId; onChange: (tab: AppTabId) => void };
}) {
  const { active, onChange } = previewNav;

  useBusinessCloudSync();

  const changeTab = (next: AppTabId) => {
    writeStoredAppTab(next);
    onChange(next);
  };

  return (
    <div className="min-h-0 flex-1">
      {active === "family" ? familyContent : null}
      {active === "business" ? (
        <>
          <PreviewViewChrome active={active} onChange={changeTab} />
          <BusinessTab />
        </>
      ) : null}
      {active === "more" ? (
        <>
          <PreviewViewChrome active={active} onChange={changeTab} />
          <MoreTab />
        </>
      ) : null}
    </div>
  );
}
