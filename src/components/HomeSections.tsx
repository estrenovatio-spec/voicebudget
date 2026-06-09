"use client";

import dynamic from "next/dynamic";
import { PlanningPanel } from "@/components/PlanningPanel";
import { TipsPanel } from "@/components/TipsPanel";
import { TransactionList } from "@/components/TransactionList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/store/useStore";

const FinancialChart = dynamic(
  () => import("@/components/FinancialChart").then((m) => m.FinancialChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] w-full animate-pulse rounded-lg border bg-muted" />
    ),
  },
);

export function HomeSections() {
  const locale = useStore((s) => s.locale);
  const familyTabClass =
    "h-auto min-h-10 rounded-md px-1 text-[11px] font-semibold leading-tight text-foreground/70 transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

  return (
    <Tabs defaultValue="operations" className="space-y-2">
      <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-lg border border-primary/25 bg-primary/10 p-1 shadow-sm">
        <TabsTrigger value="operations" className={familyTabClass}>
          {locale === "ru" ? "Операции" : "Entries"}
        </TabsTrigger>
        <TabsTrigger value="planning" className={familyTabClass}>
          {locale === "ru" ? (
            <span className="text-center">
              Цели
              <br />
              и план
            </span>
          ) : (
            <span className="text-center">
              Goals
              <br />
              plan
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="stats" className={familyTabClass}>
          {locale === "ru" ? "Статистика" : "Stats"}
        </TabsTrigger>
        <TabsTrigger value="advisor" className={familyTabClass}>
          {locale === "ru" ? (
            <span className="text-center">
              Фин
              <br />
              советник
            </span>
          ) : (
            <span className="text-center">
              Advisor
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="operations" className="mt-0">
        <TransactionList collapsible={false} />
      </TabsContent>
      <TabsContent value="planning" className="mt-0">
        <PlanningPanel collapsible={false} />
      </TabsContent>
      <TabsContent value="stats" className="mt-0">
        <FinancialChart collapsible={false} />
      </TabsContent>
      <TabsContent value="advisor" className="mt-0">
        <TipsPanel collapsible={false} />
      </TabsContent>
    </Tabs>
  );
}
