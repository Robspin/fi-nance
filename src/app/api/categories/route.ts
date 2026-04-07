import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM asset_categories ORDER BY sort_order').all();
  return Response.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, type, icon, sort_order } = body;

  if (!name || !type) {
    return Response.json({ error: 'name and type are required' }, { status: 400 });
  }

  const db = getDb();
  const id = uuidv4();

  db.prepare(
    'INSERT INTO asset_categories (id, name, type, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, type, icon ?? null, sort_order ?? 0);

  const category = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(id);
  return Response.json(category, { status: 201 });
}
