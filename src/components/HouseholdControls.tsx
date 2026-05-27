"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";
import type { BudgetOwner, HouseholdFilter } from "@/types";

export function EntryOwnerToggle() {
  const locale = useStore((s) => s.locale);
  const partnerName = useStore((s) => s.partnerName);
  const entryOwner = useStore((s) => s.entryOwner);
  const setEntryOwner = useStore((s) => s.setEntryOwner);

  if (!partnerName?.trim()) return null;

  const options: { id: BudgetOwner; label: string }[] = [
    { id: "me", label: t(locale, "ownerMe") },
    { id: "partner", label: partnerName.trim() },
  ];

  return (
    <div className="flex w-full max-w-md gap-2">
      {options.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          variant={entryOwner === opt.id ? "default" : "outline"}
          className="flex-1 text-sm"
          onClick={() => setEntryOwner(opt.id)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function HouseholdFilterTabs() {
  const locale = useStore((s) => s.locale);
  const partnerName = useStore((s) => s.partnerName);
  const householdFilter = useStore((s) => s.householdFilter);
  const setHouseholdFilter = useStore((s) => s.setHouseholdFilter);

  if (!partnerName?.trim()) return null;

  const tabs: { id: HouseholdFilter; label: string }[] = [
    { id: "all", label: t(locale, "householdAll") },
    { id: "me", label: t(locale, "ownerMe") },
    { id: "partner", label: partnerName.trim() },
  ];

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setHouseholdFilter(tab.id)}
          className={[
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            householdFilter === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
