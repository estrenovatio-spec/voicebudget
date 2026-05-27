"use client";

import { useEffect } from "react";
import { detectLocale } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

function applyThemeParams(params: Record<string, string | undefined>) {
  const root = document.documentElement;
  const bg = params.bg_color ?? "#ffffff";
  const text = params.text_color ?? "#000000";
  const secondary = params.secondary_bg_color ?? "#f4f4f5";

  root.style.setProperty("--tg-bg", bg);
  root.style.setProperty("--tg-text", text);
  root.style.setProperty("--tg-secondary", secondary);
  document.body.style.backgroundColor = bg;
  document.body.style.color = text;
}

export function TelegramInit() {
  const setLocale = useStore((s) => s.setLocale);
  const setUserName = useStore((s) => s.setUserName);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand();
    applyThemeParams(tg.themeParams);

    const user = tg.initDataUnsafe?.user;
    if (user?.first_name) setUserName(user.first_name);
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
      if (tg.BackButton) {
        tg.BackButton.offClick(onBack);
        tg.BackButton.hide();
      }
    };
  }, [setLocale, setUserName]);

  return null;
}
