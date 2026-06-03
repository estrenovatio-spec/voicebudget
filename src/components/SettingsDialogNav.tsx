"use client";

import { ChevronLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AppSettingsDiagnostics } from "@/components/AppSettingsDiagnostics";
import { CategoryManager } from "@/components/CategoryManager";
import { HelpFaqDialog } from "@/components/HelpFaqDialog";
import { HouseholdCloudPanel } from "@/components/HouseholdCloudPanel";
import { ReferralPanel } from "@/components/ReferralPanel";
import { SettingsMenuRow } from "@/components/SettingsMenuRow";
import { UpdateAppButton } from "@/components/UpdateAppButton";
import { OwnerChipColorPicker } from "@/components/OwnerChipColorPicker";
import { VehicleSettingsPanel } from "@/components/VehicleSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cloudPushPartnerLabel, isCloudSyncActive } from "@/lib/cloud/push";
import { parsePartnerKeywordsInput } from "@/lib/detect-owner";
import {
  DEFAULT_MY_CHIP_COLOR,
  DEFAULT_PARTNER_CHIP_COLOR,
} from "@/lib/owner-chip-colors";
import { myDisplayName, partnerDisplayName, partnerTabLabel } from "@/lib/owner-labels";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { hardReloadApp } from "@/lib/storage-reset";
import type { Locale } from "@/types";
import { useStore } from "@/store/useStore";

type SettingsScreen =
  | "menu"
  | "language"
  | "help"
  | "categories"
  | "vehicle"
  | "cloud"
  | "referral"
  | "household"
  | "danger";

type MenuItem = {
  id: Exclude<SettingsScreen, "menu">;
  titleKey: Parameters<typeof t>[1];
  descriptionKey?: Parameters<typeof t>[1];
  danger?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { id: "categories", titleKey: "categoriesTitle", descriptionKey: "categoriesHint" },
  { id: "household", titleKey: "householdTitle", descriptionKey: "householdHint" },
  { id: "cloud", titleKey: "cloudTitle", descriptionKey: "cloudHint" },
  { id: "referral", titleKey: "referralTitle", descriptionKey: "referralSettingsHint" },
  { id: "vehicle", titleKey: "vehicleGarageTitle", descriptionKey: "vehicleHintMulti" },
  { id: "help", titleKey: "helpTitle" },
  { id: "language", titleKey: "settingsLanguage", descriptionKey: "settingsLanguageHint" },
  { id: "danger", titleKey: "clearData", descriptionKey: "clearConfirm", danger: true },
];

