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
import { PendingRecurringCard } from "@/components/PendingRecurringCard";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { HomeMoneyPulseCard } from "@/components/HomeMoneyPulseCard";
import { VehicleMaintenanceBanner } from "@/components/VehicleMaintenanceBanner";
import { VehicleOdometerDialog } from "@/components/VehicleOdometerDialog";
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

function FamilyHomeContent({
  previewNav,
}: {
  previewNav?: { active: AppTabId; onChange: (tab: AppTabId) => void };
}) {
  return (
    <>
      <SubscriptionAccessBanner />
      <TrialBanner />
      <SubscriptionExpiredReminder />
      <AppVersionBanner />
      <VehicleMaintenanceBanner />
      <TMAHeader previewNav={previewNav} />
      <VoiceRecorder />
      <HomeMoneyPulseCard />
      <VehicleOdometerDialog />
      <PendingRecurringCard />
      <HomeSections />
    </>
  );
}

export default function HomePage() {
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.locale);
  const previewMode = bottomNavEnabled();
  const [appView, setAppView] = useState<AppTabId>("family");

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
    if (window.Telegram?.WebApp) return;
    setLocale(detectLocale(navigator.language));
  }, [setLocale]);

  useRecurringProcessor();

  const previewNav = previewMode
    ? { active: appView, onChange: onAppViewChange }
    : undefined;

  const handlePreviewTelegramBack = useCallback(() => {
    if (!previewMode || appView === "family") return false;
    onAppViewChange("family");
    return true;
  }, [previewMode, appView, onAppViewChange]);

  useTelegramBackHandler(handlePreviewTelegramBack, previewMode && appView !== "family");

  const family = <FamilyHomeContent previewNav={previewNav} />;

  return (
    <main
      className={[
        "mx-auto flex min-h-[var(--tg-viewport-height,100vh)] max-w-lg flex-col gap-2 px-4",
        previewMode && appView !== "family"
          ? "pb-[calc(1rem+env(safe-area-inset-bottom))]"
          : previewMode
            ? "pb-[calc(1rem+env(safe-area-inset-bottom))]"
            : "pb-8",
      ].join(" ")}
      lang={locale}
    >
      <HouseholdCloudBootstrap />
      <PaymentReturnRefresh />
      <SettingsDialogHost />
      {!previewMode ? <FamilyOnboarding /> : null}
      {previewMode ? (
        <PreviewAppShell familyContent={family} previewNav={{ active: appView, onChange: onAppViewChange }} />
      ) : (
        family
      )}
    </main>
  );
}
