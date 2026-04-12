import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const tags = db
    .prepare('SELECT name, color_bg, color_text, sort_order FROM tags ORDER BY sort_order, name')
    .all();
  return Response.json(tags);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, color_bg, color_text, sort_order } = body;

  if (!name || !color_bg || !color_text) {
    return Response.json(
      { error: 'name, color_bg, and color_text are required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db.prepare('SELECT name FROM tags WHERE name = ?').get(name);
  if (existing) {
    return Response.json({ error: 'Tag already exists' }, { status: 409 });
  }

  // If sort_order not supplied, place at end
  let order = sort_order;
  if (typeof order !== 'number') {
    const { max } = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max FROM tags').get() as { max: number };
    order = max + 1;
  }

  db.prepare(
    'INSERT INTO tags (name, color_bg, color_text, sort_order) VALUES (?, ?, ?, ?)'
  ).run(name, color_bg, color_text, order);

  const tag = db.prepare('SELECT name, color_bg, color_text, sort_order FROM tags WHERE name = ?').get(name);
  return Response.json(tag, { status: 201 });
}
