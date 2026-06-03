"use client";

import { ChevronLeft, FileBarChart, UserPlus } from "lucide-react";
import { useState } from "react";
import { EducationTab } from "@/components/app/EducationTab";
import { MoreReportsTab } from "@/components/app/MoreReportsTab";
import { MoreServiceForm } from "@/components/app/MoreServiceForm";
import { ReferralPanel } from "@/components/ReferralPanel";
import { SettingsMenuRow } from "@/components/SettingsMenuRow";
import { Button } from "@/components/ui/button";
import { requestOpenSettings } from "@/lib/billing/trial-banner";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

type MoreScreen =
  | "main"
  | "education"
  | "reports"
  | "insurance"
  | "osago"
  | "tick"
  | "mortgage"
  | "travel"
  | "extra1"
  | "extra2";

type ServiceId = Exclude<MoreScreen, "main" | "education" | "reports" | "insurance">;

const INSURANCE_ITEMS: {
  id: ServiceId;
  titleKey?: Parameters<typeof t>[1];
  descriptionKey?: Parameters<typeof t>[1];
  unnamed?: boolean;
}[] = [
  { id: "osago", titleKey: "moreOsago", descriptionKey: "moreOsagoHint" },
  { id: "tick", titleKey: "moreTick", descriptionKey: "moreTickHint" },
  { id: "mortgage", titleKey: "moreMortgage", descriptionKey: "moreMortgageHint" },
  { id: "travel", titleKey: "moreTravel", descriptionKey: "moreTravelHint" },
  { id: "extra1", descriptionKey: "moreServiceComingSoon", unnamed: true },
  { id: "extra2", descriptionKey: "moreServiceComingSoon", unnamed: true },
];

function MoreSubheader({
  locale,
  title,
  onBack,
}: {
  locale: "ru" | "en";
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        aria-label={t(locale, "settingsBack")}
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <h2 className="text-lg font-bold leading-tight">{title}</h2>
    </div>
  );
}

export function MoreTab() {
  const locale = useStore((s) => s.locale);
  const [screen, setScreen] = useState<MoreScreen>("main");

  const osagoFormUrl = process.env.NEXT_PUBLIC_OSAGO_FORM_URL?.trim() || null;

  if (screen === "reports") {
    return (
      <div className="space-y-3 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreReports")}
          onBack={() => setScreen("main")}
        />
        <MoreReportsTab />
      </div>
    );
  }

  if (screen === "education") {
    return (
      <div className="space-y-3 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreEducation")}
          onBack={() => setScreen("main")}
        />
        <EducationTab embedded />
      </div>
    );
  }

  if (screen === "insurance") {
    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreServicesTitle")}
          onBack={() => setScreen("main")}
        />
        <div className="space-y-2">
          {INSURANCE_ITEMS.map((item) => (
            <SettingsMenuRow
              key={item.id}
              title={item.titleKey ? t(locale, item.titleKey) : undefined}
              description={
                item.descriptionKey ? t(locale, item.descriptionKey) : undefined
              }
              onClick={() => setScreen(item.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (screen !== "main") {
    const titles: Record<ServiceId, string> = {
      osago: t(locale, "moreOsago"),
      tick: t(locale, "moreTick"),
      mortgage: t(locale, "moreMortgage"),
      travel: t(locale, "moreTravel"),
      extra1: t(locale, "moreServiceUnnamed"),
      extra2: t(locale, "moreServiceUnnamed"),
    };
    const subtitles: Partial<Record<ServiceId, string>> = {
      osago: t(locale, "moreOsagoFormHint"),
      tick: t(locale, "moreServiceFormHint"),
      mortgage: t(locale, "moreServiceFormHint"),
      travel: t(locale, "moreServiceFormHint"),
    };

    const isPlaceholder = screen === "extra1" || screen === "extra2";

    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={titles[screen]}
          onBack={() => setScreen("insurance")}
        />
        {isPlaceholder ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {t(locale, "moreServiceComingSoon")}
          </p>
        ) : (
          <MoreServiceForm
            title={titles[screen]}
            subtitle={subtitles[screen]}
            externalFormUrl={screen === "osago" ? osagoFormUrl : null}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 py-1">
      <div>
        <h2 className="text-lg font-bold">{t(locale, "moreTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t(locale, "moreSubtitle")}</p>
      </div>

      <div className="space-y-2">
        <SettingsMenuRow
          title={t(locale, "moreReports")}
          description={t(locale, "moreReportsHint")}
          onClick={() => setScreen("reports")}
        />
        <SettingsMenuRow
          title={t(locale, "moreEducation")}
          description={t(locale, "moreEducationHint")}
          badge={t(locale, "educationFreeBadge")}
          onClick={() => setScreen("education")}
        />
        <SettingsMenuRow
          title={t(locale, "moreSettings")}
          description={t(locale, "moreSettingsHint")}
          onClick={() => requestOpenSettings()}
        />
        <SettingsMenuRow
          title={t(locale, "moreServicesTitle")}
          description={t(locale, "moreInsuranceMenuHint")}
          onClick={() => setScreen("insurance")}
        />
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-primary" aria-hidden />
          {t(locale, "moreReferralTitle")}
        </h3>
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
          <ReferralPanel />
        </div>
      </section>
    </div>
  );
}
