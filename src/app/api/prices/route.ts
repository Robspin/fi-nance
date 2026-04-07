import { NextRequest } from 'next/server';
import {
  fetchCryptoPrices,
  fetchMetalPrices,
  fetchExchangeRates,
} from '@/lib/prices';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type');
  const symbolsParam = searchParams.get('symbols');
  const vs = searchParams.get('vs') ?? 'jpy';
  const base = searchParams.get('base') ?? 'USD';

  if (type === 'crypto') {
    if (!symbolsParam) {
      return Response.json({ error: 'symbols parameter required' }, { status: 400 });
    }
    const symbols = symbolsParam.split(',');
    const prices = await fetchCryptoPrices(symbols, vs);
    return Response.json(prices ?? {});
  }

  if (type === 'metal') {
    if (!symbolsParam) {
      return Response.json({ error: 'symbols parameter required' }, { status: 400 });
    }
    const symbols = symbolsParam.split(',');
    const prices = await fetchMetalPrices(symbols, vs);
    return Response.json(prices ?? {});
  }

  if (type === 'exchange') {
    const rates = await fetchExchangeRates(base);
    return Response.json({ rates: rates ?? {} });
  }

  return Response.json({ error: 'type must be crypto, metal, or exchange' }, { status: 400 });
}
