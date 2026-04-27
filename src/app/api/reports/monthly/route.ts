import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { fetchJpyMarketPrices, fetchToJpyRates } from '@/lib/prices';

type AssetType = 'bank' | 'cash' | 'crypto' | 'precious_metal';

interface BankCashDeltaRow {
  account_id: string;
  currency: string | null;
  category_type: 'bank' | 'cash';
  month: string;
  month_total: number;
}

interface MarketDeltaRow {
  account_id: string;
  symbol: string | null;
  currency: string | null;
  category_type: 'crypto' | 'precious_metal';
  month: string;
  month_qty: number;
  price_as_of_month: number | null;
}

interface AccountRow {
  id: string;
  symbol: string | null;
  currency: string | null;
  category_type: AssetType;
  balance: number;
}

const upperCurrency = (c: string | null | undefined) => (c || 'JPY').toUpperCase();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const memberId = searchParams.get('member_id');
  const months = parseInt(searchParams.get('months') ?? '12', 10);

  const db = getDb();
  const memberJoin = memberId ? 'AND acc.family_member_id = ?' : '';
  const memberParams = memberId ? [memberId] : [];

  // Per-account, per-month bank/cash deltas in *account currency*.
  const bankCashRaw = db
    .prepare(
      `SELECT le.account_id, acc.currency, c.type AS category_type,
              strftime('%Y-%m', le.entry_date) AS month,
              SUM(le.amount) AS month_total
       FROM ledger_entries le
       JOIN accounts acc ON le.account_id = acc.id
       JOIN asset_categories c ON acc.category_id = c.id
       WHERE c.type IN ('bank', 'cash')
         AND le.deleted_at IS NULL
         AND COALESCE(acc.is_active, 1) = 1
         ${memberJoin}
       GROUP BY le.account_id, acc.currency, c.type, strftime('%Y-%m', le.entry_date)
       ORDER BY month`
    )
    .all(...memberParams) as BankCashDeltaRow[];

  // Per-account, per-month market deltas (quantity) plus the most recent
  // unit_price reported through that month — used as the historical valuation
  // mark for past months. The current month gets re-marked with live prices
  // below so the chart's tail visually matches the live `current` totals.
  const marketRaw = db
    .prepare(
      `SELECT acc.id AS account_id, acc.symbol, acc.currency, c.type AS category_type,
              strftime('%Y-%m', le.entry_date) AS month,
              SUM(le.amount) AS month_qty,
              (
                SELECT le2.unit_price FROM ledger_entries le2
                WHERE le2.account_id = acc.id
                  AND le2.unit_price IS NOT NULL
                  AND le2.deleted_at IS NULL
                  AND strftime('%Y-%m', le2.entry_date) <= strftime('%Y-%m', le.entry_date)
                ORDER BY le2.entry_date DESC, le2.created_at DESC
                LIMIT 1
              ) AS price_as_of_month
       FROM ledger_entries le
       JOIN accounts acc ON le.account_id = acc.id
       JOIN asset_categories c ON acc.category_id = c.id
       WHERE c.type IN ('crypto', 'precious_metal')
         AND le.deleted_at IS NULL
         AND COALESCE(acc.is_active, 1) = 1
         ${memberJoin}
       GROUP BY acc.id, acc.symbol, acc.currency, c.type, strftime('%Y-%m', le.entry_date)
       ORDER BY month`
    )
    .all(...memberParams) as MarketDeltaRow[];

  // All currently-active accounts in this scope, with their net balance/qty.
  // This is the canonical source for the `current` snapshot — any account
  // missing from the delta queries (e.g. recently created with no entries)
  // still appears here so it isn't silently dropped.
  const currentAccts = db
    .prepare(
      `SELECT acc.id, acc.symbol, acc.currency, c.type AS category_type,
              COALESCE(SUM(le.amount), 0) AS balance
       FROM accounts acc
       JOIN asset_categories c ON acc.category_id = c.id
       LEFT JOIN ledger_entries le ON le.account_id = acc.id AND le.deleted_at IS NULL
       WHERE COALESCE(acc.is_active, 1) = 1
         ${memberJoin}
       GROUP BY acc.id`
    )
    .all(...memberParams) as AccountRow[];

  // Resolve external rates once, in parallel.
  const allCurrencies = new Set<string>();
  for (const a of currentAccts) allCurrencies.add(upperCurrency(a.currency));
  for (const r of bankCashRaw) allCurrencies.add(upperCurrency(r.currency));
  for (const r of marketRaw) allCurrencies.add(upperCurrency(r.currency));

  const cryptoSyms = currentAccts
    .filter((a) => a.category_type === 'crypto' && a.symbol)
    .map((a) => a.symbol as string);
  const metalSyms = currentAccts
    .filter((a) => a.category_type === 'precious_metal' && a.symbol)
    .map((a) => a.symbol as string);

  const [fxRates, livePrices] = await Promise.all([
    fetchToJpyRates(allCurrencies),
    fetchJpyMarketPrices(cryptoSyms, metalSyms),
  ]);
  const fxToJpy = (currency: string | null | undefined) =>
    fxRates.get(upperCurrency(currency)) ?? 1;

  // --- Build historical monthly series ---

  type BankCashState = { balance: number; currency: string; type: 'bank' | 'cash' };
  type MarketState = {
    qty: number;
    price_jpy: number; // most recent stored mark, converted to JPY
    symbol: string | null;
    type: 'crypto' | 'precious_metal';
  };

  const bankCashState = new Map<string, BankCashState>();
  const marketState = new Map<string, MarketState>();

  const bcByMonth = new Map<string, BankCashDeltaRow[]>();
  for (const r of bankCashRaw) {
    if (!bcByMonth.has(r.month)) bcByMonth.set(r.month, []);
    bcByMonth.get(r.month)!.push(r);
  }
  const mktByMonth = new Map<string, MarketDeltaRow[]>();
  for (const r of marketRaw) {
    if (!mktByMonth.has(r.month)) mktByMonth.set(r.month, []);
    mktByMonth.get(r.month)!.push(r);
  }

  const allMonthsSet = new Set<string>();
  for (const m of bcByMonth.keys()) allMonthsSet.add(m);
  for (const m of mktByMonth.keys()) allMonthsSet.add(m);
  const allMonths = Array.from(allMonthsSet).sort();

  const monthSnap = new Map<
    string,
    { bank: number; cash: number; crypto: number; metal: number }
  >();

  for (const month of allMonths) {
    for (const r of bcByMonth.get(month) ?? []) {
      const cur = upperCurrency(r.currency);
      const existing = bankCashState.get(r.account_id);
      if (existing) {
        existing.balance += r.month_total;
      } else {
        bankCashState.set(r.account_id, {
          balance: r.month_total,
          currency: cur,
          type: r.category_type,
        });
      }
    }
    for (const r of mktByMonth.get(month) ?? []) {
      const existing = marketState.get(r.account_id);
      const fx = fxToJpy(r.currency);
      const stampedJpy =
        r.price_as_of_month != null ? r.price_as_of_month * fx : null;
      if (existing) {
        existing.qty += r.month_qty;
        if (stampedJpy != null) existing.price_jpy = stampedJpy;
      } else {
        marketState.set(r.account_id, {
          qty: r.month_qty,
          price_jpy: stampedJpy ?? 0,
          symbol: r.symbol,
          type: r.category_type,
        });
      }
    }

    let bank = 0;
    let cash = 0;
    for (const s of bankCashState.values()) {
      const jpy = s.balance * fxToJpy(s.currency);
      if (s.type === 'bank') bank += jpy;
      else cash += jpy;
    }
    let crypto = 0;
    let metal = 0;
    for (const s of marketState.values()) {
      const value = s.qty * s.price_jpy;
      if (s.type === 'crypto') crypto += value;
      else metal += value;
    }
    monthSnap.set(month, { bank, cash, crypto, metal });
  }

  // --- Current snapshot, with LIVE market prices ---

  let bankCur = 0;
  let cashCur = 0;
  let cryptoCur = 0;
  let metalCur = 0;
  for (const a of currentAccts) {
    const fx = fxToJpy(a.currency);
    if (a.category_type === 'bank') {
      bankCur += a.balance * fx;
    } else if (a.category_type === 'cash') {
      cashCur += a.balance * fx;
    } else if (a.category_type === 'crypto') {
      const live = a.symbol ? livePrices.crypto.get(a.symbol) : undefined;
      const px = live ?? marketState.get(a.id)?.price_jpy ?? 0;
      cryptoCur += a.balance * px;
    } else if (a.category_type === 'precious_metal') {
      const live = a.symbol ? livePrices.metal.get(a.symbol) : undefined;
      const px = live ?? marketState.get(a.id)?.price_jpy ?? 0;
      metalCur += a.balance * px;
    }
  }

  // Re-mark the latest historical month with live prices so the chart's tail
  // and the dashboard's `current` agree to the yen.
  if (allMonths.length > 0) {
    const latest = allMonths[allMonths.length - 1];
    const snap = monthSnap.get(latest);
    if (snap) {
      snap.crypto = cryptoCur;
      snap.metal = metalCur;
      // For bank/cash, prefer the canonical current snapshot too — covers
      // the case where an account had no entries this month but its balance
      // still contributes.
      snap.bank = bankCur;
      snap.cash = cashCur;
    }
  }

  // Slice to the requested window and compute MoM changes.
  const slicedMonths = allMonths.slice(-months);
  const monthlyData = slicedMonths.map((month) => {
    const s = monthSnap.get(month) ?? { bank: 0, cash: 0, crypto: 0, metal: 0 };
    return {
      month,
      total_value: s.bank + s.cash + s.crypto + s.metal,
      bank_total: s.bank,
      cash_total: s.cash,
      crypto_total: s.crypto,
      metal_total: s.metal,
    };
  });

  const monthly = monthlyData.map((data, index) => {
    let mom_change = 0;
    let mom_change_pct = 0;
    if (index > 0) {
      const prev = monthlyData[index - 1];
      mom_change = data.total_value - prev.total_value;
      mom_change_pct =
        prev.total_value !== 0 ? (mom_change / prev.total_value) * 100 : 0;
    }
    return {
      ...data,
      mom_change,
      mom_change_pct: Math.round(mom_change_pct * 100) / 100,
    };
  });

  const current = {
    month: new Date().toISOString().slice(0, 7),
    total_value: bankCur + cashCur + cryptoCur + metalCur,
    bank_total: bankCur,
    cash_total: cashCur,
    crypto_total: cryptoCur,
    metal_total: metalCur,
  };

  return Response.json({ monthly, current });
}
