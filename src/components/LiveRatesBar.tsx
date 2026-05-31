"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketRates } from "@/lib/market-rates";
import { t } from "@/lib/i18n";
import { useStore } from "@/store/useStore";

const POLL_MS = 30_000;

function formatFiatRate(value: number, locale: "ru" | "en"): string {
  return value.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBtcRate(value: number, locale: "ru" | "en"): string {
  return value.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 0,
  });
}

type RateItemProps = {
  label: string;
  value: string;
  flash: boolean;
};

function RateItem({ label, value, flash }: RateItemProps) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1 transition-colors duration-700 ${
        flash ? "bg-emerald-500/15" : "bg-transparent"
      }`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums leading-none">{value}</span>
    </div>
  );
}

export function LiveRatesBar() {
  const locale = useStore((s) => s.locale);
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState({ usd: false, eur: false, btc: false });
  const prevRef = useRef<MarketRates | null>(null);

  const pulseFlash = useCallback((next: MarketRates) => {
    const prev = prevRef.current;
    if (!prev) return;
    const changed = {
      usd: prev.usdRub !== next.usdRub,
      eur: prev.eurRub !== next.eurRub,
      btc: prev.btcRub !== next.btcRub,
    };
    if (!changed.usd && !changed.eur && !changed.btc) return;
    setFlash(changed);
    window.setTimeout(() => setFlash({ usd: false, eur: false, btc: false }), 900);
  }, []);

  const loadRates = useCallback(async () => {
    try {
      const res = await fetch("/api/rates", { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; rates?: MarketRates };
      if (!res.ok || !json.success || !json.rates) {
        setError(true);
        return;
      }
      pulseFlash(json.rates);
      prevRef.current = json.rates;
      setRates(json.rates);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [pulseFlash]);

  useEffect(() => {
    void loadRates();
    const timer = window.setInterval(() => void loadRates(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadRates]);

  return (
    <div className="rounded-lg border bg-muted/20 px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-medium text-muted-foreground">{t(locale, "liveRatesTitle")}</p>
        {loading && !rates ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {rates ? (
        <div className="grid grid-cols-3 gap-1">
          <RateItem
            label={t(locale, "liveRatesUsd")}
            value={`${formatFiatRate(rates.usdRub, locale)} ₽`}
            flash={flash.usd}
          />
          <RateItem
            label={t(locale, "liveRatesEur")}
            value={`${formatFiatRate(rates.eurRub, locale)} ₽`}
            flash={flash.eur}
          />
          <RateItem
            label={t(locale, "liveRatesBtc")}
            value={`${formatBtcRate(rates.btcRub, locale)} ₽`}
            flash={flash.btc}
          />
        </div>
      ) : error ? (
        <p className="px-1 text-xs text-muted-foreground">{t(locale, "liveRatesUnavailable")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      )}
    </div>
  );
}