export function SettingsDialogNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const userName = useStore((s) => s.userName);
  const partnerName = useStore((s) => s.partnerName);
  const partnerKeywords = useStore((s) => s.partnerKeywords);
  const setUserName = useStore((s) => s.setUserName);
  const setPartnerName = useStore((s) => s.setPartnerName);
  const setPartnerKeywords = useStore((s) => s.setPartnerKeywords);
  const myChipColor = useStore((s) => s.myChipColor);
  const partnerChipColor = useStore((s) => s.partnerChipColor);
  const setMyChipColor = useStore((s) => s.setMyChipColor);
  const setPartnerChipColor = useStore((s) => s.setPartnerChipColor);
  const [screen, setScreen] = useState<SettingsScreen>("menu");
  const [myNameInput, setMyNameInput] = useState(userName ?? "");
  const [partnerInput, setPartnerInput] = useState(partnerName ?? "");
  const [keywordsInput, setKeywordsInput] = useState(partnerKeywords.join(", "));
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedFlash, setSavedFlash] = useState<"my" | "partner" | "keywords" | null>(null);

  useEffect(() => {
    if (!open) {
      setScreen("menu");
      setConfirmClear(false);
      return;
    }
    setMyNameInput(userName ?? "");
    setPartnerInput(partnerName ?? "");
    setKeywordsInput(partnerKeywords.join(", "));
  }, [open, userName, partnerName, partnerKeywords]);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 6000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const flashSaved = (which: "my" | "partner" | "keywords") => {
    setSavedFlash(which);
    window.setTimeout(() => {
      setSavedFlash((current) => (current === which ? null : current));
    }, 2000);
  };

  const saveMyName = () => {
    setUserName(myNameInput.trim() || null);
    flashSaved("my");
  };

  const savePartner = () => {
    const trimmed = partnerInput.trim() || null;
    setPartnerName(trimmed);
    if (isCloudSyncActive()) void cloudPushPartnerLabel(trimmed);
    flashSaved("partner");
  };

  const saveKeywords = () => {
    setPartnerKeywords(parsePartnerKeywordsInput(keywordsInput));
    flashSaved("keywords");
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    hardReloadApp();
  };

  const activeItem = MENU_ITEMS.find((m) => m.id === screen);
  const dialogTitle =
    screen === "menu"
      ? t(locale, "settings")
      : activeItem
        ? t(locale, activeItem.titleKey)
        : t(locale, "settings");

  const detailContent: Record<Exclude<SettingsScreen, "menu">, ReactNode> = {
    language: (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{t(locale, "settingsLanguageHint")}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={locale === "ru" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setLocale("ru" as Locale)}
          >
            {t(locale, "settingsLanguageRu")}
          </Button>
          <Button
            type="button"
            variant={locale === "en" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setLocale("en" as Locale)}
          >
            {t(locale, "settingsLanguageEn")}
          </Button>
        </div>
      </div>
    ),
    help: (
      <div className="space-y-3">
        <HelpFaqDialog locale={locale} />
        <AppSettingsDiagnostics />
      </div>
    ),
    categories: <CategoryManager />,
    vehicle: <VehicleSettingsPanel />,
    cloud: (
      <div className="space-y-3">
        <HouseholdCloudPanel embedded />
        <UpdateAppButton />
      </div>
    ),
    referral: (
      <div className="space-y-2">
        <ReferralPanel />
      </div>
    ),
    household: (
      <div className="space-y-3">
        <Input
          value={myNameInput}
          onChange={(e) => setMyNameInput(e.target.value)}
          placeholder={t(locale, "myNamePlaceholder")}
        />
        <Button type="button" variant="secondary" className="w-full" onClick={saveMyName}>
          {t(locale, "myNameSave")}
        </Button>
        {savedFlash === "my" ? (
          <p className="flex justify-center" role="status" aria-live="polite">
            <span className="inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
              {t(locale, "settingsSaved")}
            </span>
          </p>
        ) : null}
        <OwnerChipColorPicker
          label={t(locale, "ownerChipColorMy")}
          value={myChipColor}
          fallback={DEFAULT_MY_CHIP_COLOR}
          previewLabel={myDisplayName(locale, myNameInput || userName)}
          onChange={setMyChipColor}
        />
        <Input
          value={partnerInput}
          onChange={(e) => setPartnerInput(e.target.value)}
          placeholder={t(locale, "partnerNamePlaceholder")}
        />
        <Button type="button" variant="secondary" className="w-full" onClick={savePartner}>
          {t(locale, "partnerSave")}
        </Button>
        {savedFlash === "partner" ? (
          <p className="flex justify-center" role="status" aria-live="polite">
            <span className="inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
              {t(locale, "settingsSaved")}
            </span>
          </p>
        ) : null}
        <OwnerChipColorPicker
          label={t(locale, "ownerChipColorPartner")}
          value={partnerChipColor}
          fallback={DEFAULT_PARTNER_CHIP_COLOR}
          previewLabel={
            partnerDisplayName(partnerInput || partnerName) ||
            partnerTabLabel(locale, partnerInput || partnerName, partnerKeywords)
          }
          onChange={setPartnerChipColor}
        />
        <p className="text-xs text-muted-foreground">{t(locale, "ownerChipColorHint")}</p>
        <p className="text-sm font-medium">{t(locale, "partnerKeywordsTitle")}</p>
        <textarea
          value={keywordsInput}
          onChange={(e) => setKeywordsInput(e.target.value)}
          placeholder={t(locale, "partnerKeywordsPlaceholder")}
          rows={3}
          className={cn(
            "flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <Button type="button" variant="secondary" className="w-full" onClick={saveKeywords}>
          {t(locale, "partnerKeywordsSave")}
        </Button>
        {savedFlash === "keywords" ? (
          <p className="flex justify-center" role="status" aria-live="polite">
            <span className="inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
              {t(locale, "settingsSaved")}
            </span>
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t(locale, "partnerKeywordsHint")}</p>
        <UpdateAppButton />
      </div>
    ),
    danger: (
      <div className="space-y-3">
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-950 dark:text-emerald-100">
          {t(locale, "cloudProtectedNotice")}
        </p>
        <p className="text-xs text-muted-foreground">{t(locale, "clearConfirm")}</p>
        <Button variant="destructive" className="w-full" onClick={handleClear} type="button">
          {confirmClear ? t(locale, "clearDataConfirmAgain") : t(locale, "clearData")}
        </Button>
      </div>
    ),
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        {screen !== "menu" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t(locale, "settingsBack")}
            onClick={() => setScreen("menu")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <h2 className="text-lg font-semibold leading-tight">{dialogTitle}</h2>
      </div>

      {screen === "menu" ? (
        <div className="space-y-2">
          {MENU_ITEMS.map((item) => (
            <SettingsMenuRow
              key={item.id}
              title={t(locale, item.titleKey)}
              description={
                item.descriptionKey ? t(locale, item.descriptionKey) : undefined
              }
              danger={item.danger}
              onClick={() => setScreen(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="min-h-[12rem]">{detailContent[screen]}</div>
      )}
    </>
  );
}
