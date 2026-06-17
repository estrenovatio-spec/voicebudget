"use client";

import {
  BriefcaseBusiness,
  Ellipsis,
  FolderKanban,
  House,
  ListChecks,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { AppTabId } from "@/lib/app-bottom-nav";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const TABS: {
  id: AppTabId;
  icon: LucideIcon;
  labelKey:
    | "appTabHome"
    | "appTabOperations"
    | "appTabAdvisor"
    | "appTabBusiness"
    | "appTabProjects"
    | "appTabMore";
}[] = [
  { id: "home", icon: House, labelKey: "appTabHome" },
  { id: "operations", icon: ListChecks, labelKey: "appTabOperations" },
  { id: "advisor", icon: MessagesSquare, labelKey: "appTabAdvisor" },
  { id: "business", icon: BriefcaseBusiness, labelKey: "appTabBusiness" },
  { id: "more", icon: Ellipsis, labelKey: "appTabMore" },
];

export function AppBottomNav({
  active,
  onChange,
}: {
  active: AppTabId;
  onChange: (tab: AppTabId) => void;
}) {
  const locale = useStore((s) => s.locale);
  const businessModeEnabled = useStore((s) => s.businessModeEnabled);
  const passiveIncomeEnabled = useStore((s) => s.passiveIncomeEnabled);
  const showBusinessTab = businessModeEnabled || passiveIncomeEnabled;
  const tabs = showBusinessTab ? TABS : TABS.filter((tab) => tab.id !== "business");
  const businessLabelKey = (
    passiveIncomeEnabled && !businessModeEnabled ? "appTabProjects" : "appTabBusiness"
  ) as Parameters<typeof t>[1];
  const tabsWithLabel = tabs.map((tab) =>
    tab.id === "business"
      ? {
          ...tab,
          labelKey: businessLabelKey,
          icon:
            passiveIncomeEnabled && !businessModeEnabled ? FolderKanban : BriefcaseBusiness,
        }
      : tab,
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      aria-label={t(locale, "appBottomNavAria")}
    >
      <div className={`mx-auto grid max-w-lg ${showBusinessTab ? "grid-cols-5" : "grid-cols-4"}`}>
        {tabsWithLabel.map(({ id, icon: Icon, labelKey }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={[
                "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                selected
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              aria-current={selected ? "page" : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="max-w-full truncate">{t(locale, labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
