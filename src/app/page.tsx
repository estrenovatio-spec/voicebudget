"use client";

import { AppVersionBanner } from "@/components/AppVersionBanner";
import { PreviewAppShell } from "@/components/app/PreviewAppShell";
import { HomeSections } from "@/components/HomeSections";
import { useRecurringProcessor } from "@/hooks/useRecurringProcessor";
import { HouseholdCloudBootstrap } from "@/components/HouseholdCloudBootstrap";
import { SettingsDialogHost } from "@/components/SettingsDialogHost";
import { TMAHeader } from "@/components/TMAHeader";
import { PaymentReturnRefresh } from "@/components/PaymentReturnRefresh";
import { SubscriptionExpiredReminder } from "@/components/SubscriptionExpiredReminder";
import { SubscriptionAccessBanner } from "@/components/SubscriptionAccessBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import {
  bottomNavEnabled,
  readStoredAppTab,
  writeStoredAppTab,
  type AppTabId,
} from "@/lib/app-bottom-nav";
import { FamilyOnboarding } from "@/components/FamilyOnboarding";
import { detectLocale } from "@/lib/i18n";
import { clearDismissibleHintKeys } from "@/lib/storage-reset";
import { useStore } from "@/store/useStore";
import { useCallback, useEffect, useState } from "react";
import { useTelegramBackHandler } from "@/hooks/useTelegramBackHandler";
import { TipsPanel } from "@/components/TipsPanel";

function HomeTabContent({
  previewNav,
}: {
  previewNav?: { active: AppTabId; onChange: (tab: AppTabId) => void };
}) {
  return (
    <>
      <AppVersionBanner />
      <TMAHeader previewNav={previewNav} />
      <VoiceRecorder />
      <HomeSections />
    </>
  );
}

function OperationsTabContent() {
  return <HomeSections />;
}

function AdvisorTabContent() {
  return <TipsPanel collapsible={false} />;
}

export default function HomePage() {
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.locale);
  const businessModeEnabled = useStore((s) => s.businessModeEnabled);
  const passiveIncomeEnabled = useStore((s) => s.passiveIncomeEnabled);
  const showBusinessTab = businessModeEnabled || passiveIncomeEnabled;
  const previewMode = bottomNavEnabled();
  const [appView, setAppView] = useState<AppTabId>("home");

  useEffect(() => {
    clearDismissibleHintKeys();
  }, []);

  useEffect(() => {
    if (previewMode) setAppView(readStoredAppTab());
  }, [previewMode]);

  const onAppViewChange = useCallback((tab: AppTabId) => {
    setAppView(tab);
    writeStoredAppTab(tab);
  }, []);

  useEffect(() => {
    if (showBusinessTab) return;
    if (appView !== "business") return;
    onAppViewChange("home");
  }, [appView, onAppViewChange, showBusinessTab]);

  useEffect(() => {
    if (window.Telegram?.WebApp) return;
    setLocale(detectLocale(navigator.language));
  }, [setLocale]);

  useRecurringProcessor();

  const previewNav = previewMode
    ? { active: appView, onChange: onAppViewChange }
    : undefined;

  const handlePreviewTelegramBack = useCallback(() => {
    if (!previewMode || appView === "home") return false;
    onAppViewChange("home");
    return true;
  }, [previewMode, appView, onAppViewChange]);

  useTelegramBackHandler(handlePreviewTelegramBack, previewMode && appView !== "home");

  const home = <HomeTabContent previewNav={previewNav} />;
  const operations = <OperationsTabContent />;
  const advisor = <AdvisorTabContent />;

  return (
    <main
      className={[
        "mx-auto flex min-h-[var(--tg-viewport-height,100vh)] max-w-lg flex-col gap-2 px-4",
        previewMode ? "pb-[calc(1rem+env(safe-area-inset-bottom))]" : "pb-8",
      ].join(" ")}
      lang={locale}
    >
      <HouseholdCloudBootstrap />
      <PaymentReturnRefresh />
      <SettingsDialogHost />
      {!previewMode ? <FamilyOnboarding /> : null}
      <SubscriptionAccessBanner />
      <TrialBanner />
      <SubscriptionExpiredReminder />
      {previewMode ? (
        <PreviewAppShell
          homeContent={home}
          operationsContent={operations}
          advisorContent={advisor}
          previewNav={{ active: appView, onChange: onAppViewChange }}
        />
      ) : (
        home
      )}
    </main>
  );
}
