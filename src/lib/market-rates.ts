export type MarketRates = {
  usdRub: number;
  eurRub: number;
  btcRub: number;
  updatedAt: string;
};

const CACHE_TTL_MS = 30_000;

let cache: { data: MarketRates; at: number } | null = null;

async function fetchCbrRates(): Promise<{ usdRub: number; eurRub: number }> {
  const res = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("CBR fetch failed");

  const json = (await res.json()) as {
    Valute?: {
      USD?: { Value?: number; Nominal?: number };
      EUR?: { Value?: number; Nominal?: number };
    };
  };

  const usd = json.Valute?.USD;
  const eur = json.Valute?.EUR;
  const usdRub = usd?.Value && usd.Nominal ? usd.Value / usd.Nominal : NaN;
  const eurRub = eur?.Value && eur.Nominal ? eur.Value / eur.Nominal : NaN;

  if (!Number.isFinite(usdRub) || !Number.isFinite(eurRub)) {
    throw new Error("CBR parse failed");
  }

  return { usdRub, eurRub };
}

async function fetchBtcRub(): Promise<number> {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=rub";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("CoinGecko fetch failed");

  const json = (await res.json()) as { bitcoin?: { rub?: number } };
  const btcRub = json.bitcoin?.rub;
  if (!Number.isFinite(btcRub) || !btcRub || btcRub <= 0) {
    throw new Error("CoinGecko parse failed");
  }
  return btcRub;
}

export async function getMarketRates(): Promise<MarketRates> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const [cbr, btcRub] = await Promise.all([fetchCbrRates(), fetchBtcRub()]);
  const data: MarketRates = {
    usdRub: cbr.usdRub,
    eurRub: cbr.eurRub,
    btcRub,
    updatedAt: new Date().toISOString(),
  };
  cache = { data, at: Date.now() };
  return data;
}
