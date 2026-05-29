"use client";

import dynamic from "next/dynamic";
import { PlanningPanel } from "@/components/PlanningPanel";
import { TipsPanel } from "@/components/TipsPanel";

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
  return (
    <div className="space-y-2">
      <PlanningPanel />
      <FinancialChart />
      <TipsPanel />
    </div>
  );
}
