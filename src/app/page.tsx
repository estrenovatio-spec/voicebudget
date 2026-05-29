"use client";

import dynamic from "next/dynamic";
import { TipsPanel } from "@/components/TipsPanel";
import { MonthlyFinanceDialog } from "@/components/MonthlyFinanceDialog";
import { PlanningPanel } from "@/components/PlanningPanel";
import { useRecurringProcessor } from "@/hooks/useRecurringProcessor";
import { HouseholdCloudBootstrap } from "@/components/HouseholdCloudBootstrap";
import { TMAHeader } from "@/components/TMAHeader";
import { TransactionList } from "@/components/TransactionList";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { detectLocale } from "@/lib/i18n";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";

const FinancialChart = dynamic(
  () => import("@/components/FinancialChart").then((m) => m.FinancialChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] w-full animate-pulse rounded-lg border bg-muted" />
    ),
  },
);

export default function HomePage() {
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.locale);

  useEffect(() => {
    if (window.Telegram?.WebApp) return;
    setLocale(detectLocale(navigator.language));
  }, [setLocale]);

  useRecurringProcessor();

  return (
    <main
      className="mx-auto flex min-h-[var(--tg-viewport-height,100vh)] max-w-lg flex-col gap-4 px-4 pb-8"
      lang={locale}
    >
      <HouseholdCloudBootstrap />
      <TMAHeader />
      <VoiceRecorder />
      <TransactionList />
      <PlanningPanel />
      <FinancialChart />
      <MonthlyFinanceDialog />
      <TipsPanel />
    </main>
  );
}
