"use client";

import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Shield,
  Sparkles,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useTelegramBackHandler } from "@/hooks/useTelegramBackHandler";
import { useEducationConfig } from "@/hooks/useEducationConfig";
import { EducationTab } from "@/components/app/EducationTab";
import { MoreReportsTab } from "@/components/app/MoreReportsTab";
import { MoreServiceForm } from "@/components/app/MoreServiceForm";
import { ReferralPanel } from "@/components/ReferralPanel";
import { SettingsMenuRow } from "@/components/SettingsMenuRow";
import { Button } from "@/components/ui/button";
import { requestOpenSettings } from "@/lib/billing/trial-banner";
import { openExternalAppLink } from "@/lib/education-links";
import { openFortuneWheelLink } from "@/lib/fortune-wheel-link";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

type MoreScreen =
  | "main"
  | "education"
  | "reports"
  | "insurance"
  | "extra_services"
  | "osago"
  | "insurance_other"
  | "iszh_nszh"
  | "sg_advisor";

const INSURANCE_FORM_SCREENS = new Set<MoreScreen>([
  "osago",
  "insurance_other",
  "iszh_nszh",
]);

export function MoreTab() {
  const locale = useStore((s) => s.locale);
  const [screen, setScreen] = useState<MoreScreen>("main");
  const { diagnosticsFormUrl } = useEducationConfig();

  const osagoFormUrl = process.env.NEXT_PUBLIC_OSAGO_FORM_URL?.trim() || null;

  const handleTelegramBack = useCallback(() => {
    if (screen === "main") return false;
    if (screen === "education" || screen === "sg_advisor") {
      setScreen("extra_services");
      return true;
    }
    if (INSURANCE_FORM_SCREENS.has(screen)) {
      setScreen("insurance");
      return true;
    }
    if (screen === "insurance" || screen === "extra_services") {
      setScreen("main");
      return true;
    }
    setScreen("main");
    return true;
  }, [screen]);

  useTelegramBackHandler(handleTelegramBack, screen !== "main");

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
          onBack={() => setScreen("extra_services")}
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
          <SettingsMenuRow
            title={t(locale, "moreOsago")}
            description={t(locale, "moreOsagoHint")}
            onClick={() => setScreen("osago")}
          />
          <SettingsMenuRow
            title={t(locale, "moreIszhNszh")}
            description={t(locale, "moreIszhNszhHint")}
            onClick={() => setScreen("iszh_nszh")}
          />
          <SettingsMenuRow
            title={t(locale, "moreInsuranceOther")}
            description={t(locale, "moreInsuranceOtherHint")}
            onClick={() => setScreen("insurance_other")}
          />
        </div>
      </div>
    );
  }

  if (screen === "extra_services") {
    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreExtraServicesTitle")}
          onBack={() => setScreen("main")}
        />

        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-primary" aria-hidden />
            {t(locale, "moreSgAdvisorTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(locale, "moreSgAdvisorHint")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setScreen("sg_advisor")}
          >
            {t(locale, "moreSgAdvisorCta")}
          </Button>
        </div>

        <SettingsMenuRow
          title={t(locale, "moreEducation")}
          description={t(locale, "moreEducationHint")}
          onClick={() => setScreen("education")}
        />

        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Stethoscope className="h-4 w-4 text-primary" aria-hidden />
            {t(locale, "moreFreeDiagnostics")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(locale, "moreFreeDiagnosticsHint")}
          </p>
          {diagnosticsFormUrl ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => openExternalAppLink(diagnosticsFormUrl)}
            >
              {t(locale, "educationOpenForm")}
            </Button>
          ) : (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {t(locale, "educationFormMissing")}
            </p>
          )}
        </div>

        <SettingsMenuRow
          title={t(locale, "moreFortuneWheel")}
          description={t(locale, "moreFortuneWheelHint")}
          onClick={() => openFortuneWheelLink()}
        />
      </div>
    );
  }

  if (screen === "osago") {
    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreOsago")}
          onBack={() => setScreen("insurance")}
        />
        <MoreServiceForm
          title={t(locale, "moreOsago")}
          subtitle={t(locale, "moreOsagoFormHint")}
          serviceId="osago"
          externalFormUrl={osagoFormUrl}
        />
      </div>
    );
  }

  if (screen === "iszh_nszh") {
    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreIszhNszh")}
          onBack={() => setScreen("insurance")}
        />
        <MoreServiceForm
          title={t(locale, "moreIszhNszh")}
          subtitle={t(locale, "moreIszhNszhFormHint")}
          serviceId="iszh"
          showTopicPicker
          topicOptions={["iszh", "nszh"]}
        />
      </div>
    );
  }

  if (screen === "insurance_other") {
    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreInsuranceOther")}
          onBack={() => setScreen("insurance")}
        />
        <MoreServiceForm
          title={t(locale, "moreInsuranceOther")}
          subtitle={t(locale, "moreServiceFormHint")}
          serviceId="tick"
          showTopicPicker
        />
      </div>
    );
  }

  if (screen === "sg_advisor") {
    return (
      <div className="space-y-4 py-1">
        <MoreSubheader
          locale={locale}
          title={t(locale, "moreSgAdvisorTitle")}
          onBack={() => setScreen("extra_services")}
        />
        <MoreServiceForm
          title={t(locale, "moreSgAdvisorTitle")}
          subtitle={t(locale, "moreSgAdvisorFormHint")}
          serviceId="sg_advisor"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-1">
      <div>
        <h2 className="text-lg font-bold">{t(locale, "moreTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(locale, "moreSubtitle")}
        </p>
      </div>

      <div className="space-y-2">
        <MoreHubPlaque
          title={t(locale, "moreServicesTitle")}
          hint={t(locale, "moreInsuranceHubHint")}
          icon={<Shield className="h-4 w-4 text-primary" aria-hidden />}
          onClick={() => setScreen("insurance")}
        />
        <MoreHubPlaque
          title={t(locale, "moreExtraServicesTitle")}
          hint={t(locale, "moreExtraServicesHint")}
          icon={<Sparkles className="h-4 w-4 text-primary" aria-hidden />}
          onClick={() => setScreen("extra_services")}
        />
      </div>

      <div className="space-y-2">
        <SettingsMenuRow
          title={t(locale, "moreSettings")}
          description={t(locale, "moreSettingsHint")}
          onClick={() => requestOpenSettings()}
        />
        <SettingsMenuRow
          title={t(locale, "moreReports")}
          description={t(locale, "moreReportsHint")}
          onClick={() => setScreen("reports")}
        />
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-primary" aria-hidden />
          {t(locale, "moreReferralTitle")}
        </h3>
        <div className="min-w-0 overflow-hidden rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 dark:border-primary/30 dark:bg-primary/10">
          <ReferralPanel />
        </div>
      </section>
    </div>
  );
}

function MoreHubPlaque({
  title,
  hint,
  icon,
  onClick,
}: {
  title: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-left transition-colors hover:bg-primary/10"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </button>
  );
}

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
