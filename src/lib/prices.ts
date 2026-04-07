export type PriceData = { [symbol: string]: { [currency: string]: number } };

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function fetchCryptoPrices(
  symbols: string[],
  vsCurrency: string
): Promise<PriceData | null> {
  const cacheKey = `crypto:${symbols.join(',')}:${vsCurrency}`;
  const cached = getCached<PriceData>(cacheKey);
  if (cached) return cached;

  try {
    const ids = symbols.join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrency}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    setCache(cacheKey, data);
    return data as PriceData;
  } catch {
    return null;
  }
}

const METAL_FALLBACK_USD: Record<string, number> = {
  XAU: 12500,
  XAG: 32,
};

export async function fetchMetalPrices(
  symbols: string[],
  vsCurrency: string
): Promise<PriceData | null> {
  const cacheKey = `metal:${symbols.join(',')}:${vsCurrency}`;
  const cached = getCached<PriceData>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.metalpriceapi.com/v1/latest?api_key=free&base=USD&currencies=${symbols.join(',')}`
    );
    if (res.ok) {
      const json = await res.json();
      if (json.rates) {
        const result: PriceData = {};
        for (const sym of symbols) {
          if (json.rates[sym]) {
            result[sym] = { [vsCurrency.toLowerCase()]: 1 / json.rates[sym] };
          }
        }
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch {
    // fall through to fallback
  }

  // Fallback to hardcoded USD prices
  const result: PriceData = {};
  for (const sym of symbols) {
    const usdPrice = METAL_FALLBACK_USD[sym.toUpperCase()];
    if (usdPrice) {
      result[sym] = { [vsCurrency.toLowerCase()]: usdPrice };
    }
  }

  if (vsCurrency.toUpperCase() !== 'USD') {
    const rates = await fetchExchangeRates('USD');
    if (rates) {
      const rate = rates[vsCurrency.toUpperCase()];
      if (rate) {
        for (const sym of Object.keys(result)) {
          const usdVal = result[sym][vsCurrency.toLowerCase()];
          result[sym][vsCurrency.toLowerCase()] = usdVal * rate;
        }
      }
    }
  }

  setCache(cacheKey, result);
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
      `https://api.exchangerate-api.com/v4/latest/${base}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    setCache(cacheKey, data.rates);
    return data.rates as Record<string, number>;
  } catch {
    return null;
  }
}
