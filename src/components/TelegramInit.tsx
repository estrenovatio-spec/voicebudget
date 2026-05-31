"use client";

import { useEffect } from "react";
import { applyLightTheme, syncThemeFromTelegram } from "@/lib/app-theme";
import { detectLocale } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

export function TelegramInit() {
  const setLocale = useStore((s) => s.setLocale);
  const ensureTrackingStarted = useStore((s) => s.ensureTrackingStarted);

  useEffect(() => {
    ensureTrackingStarted();

    const tg = window.Telegram?.WebApp;
    if (!tg) {
      applyLightTheme();
      return;
    }

    tg.ready();
    tg.expand();
    const offTheme = syncThemeFromTelegram();

    const user = tg.initDataUnsafe?.user;
    const { userName, userNameCustomized } = useStore.getState();
    if (user?.first_name && !userNameCustomized && !userName?.trim()) {
      useStore.setState({ userName: user.first_name });
    }
    if (user?.language_code) setLocale(detectLocale(user.language_code));

    const onBack = () => {
      window.history.back();
    };
    if (tg.BackButton) {
      tg.BackButton.show();
      tg.BackButton.onClick(onBack);
    }

    const height = tg.viewportStableHeight || tg.viewportHeight;
    if (height) {
      document.documentElement.style.setProperty("--tg-viewport-height", `${height}px`);
    }

    return () => {
      offTheme?.();
      if (tg.BackButton) {
        tg.BackButton.offClick(onBack);
        tg.BackButton.hide();
      }
    };
  }, [ensureTrackingStarted, setLocale]);

  return null;
}
