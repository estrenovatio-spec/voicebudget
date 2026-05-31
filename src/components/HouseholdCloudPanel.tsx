"use client";

import { useEffect, useRef, useState } from "react";
import { CloudSyncActions } from "@/components/CloudSyncActions";
import { PaywallPanel } from "@/components/PaywallPanel";
import { PromoCodeRedeem } from "@/components/PromoCodeRedeem";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runHouseholdBootstrap } from "@/lib/cloud/bootstrap";
import { hasCloudAuth } from "@/lib/cloud/auth-payload";
import { useHouseholdCloud } from "@/hooks/useHouseholdCloud";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const TG_BOT = process.env.NEXT_PUBLIC_TG_BOT_NAME?.replace(/^@/, "") ?? "";

function mapCloudError(locale: "ru" | "en", error: string): string {
  const key =
    error === "database_not_configured" || error === "db_unavailable"
      ? "cloudErrDbUnavailable"
      : error === "telegram_required"
        ? "cloudErrTelegram"
        : error === "invalid_init_data"
          ? "cloudErrTelegramAuth"
          : error === "not_found" || error === "household_not_found" || error === "invalid_code"
            ? "cloudErrInviteCode"
            : error === "unauthorized" || error === "forbidden"
              ? "cloudErrUnauthorized"
              : error === "subscription_required"
                ? "paywallTitle"
                : "cloudErrGeneric";
  const text = t(locale, key);
  if (key === "cloudErrGeneric" && error && error !== "create_failed") {
    return `${text} Код: ${error}`;
  }
  return text;
}

export function HouseholdCloudPanel() {
  const locale = useStore((s) => s.locale);
  const partnerName = useStore((s) => s.partnerName);
  const {
    loading,
    error,
    household,
    serverConfigured,
    createHousehold,
    joinHousehold,
    loginWithTelegramWeb,
    attachExistingCloud,
    isTelegram,
    isActive,
    subscription,
    subscriptionRequired,
  } = useHouseholdCloud();

  const [mode, setMode] = useState<"solo" | "shared">("solo");
  const [joinCode, setJoinCode] = useState("");
  const [partnerLabel, setPartnerLabel] = useState(partnerName ?? "");
  const [showNewHousehold, setShowNewHousehold] = useState(false);
  const autoAttachStarted = useRef(false);

  const loggedInWeb = !isTelegram && hasCloudAuth() && !isActive;

  useEffect(() => {
    if (!loggedInWeb || isActive || autoAttachStarted.current) return;
    autoAttachStarted.current = true;
    void attachExistingCloud();
  }, [loggedInWeb, isActive, attachExistingCloud]);

  if (subscriptionRequired && subscription) {
    return (
      <div className="space-y-3">
        <PaywallPanel subscription={subscription} />
        {household && (
          <p className="text-xs text-muted-foreground">{t(locale, "paywallHouseholdPaused")}</p>
        )}
        {error && <p className="text-xs text-destructive">{mapCloudError(locale, error)}</p>}
      </div>
    );
  }

  if (!isTelegram && !isActive && !hasCloudAuth()) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t(locale, "cloudWebLoginTitle")}</p>
          <p className="text-xs text-muted-foreground">{t(locale, "cloudWebLoginHint")}</p>
        </div>
        <TelegramLoginButton
          botUsername={TG_BOT}
          onAuth={(user) => void loginWithTelegramWeb(user)}
        />
        {error && <p className="text-xs text-destructive">{mapCloudError(locale, error)}</p>}
      </div>
    );
  }

  if (isActive && household) {
    const expiresLabel =
      subscription?.expiresAt &&
      new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(subscription.expiresAt));

    return (
      <div className="min-w-0 space-y-3 overflow-hidden rounded-lg border bg-muted/30 p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t(locale, "cloudActiveTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {household.mode === "solo"
              ? t(locale, "cloudModeSolo")
              : t(locale, "cloudModeShared")}
            {" · "}
            {t(locale, "cloudMembers", { count: String(household.memberCount) })}
          </p>
          {subscription?.enforced && expiresLabel && (
            <p className="text-xs text-muted-foreground">
              {t(locale, "paywallActiveUntil", { date: expiresLabel })}
            </p>
          )}
        </div>

        {household.mode === "shared" || household.memberCount < 2 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t(locale, "cloudInviteHint")}</p>
            <p className="font-mono text-lg font-semibold tracking-widest">
              {household.inviteCode}
            </p>
          </div>
        ) : null}

        <CloudSyncActions embedded />

        {subscription?.enforced && subscription.active && (
          <PromoCodeRedeem compact onRedeemed={() => void runHouseholdBootstrap()} />
        )}

        {error && <p className="text-xs text-destructive">{mapCloudError(locale, error)}</p>}
      </div>
    );
  }

  if (loggedInWeb && !showNewHousehold) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t(locale, "cloudWebAttachTitle")}</p>
          <p className="text-xs text-muted-foreground">{t(locale, "cloudWebAttachHint")}</p>
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={loading}
          onClick={() => void attachExistingCloud()}
        >
          {loading ? t(locale, "cloudWebAttachLoading") : t(locale, "cloudWebAttachBtn")}
        </Button>
        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline"
          onClick={() => setShowNewHousehold(true)}
        >
          {t(locale, "cloudWebCreateAnyway")}
        </button>
        {error && <p className="text-xs text-destructive">{mapCloudError(locale, error)}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      {serverConfigured === false && (
        <p className="rounded-md border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {t(locale, "cloudNotConfigured")}
        </p>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{t(locale, "cloudTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {loggedInWeb ? t(locale, "cloudHintNewHousehold") : t(locale, "cloudHint")}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "solo" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("solo")}
        >
          {t(locale, "cloudSolo")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "shared" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setMode("shared")}
        >
          {t(locale, "cloudShared")}
        </Button>
      </div>

      {mode === "solo" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t(locale, "cloudSoloHint")}</p>
          <Input
            value={partnerLabel}
            onChange={(e) => setPartnerLabel(e.target.value)}
            placeholder={t(locale, "partnerNamePlaceholder")}
          />
        </div>
      )}

      {mode === "shared" && (
        <p className="text-xs text-muted-foreground">{t(locale, "cloudSharedHint")}</p>
      )}

      <Button
        type="button"
        className="w-full"
        disabled={loading}
        onClick={() =>
          void createHousehold({
            mode,
            partnerLabel: mode === "solo" ? partnerLabel.trim() || null : null,
          })
        }
      >
        {t(locale, "cloudCreate")}
      </Button>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium">{t(locale, "cloudJoinTitle")}</p>
        <Input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={t(locale, "cloudJoinPlaceholder")}
          className="font-mono uppercase"
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loading || joinCode.trim().length < 4}
          onClick={() => void joinHousehold(joinCode)}
        >
          {t(locale, "cloudJoin")}
        </Button>
      </div>

      {loggedInWeb && (
        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline"
          onClick={() => {
            setShowNewHousehold(false);
            void attachExistingCloud();
          }}
        >
          {t(locale, "cloudWebBackToAttach")}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{mapCloudError(locale, error)}</p>}

      {subscription?.enforced && subscription.active && (
        <PromoCodeRedeem compact onRedeemed={() => void runHouseholdBootstrap()} />
      )}
    </div>
  );
}
