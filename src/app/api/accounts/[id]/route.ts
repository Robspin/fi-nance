import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, symbol, currency, notes, is_active } = body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  db.prepare(
    `UPDATE accounts SET
      name = COALESCE(?, name),
      symbol = COALESCE(?, symbol),
      currency = COALESCE(?, currency),
      notes = COALESCE(?, notes),
      is_active = COALESCE(?, is_active)
    WHERE id = ?`
  ).run(name, symbol, currency, notes, is_active ?? null, id);

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  return Response.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  // CASCADE will delete ledger_entries
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return Response.json({ success: true });
}
