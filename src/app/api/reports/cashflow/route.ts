import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

interface CashflowRow {
  month: string;
  inflows: number;
  outflows: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const memberId = searchParams.get('member_id');
  const months = parseInt(searchParams.get('months') ?? '12', 10);

  const db = getDb();

  const memberFilter = memberId ? 'AND acc.family_member_id = ?' : '';

  const inflowsSql = `
    SELECT strftime('%Y-%m', le.entry_date) AS month,
      COALESCE(SUM(le.amount), 0) AS inflows
    FROM ledger_entries le
    JOIN accounts acc ON le.account_id = acc.id
    WHERE le.amount > 0 AND le.deleted_at IS NULL AND acc.is_active = 1 ${memberFilter}
    GROUP BY month
    ORDER BY month
  `;
  const inflowsParams: string[] = memberId ? [memberId] : [];
  const inflowsRows = db.prepare(inflowsSql).all(...inflowsParams) as CashflowRow[];

  const outflowsSql = `
    SELECT strftime('%Y-%m', le.entry_date) AS month,
      ABS(COALESCE(SUM(le.amount), 0)) AS outflows
    FROM ledger_entries le
    JOIN accounts acc ON le.account_id = acc.id
    WHERE le.amount < 0 AND le.deleted_at IS NULL AND acc.is_active = 1 ${memberFilter}
    GROUP BY month
    ORDER BY month
  `;
  const outflowsParams: string[] = memberId ? [memberId] : [];
  const outflowsRows = db.prepare(outflowsSql).all(...outflowsParams) as CashflowRow[];

  // Merge inflows and outflows by month
  const monthMap = new Map<string, { inflows: number; outflows: number }>();

  for (const r of inflowsRows) {
    const entry = monthMap.get(r.month) ?? { inflows: 0, outflows: 0 };
    entry.inflows = r.inflows;
    monthMap.set(r.month, entry);
  }

  for (const r of outflowsRows) {
    const entry = monthMap.get(r.month) ?? { inflows: 0, outflows: 0 };
    entry.outflows = r.outflows;
    monthMap.set(r.month, entry);
  }

  const allMonths = Array.from(monthMap.keys()).sort();
  const sliced = allMonths.slice(-months);

  const result = sliced.map((month) => {
    const { inflows, outflows } = monthMap.get(month)!;
    return {
      month,
      inflows,
      outflows,
      net: inflows - outflows,
    };
  });

  return Response.json({ months: result });
}
