"use client";

import { useState } from "react";
import { MonthlyAnalysisTab } from "@/components/MonthlyAnalysisTab";
import { WeeklyAnalysisTab } from "@/components/WeeklyAnalysisTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

type AiSubTab = "weekly" | "monthly";

type AiAnalysisTabProps = {
  active: boolean;
};

export function AiAnalysisTab({ active }: AiAnalysisTabProps) {
  const locale = useStore((s) => s.locale);
  const [subTab, setSubTab] = useState<AiSubTab>("weekly");

  return (
    <Tabs value={subTab} onValueChange={(v) => setSubTab(v as AiSubTab)}>
      <TabsList className="mb-3 grid w-full grid-cols-2">
        <TabsTrigger value="weekly">{t(locale, "aiTabWeekly")}</TabsTrigger>
        <TabsTrigger value="monthly">{t(locale, "aiTabMonthly")}</TabsTrigger>
      </TabsList>
      <TabsContent value="weekly">
        <WeeklyAnalysisTab active={active && subTab === "weekly"} />
      </TabsContent>
      <TabsContent value="monthly">
        <MonthlyAnalysisTab active={active && subTab === "monthly"} />
      </TabsContent>
    </Tabs>
  );
}
