"use client";

import { useRef, type ReactNode } from "react";
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useBusinessCloudSync();

  const changeTab = (next: AppTabId) => {
    writeStoredAppTab(next);
    onChange(next);
  };

  const changeBySwipe = (direction: "next" | "prev") => {
    const tabs: AppTabId[] = ["family", "business", "more"];
    const index = tabs.indexOf(active);
    if (index < 0) return;
    const nextIndex =
      direction === "next"
        ? Math.min(tabs.length - 1, index + 1)
        : Math.max(0, index - 1);
    if (nextIndex !== index) changeTab(tabs[nextIndex]);
  };

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        "button,a,input,textarea,select,[role='button'],[contenteditable='true']",
      ),
    );
  };

  return (
    <div
      className="min-h-0 flex-1"
      onTouchStart={(e) => {
        if (isInteractiveTarget(e.target)) {
          touchStartRef.current = null;
          return;
        }
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start || isInteractiveTarget(e.target)) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
        changeBySwipe(dx > 0 ? "next" : "prev");
      }}
    >
      {active === "family" ? <div className="space-y-2">{familyContent}</div> : null}
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
