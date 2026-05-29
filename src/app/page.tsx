"use client";

import { HomeSections } from "@/components/HomeSections";
import { useRecurringProcessor } from "@/hooks/useRecurringProcessor";
import { HouseholdCloudBootstrap } from "@/components/HouseholdCloudBootstrap";
import { TMAHeader } from "@/components/TMAHeader";
import { TransactionList } from "@/components/TransactionList";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { detectLocale } from "@/lib/i18n";
import { clearDismissibleHintKeys } from "@/lib/storage-reset";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";

export default function HomePage() {
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.locale);

  useEffect(() => {
    clearDismissibleHintKeys();
  }, []);

  useEffect(() => {
    if (window.Telegram?.WebApp) return;
    setLocale(detectLocale(navigator.language));
  }, [setLocale]);

  useRecurringProcessor();

  return (
    <main
      className="mx-auto flex min-h-[var(--tg-viewport-height,100vh)] max-w-lg flex-col gap-2 px-4 pb-8"
      lang={locale}
    >
      <HouseholdCloudBootstrap />
      <TMAHeader />
      <VoiceRecorder />
      <TransactionList />
      <HomeSections />
    </main>
  );
}
