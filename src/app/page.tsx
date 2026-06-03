"use client";

import { AppVersionBanner } from "@/components/AppVersionBanner";
import { AppTabShell } from "@/components/app/AppTabShell";
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
import { TransactionList } from "@/components/TransactionList";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { VehicleMaintenanceBanner } from "@/components/VehicleMaintenanceBanner";
import { VehicleOdometerDialog } from "@/components/VehicleOdometerDialog";
import { bottomNavEnabled } from "@/lib/app-bottom-nav";
import { detectLocale } from "@/lib/i18n";
import { clearDismissibleHintKeys } from "@/lib/storage-reset";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";

function FamilyHomeContent({ bottomNav }: { bottomNav: boolean }) {
  return (
    <>
      <SubscriptionAccessBanner />
      <TrialBanner />
      <SubscriptionExpiredReminder />
      <AppVersionBanner />
      <VehicleMaintenanceBanner />
      <TMAHeader hideBusinessButton={bottomNav} />
      <VoiceRecorder />
      <VehicleOdometerDialog />
      <PendingRecurringCard />
      <TransactionList />
      <HomeSections />
    </>
  );
}

export default function HomePage() {
  const setLocale = useStore((s) => s.setLocale);
  const locale = useStore((s) => s.locale);
  const bottomNav = bottomNavEnabled();

  useEffect(() => {
    clearDismissibleHintKeys();
  }, []);

  useEffect(() => {
    if (window.Telegram?.WebApp) return;
    setLocale(detectLocale(navigator.language));
  }, [setLocale]);

  useRecurringProcessor();

  const family = <FamilyHomeContent bottomNav={bottomNav} />;

  return (
    <main
      className={[
        "mx-auto flex min-h-[var(--tg-viewport-height,100vh)] max-w-lg flex-col gap-2 px-4",
        bottomNav ? "pb-[calc(4.25rem+env(safe-area-inset-bottom))]" : "pb-8",
      ].join(" ")}
      lang={locale}
    >
      <HouseholdCloudBootstrap />
      <PaymentReturnRefresh />
      <SettingsDialogHost />
      {bottomNav ? <AppTabShell familyContent={family} /> : family}
    </main>
  );
}
