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
