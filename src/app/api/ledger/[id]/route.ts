import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT id, account_id FROM ledger_entries WHERE id = ? AND deleted_at IS NULL').get(id) as
    | { id: string; account_id: string }
    | undefined;
  if (!existing) {
    return Response.json({ error: 'Ledger entry not found' }, { status: 404 });
  }

  db.transaction(() => {
    db.prepare('UPDATE ledger_entries SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);

    const remaining = db.prepare(
      `SELECT id, amount FROM ledger_entries
       WHERE account_id = ? AND deleted_at IS NULL
       ORDER BY entry_date ASC, created_at ASC`
    ).all(existing.account_id) as { id: string; amount: number }[];

    const updateBalance = db.prepare('UPDATE ledger_entries SET balance_after = ? WHERE id = ?');
    let running = 0;
    for (const r of remaining) {
      running += r.amount;
      updateBalance.run(running, r.id);
    }
  })();

  return Response.json({ success: true });
}
