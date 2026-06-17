"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { BusinessTab } from "@/components/app/BusinessTab";
import { MoreTab } from "@/components/app/MoreTab";
import {
  PreviewViewChrome,
  PreviewViewControls,
} from "@/components/app/PreviewViewChrome";
import { useBusinessCloudSync } from "@/hooks/useBusinessCloudSync";
import { type AppTabId, writeStoredAppTab } from "@/lib/app-bottom-nav";
import { useStore } from "@/store/useStore";

/** Preview: семья как на проде + переключение вкладок через шапку/нижний nav. */
export function PreviewAppShell({
  homeContent,
  operationsContent,
  advisorContent,
  previewNav,
}: {
  homeContent: ReactNode;
  operationsContent: ReactNode;
  advisorContent: ReactNode;
  previewNav: { active: AppTabId; onChange: (tab: AppTabId) => void };
}) {
  const { active, onChange } = previewNav;
  const businessModeEnabled = useStore((s) => s.businessModeEnabled);
  const passiveIncomeEnabled = useStore((s) => s.passiveIncomeEnabled);
  const showBusinessTab = businessModeEnabled || passiveIncomeEnabled;

  useBusinessCloudSync();

  const changeTab = useCallback(
    (next: AppTabId) => {
      writeStoredAppTab(next);
      onChange(next);
    },
    [onChange],
  );

  useEffect(() => {
    if (showBusinessTab) return;
    if (active !== "business") return;
    changeTab("home");
  }, [active, changeTab, showBusinessTab]);

  return (
    <div className="min-h-0 flex-1">
      {active === "home" ? <div className="space-y-2">{homeContent}</div> : null}
      {active === "operations" ? <div className="space-y-2">{operationsContent}</div> : null}
      {active === "advisor" ? <div className="space-y-2">{advisorContent}</div> : null}
      {active === "business" && showBusinessTab ? (
        <BusinessTab
          headerControls={
            <PreviewViewControls active={active} onChange={changeTab} />
          }
        />
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
