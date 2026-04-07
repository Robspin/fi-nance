import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

interface BankCashMonthRow {
  month: string;
  category_type: string;
  cumulative_total: number;
}

interface MarketEntryRow {
  account_id: string;
  category_type: string;
  month: string;
  month_qty: number;
  latest_price: number | null;
}

interface CurrentBankCashRow {
  category_type: string;
  total: number;
}

interface CurrentMarketRow {
  category_type: string;
  total_qty: number;
  latest_price: number | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const memberId = searchParams.get('member_id');
  const months = parseInt(searchParams.get('months') ?? '12', 10);

  const db = getDb();
  const memberJoin = memberId ? 'AND acc.family_member_id = ?' : '';
  const memberParams = memberId ? [memberId] : [];

  // Query 1: Bank/cash cumulative running sum per month (window function)
  const bankCashMonthlySql = `
    WITH monthly_sums AS (
      SELECT
        strftime('%Y-%m', le.entry_date) AS month,
        c.type AS category_type,
        SUM(le.amount) AS month_total
      FROM ledger_entries le
      JOIN accounts acc ON le.account_id = acc.id
      JOIN asset_categories c ON acc.category_id = c.id
      WHERE c.type IN ('bank', 'cash') AND le.deleted_at IS NULL AND acc.is_active = 1 ${memberJoin}
      GROUP BY strftime('%Y-%m', le.entry_date), c.type
    )
    SELECT
      month,
      category_type,
      SUM(month_total) OVER (
        PARTITION BY category_type
        ORDER BY month
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cumulative_total
    FROM monthly_sums
    ORDER BY month
  `;
  const bankCashMonthly = db.prepare(bankCashMonthlySql).all(...memberParams) as BankCashMonthRow[];

  // Query 2: Market entries aggregated per account per month + latest price up to that month
  // Simple approach: get per-account per-month qty sums with a correlated subquery for price
  const marketMonthlySql = `
    SELECT
      acc.id AS account_id,
      c.type AS category_type,
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
      ) AS latest_price
    FROM ledger_entries le
    JOIN accounts acc ON le.account_id = acc.id
    JOIN asset_categories c ON acc.category_id = c.id
    WHERE c.type IN ('crypto', 'precious_metal') AND le.deleted_at IS NULL AND acc.is_active = 1 ${memberJoin}
    GROUP BY acc.id, c.type, strftime('%Y-%m', le.entry_date)
    ORDER BY month
  `;
  const marketMonthlyRaw = db.prepare(marketMonthlySql).all(...memberParams) as MarketEntryRow[];

  // Query 3: Current bank/cash totals
  const currentBankCashSql = `
    SELECT c.type AS category_type, COALESCE(SUM(le.amount), 0) AS total
    FROM ledger_entries le
    JOIN accounts acc ON le.account_id = acc.id
    JOIN asset_categories c ON acc.category_id = c.id
    WHERE c.type IN ('bank', 'cash') AND le.deleted_at IS NULL AND acc.is_active = 1 ${memberJoin}
    GROUP BY c.type
  `;
  const currentBankCash = db.prepare(currentBankCashSql).all(...memberParams) as CurrentBankCashRow[];

  // Query 4: Current crypto/metal totals
  const currentMarketSql = `
    SELECT c.type AS category_type,
      SUM(le.amount) AS total_qty,
      (
        SELECT le2.unit_price FROM ledger_entries le2
        WHERE le2.account_id = acc.id AND le2.unit_price IS NOT NULL AND le2.deleted_at IS NULL
        ORDER BY le2.entry_date DESC, le2.created_at DESC LIMIT 1
      ) AS latest_price
    FROM ledger_entries le
    JOIN accounts acc ON le.account_id = acc.id
    JOIN asset_categories c ON acc.category_id = c.id
    WHERE c.type IN ('crypto', 'precious_metal') AND le.deleted_at IS NULL AND acc.is_active = 1 ${memberJoin}
    GROUP BY acc.id, c.type
  `;
  const currentMarket = db.prepare(currentMarketSql).all(...memberParams) as CurrentMarketRow[];

  // --- JS post-processing ---

  // Compute cumulative market values per month in JS (forward-filling gaps)
  // Step 1: build per-account cumulative qty and latest price across months
  const accountState: Record<string, { qty: number; price: number; type: string }> = {};
  const marketMonthValues: Record<string, { crypto: number; metal: number }> = {};

  // Get sorted unique months from market data
  const marketMonths = [...new Set(marketMonthlyRaw.map(r => r.month))].sort();

