export type PriceData = { [symbol: string]: { [currency: string]: number } };

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Per-type cache lifetimes. Metals and FX move slowly; crypto moves fast.
const CRYPTO_TTL = 5 * 60 * 1000;      // 5 minutes
const FX_TTL = 60 * 60 * 1000;         // 1 hour
const METAL_TTL = 60 * 60 * 1000;      // 1 hour

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

export async function fetchCryptoPrices(
  symbols: string[],
  vsCurrency: string
): Promise<PriceData | null> {
  const normalized = [...symbols].sort().join(',');
  const cacheKey = `crypto:${normalized}:${vsCurrency.toLowerCase()}`;
  const cached = getCached<PriceData>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${symbols.join(',')}&vs_currencies=${vsCurrency}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      console.warn(`[prices] crypto fetch failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as PriceData;
    setCache(cacheKey, data, CRYPTO_TTL);
    return data;
  } catch (err) {
    console.warn('[prices] crypto fetch error:', err);
    return null;
  }
}

// Last-resort fallback values (USD per troy ounce). Only used when the
// upstream API is unreachable. Kept in the realistic current-market range so
// a degraded UI is not wildly off.
const METAL_FALLBACK_USD: Record<string, number> = {
  XAU: 2650,
  XAG: 30,
  XPT: 950,
};

// Fetches a single metal's USD price from api.gold-api.com (keyless, free).
// Cached per-symbol so adding or removing a metal does not invalidate others.
async function fetchMetalUsd(symbol: string): Promise<number | null> {
  const upper = symbol.toUpperCase();
  const cacheKey = `metal-usd:${upper}`;
  const cached = getCached<number>(cacheKey);
  if (cached != null) return cached;

  try {
    const res = await fetch(`https://api.gold-api.com/price/${upper}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { price?: number };
      if (typeof data.price === 'number' && Number.isFinite(data.price)) {
        setCache(cacheKey, data.price, METAL_TTL);
        return data.price;
      }
      console.warn(`[prices] metal ${upper}: malformed response`, data);
    } else {
      console.warn(`[prices] metal ${upper} fetch failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[prices] metal ${upper} fetch error:`, err);
  }

  const fallback = METAL_FALLBACK_USD[upper];
  if (fallback != null) {
    console.warn(`[prices] metal ${upper}: using hardcoded fallback $${fallback}`);
    return fallback;
  }
  return null;
}

export async function fetchMetalPrices(
  symbols: string[],
  vsCurrency: string
): Promise<PriceData | null> {
  const vsLower = vsCurrency.toLowerCase();
  const vsUpper = vsCurrency.toUpperCase();

  const usdPrices = await Promise.all(
    symbols.map(async (sym) => [sym, await fetchMetalUsd(sym)] as const)
  );

  let fxRate = 1;
  if (vsUpper !== 'USD') {
    const rates = await fetchExchangeRates('USD');
    fxRate = rates?.[vsUpper] ?? 1;
  }

  const result: PriceData = {};
  for (const [sym, usdPrice] of usdPrices) {
    if (usdPrice != null) {
      result[sym] = { [vsLower]: usdPrice * fxRate };
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export async function fetchExchangeRates(
  base: string
): Promise<Record<string, number> | null> {
  const cacheKey = `exchange:${base}`;
  const cached = getCached<Record<string, number>>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${base}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      console.warn(`[prices] exchange fetch failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { rates: Record<string, number> };
    setCache(cacheKey, data.rates, FX_TTL);
    return data.rates;
  } catch (err) {
    console.warn('[prices] exchange fetch error:', err);
    return null;
  }
}

// Resolve "1 unit of `currency` is X JPY" for each requested currency. Always
// includes JPY=1. Currencies that fail to resolve are simply omitted; callers
// must decide how to handle a missing rate (typically: skip conversion / keep
// the raw amount, with a warning surfaced earlier).
export async function fetchToJpyRates(
  currencies: Iterable<string>
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  out.set('JPY', 1);
  const need = new Set<string>();
  for (const c of currencies) {
    const upper = (c || 'JPY').toUpperCase();
    if (upper !== 'JPY') need.add(upper);
  }
  if (need.size === 0) return out;

  const rates = await fetchExchangeRates('USD');
  const usdToJpy = rates?.JPY;
  if (!rates || !usdToJpy) return out; // degraded: only JPY known

  for (const c of need) {
    if (c === 'USD') {
      out.set('USD', usdToJpy);
      continue;
    }
    const perUsd = rates[c];
    if (perUsd && Number.isFinite(perUsd) && perUsd > 0) {
      out.set(c, usdToJpy / perUsd);
    }
  }
  return out;
}

// Fetch live JPY prices for the given crypto + metal symbols in parallel.
// Returns two maps keyed by symbol -> JPY-per-unit. Missing entries mean the
// upstream did not return a usable price.
export async function fetchJpyMarketPrices(
  cryptoSymbols: Iterable<string>,
  metalSymbols: Iterable<string>
): Promise<{ crypto: Map<string, number>; metal: Map<string, number> }> {
  const cryptoList = Array.from(new Set([...cryptoSymbols].filter(Boolean)));
  const metalList = Array.from(new Set([...metalSymbols].filter(Boolean)));

  const [cryptoRes, metalRes] = await Promise.all([
    cryptoList.length ? fetchCryptoPrices(cryptoList, 'jpy') : Promise.resolve(null),
    metalList.length ? fetchMetalPrices(metalList, 'jpy') : Promise.resolve(null),
  ]);

  const crypto = new Map<string, number>();
  if (cryptoRes) {
    for (const s of cryptoList) {
      const p = cryptoRes[s]?.jpy;
      if (typeof p === 'number' && Number.isFinite(p)) crypto.set(s, p);
    }
  }
  const metal = new Map<string, number>();
  if (metalRes) {
    for (const s of metalList) {
      const p = metalRes[s]?.jpy;
      if (typeof p === 'number' && Number.isFinite(p)) metal.set(s, p);
    }
  }
  return { crypto, metal };
}
