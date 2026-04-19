import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, role } = body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  db.prepare(
    'UPDATE family_members SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE id = ?'
  ).run(name, role, id);

  const updated = db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
  return Response.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }

  db.transaction(() => {
    const accounts = db.prepare('SELECT id FROM accounts WHERE family_member_id = ?').all(id) as { id: string }[];
    const deleteEntries = db.prepare('DELETE FROM ledger_entries WHERE account_id = ?');
    for (const acc of accounts) {
      deleteEntries.run(acc.id);
    }
    db.prepare('DELETE FROM accounts WHERE family_member_id = ?').run(id);
    db.prepare('DELETE FROM family_members WHERE id = ?').run(id);
  })();

  return Response.json({ success: true });
}