  for (const month of marketMonths) {
    const entriesThisMonth = marketMonthlyRaw.filter(r => r.month === month);
    for (const e of entriesThisMonth) {
      if (!accountState[e.account_id]) {
        accountState[e.account_id] = { qty: 0, price: 0, type: e.category_type };
      }
      accountState[e.account_id].qty += e.month_qty;
      if (e.latest_price != null) {
        accountState[e.account_id].price = e.latest_price;
      }
    }
    // Sum across all accounts for this month
    const vals = { crypto: 0, metal: 0 };
    for (const state of Object.values(accountState)) {
      const val = state.qty * state.price;
      if (state.type === 'crypto') vals.crypto += val;
      if (state.type === 'precious_metal') vals.metal += val;
    }
    marketMonthValues[month] = vals;
  }

  // Collect all months from both datasets
  const allMonthsSet = new Set<string>();
  for (const r of bankCashMonthly) allMonthsSet.add(r.month);
  for (const m of marketMonths) allMonthsSet.add(m);
  const allMonths = Array.from(allMonthsSet).sort();
  const slicedMonths = allMonths.slice(-months);

  // Index bank/cash by month
  const bankCashByMonth = new Map<string, { bank: number; cash: number }>();
  for (const r of bankCashMonthly) {
    if (!bankCashByMonth.has(r.month)) bankCashByMonth.set(r.month, { bank: 0, cash: 0 });
    const entry = bankCashByMonth.get(r.month)!;
    if (r.category_type === 'bank') entry.bank = r.cumulative_total;
    if (r.category_type === 'cash') entry.cash = r.cumulative_total;
  }

  // Forward-fill: for months with no entry in a dataset, carry forward the last known value
  // We need per-category forward fill since bank and cash are independent
  let lastBank = 0;
  let lastCash = 0;
  let lastCrypto = 0;
  let lastMetal = 0;

  // Pre-compute forward-filled bank/cash values across ALL months (not just sliced)
  const bankCashFilled = new Map<string, { bank: number; cash: number }>();
  for (const month of allMonths) {
    const bc = bankCashByMonth.get(month);
    if (bc) {
      if (bc.bank !== 0) lastBank = bc.bank;
      if (bc.cash !== 0) lastCash = bc.cash;
    }
    bankCashFilled.set(month, { bank: lastBank, cash: lastCash });
  }

  // Pre-compute forward-filled market values across ALL months
  const marketFilled = new Map<string, { crypto: number; metal: number }>();
  for (const month of allMonths) {
    const mk = marketMonthValues[month];
    if (mk) {
      lastCrypto = mk.crypto;
      lastMetal = mk.metal;
    }
    marketFilled.set(month, { crypto: lastCrypto, metal: lastMetal });
  }

  const monthlyData = slicedMonths.map((month) => {
    const bc = bankCashFilled.get(month) ?? { bank: 0, cash: 0 };
    const mk = marketFilled.get(month) ?? { crypto: 0, metal: 0 };

    const bank_total = bc.bank;
    const cash_total = bc.cash;
    const crypto_total = mk.crypto;
    const metal_total = mk.metal;
    const total_value = bank_total + cash_total + crypto_total + metal_total;
    return { month, total_value, bank_total, cash_total, crypto_total, metal_total };
  });

  // MoM changes
  const monthly = monthlyData.map((data, index) => {
    let mom_change = 0;
    let mom_change_pct = 0;
    if (index > 0) {
      const prev = monthlyData[index - 1];
      mom_change = data.total_value - prev.total_value;
      mom_change_pct = prev.total_value !== 0 ? (mom_change / prev.total_value) * 100 : 0;
    }
    return { ...data, mom_change, mom_change_pct: Math.round(mom_change_pct * 100) / 100 };
  });

  // Current totals
  const current = {
    month: new Date().toISOString().slice(0, 7),
    total_value: 0,
    bank_total: 0,
    cash_total: 0,
    crypto_total: 0,
    metal_total: 0,
  };
  for (const r of currentBankCash) {
    if (r.category_type === 'bank') current.bank_total = r.total;
    if (r.category_type === 'cash') current.cash_total = r.total;
  }
  for (const r of currentMarket) {
    const val = r.total_qty * (r.latest_price ?? 0);
    if (r.category_type === 'crypto') current.crypto_total += val;
    if (r.category_type === 'precious_metal') current.metal_total += val;
  }
  current.total_value = current.bank_total + current.cash_total + current.crypto_total + current.metal_total;

  return Response.json({ monthly, current });
}
