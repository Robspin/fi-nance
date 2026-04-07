import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const memberId = searchParams.get('member_id');
  const categoryId = searchParams.get('category_id');

  const db = getDb();

  let sql = `
    SELECT
      acc.*,
      c.name AS category_name,
      c.type AS category_type,
      m.name AS member_name,
      COALESCE(SUM(le.amount), 0) AS balance,
      CASE
        WHEN c.type IN ('crypto', 'precious_metal')
        THEN COALESCE(SUM(le.amount), 0)
        ELSE 0
      END AS quantity,
      CASE
        WHEN c.type IN ('crypto', 'precious_metal') AND COALESCE(SUM(CASE WHEN le.amount > 0 THEN le.amount ELSE 0 END), 0) > 0
        THEN COALESCE(
          SUM(CASE WHEN le.amount > 0 THEN le.amount * le.unit_price ELSE 0 END)
          / NULLIF(SUM(CASE WHEN le.amount > 0 THEN le.amount ELSE 0 END), 0),
          0
        )
        ELSE 0
      END AS avg_unit_price,
      CASE
        WHEN c.type IN ('crypto', 'precious_metal')
        THEN COALESCE(SUM(CASE WHEN le.amount > 0 THEN le.amount * le.unit_price ELSE 0 END), 0)
        ELSE 0
      END AS cost_basis
    FROM accounts acc
    JOIN asset_categories c ON acc.category_id = c.id
    JOIN family_members m ON acc.family_member_id = m.id
    LEFT JOIN ledger_entries le ON le.account_id = acc.id AND le.deleted_at IS NULL
  `;

  const conditions: string[] = [];
  const params: string[] = [];

  if (memberId) {
    conditions.push('acc.family_member_id = ?');
    params.push(memberId);
  }
  if (categoryId) {
    conditions.push('acc.category_id = ?');
    params.push(categoryId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY acc.id ORDER BY acc.created_at';

  const accounts = db.prepare(sql).all(...params);
  return Response.json(accounts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { category_id, family_member_id, name, symbol, currency, notes } = body;

  if (!category_id || !family_member_id || !name) {
    return Response.json(
      { error: 'category_id, family_member_id, and name are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO accounts (id, category_id, family_member_id, name, symbol, currency, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, category_id, family_member_id, name, symbol ?? null, currency ?? 'JPY', notes ?? null, now);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return Response.json(account, { status: 201 });
}
