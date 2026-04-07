import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get('account_id');
  const memberId = searchParams.get('member_id');
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const db = getDb();

  let sql = `
    SELECT
      le.*,
      acc.name AS account_name,
      acc.symbol AS account_symbol,
      c.type AS category_type,
      m.name AS member_name
    FROM ledger_entries le
    JOIN accounts acc ON le.account_id = acc.id
    JOIN asset_categories c ON acc.category_id = c.id
    JOIN family_members m ON acc.family_member_id = m.id
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (accountId) {
    conditions.push('le.account_id = ?');
    params.push(accountId);
  }
  if (memberId) {
    conditions.push('acc.family_member_id = ?');
    params.push(memberId);
  }

  conditions.push('le.deleted_at IS NULL');
  sql += ' WHERE ' + conditions.join(' AND ');

  sql += ' ORDER BY le.entry_date DESC, le.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const entries = db.prepare(sql).all(...params);
  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { account_id, entry_date, entry_type, amount, unit_price, description, tag } = body;

  if (!account_id || !entry_date || !entry_type || amount === undefined) {
    return Response.json(
      { error: 'account_id, entry_date, entry_type, and amount are required' },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify account exists
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id);
  if (!account) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  // For 'remove' entries, ensure amount is negative
  const finalAmount = entry_type === 'remove' ? -Math.abs(amount) : Math.abs(amount);

  const { balance: currentBalance } = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS balance FROM ledger_entries WHERE account_id = ? AND deleted_at IS NULL`
  ).get(account_id) as { balance: number };
  const balanceAfter = currentBalance + finalAmount;

  db.prepare(
    `INSERT INTO ledger_entries (id, account_id, entry_date, entry_type, amount, unit_price, description, tag, created_at, balance_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, account_id, entry_date, entry_type, finalAmount, unit_price ?? null, description ?? null, tag ?? null, now, balanceAfter);

  const entry = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(id);
  return Response.json(entry, { status: 201 });
}
