import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const members = db.prepare('SELECT * FROM family_members ORDER BY created_at').all();
  return Response.json(members);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, role } = body;

  if (!name || !role) {
    return Response.json({ error: 'name and role are required' }, { status: 400 });
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO family_members (id, name, role, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, name, role, now);

  const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
  return Response.json(member, { status: 201 });
}
