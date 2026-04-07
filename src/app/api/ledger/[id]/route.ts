import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Ledger entry not found' }, { status: 404 });
  }

  db.prepare("UPDATE ledger_entries SET deleted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  return Response.json({ success: true });
}
