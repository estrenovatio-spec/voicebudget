"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketRates } from "@/lib/market-rates";
import { useStore } from "@/store/useStore";

const POLL_MS = 30_000;

function formatFiatRate(value: number, locale: "ru" | "en"): string {
  return value.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatBtcUsd(value: number, locale: "ru" | "en"): string {
  return value.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: 0,
  });
}

type RateChipProps = {
  symbol: string;
  value: string;
  flash: boolean;
  className?: string;
};

function RateChip({ symbol, value, flash, className = "" }: RateChipProps) {
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded px-0.5 transition-colors duration-700 tabular-nums ${
        flash ? "bg-emerald-500/15" : ""
      } ${className}`}
    >
      <span className="text-[11px] text-muted-foreground">{symbol}</span>
      <span className="text-xs font-semibold">{value}</span>
    </span>
  );
}

/** Компактные курсы под статусом облака в шапке */
export function LiveRatesBar() {
  const locale = useStore((s) => s.locale);
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState({ usd: false, eur: false, btc: false });
  const prevRef = useRef<MarketRates | null>(null);

  const pulseFlash = useCallback((next: MarketRates) => {
    const prev = prevRef.current;
    if (!prev) return;
    const changed = {
      usd: prev.usdRub !== next.usdRub,
      eur: prev.eurRub !== next.eurRub,
      btc: prev.btcUsd !== next.btcUsd,
    };
    if (!changed.usd && !changed.eur && !changed.btc) return;
    setFlash(changed);
    window.setTimeout(() => setFlash({ usd: false, eur: false, btc: false }), 900);
  }, []);

  const loadRates = useCallback(async () => {
    try {
      const res = await fetch("/api/rates", { cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; rates?: MarketRates };
      if (!res.ok || !json.success || !json.rates) return;
      pulseFlash(json.rates);
      prevRef.current = json.rates;
      setRates(json.rates);
    } catch {
      /* keep last values */
    } finally {
      setLoading(false);
    }
  }, [pulseFlash]);

  useEffect(() => {
    void loadRates();
    const timer = window.setInterval(() => void loadRates(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadRates]);

  if (loading && !rates) {
    return (
      <div className="flex h-8 w-[5.5rem] items-center justify-end">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!rates) return null;

  return (
    <div className="max-w-[9rem] leading-tight" aria-live="polite">
      <div className="flex justify-end gap-x-2.5">
        <RateChip symbol="$" value={formatFiatRate(rates.usdRub, locale)} flash={flash.usd} />
        <RateChip symbol="€" value={formatFiatRate(rates.eurRub, locale)} flash={flash.eur} />
      </div>
      <div className="mt-0.5 flex justify-center">
        <RateChip
          symbol="₿"
          value={`$${formatBtcUsd(rates.btcUsd, locale)}`}
          flash={flash.btc}
        />
      </div>
    </div>
  );
}
