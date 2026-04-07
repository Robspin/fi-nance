import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, type, icon, sort_order } = body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Category not found' }, { status: 404 });
  }

  db.prepare(
    `UPDATE asset_categories SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      icon = COALESCE(?, icon),
      sort_order = COALESCE(?, sort_order)
    WHERE id = ?`
  ).run(name, type, icon, sort_order, id);

  const updated = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(id);
  return Response.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(id);
  if (!existing) {
    return Response.json({ error: 'Category not found' }, { status: 404 });
  }

  const assets = db.prepare('SELECT id FROM assets WHERE category_id = ?').all(id) as { id: string }[];
  for (const asset of assets) {
    db.prepare('DELETE FROM asset_snapshots WHERE asset_id = ?').run(asset.id);
  }
  db.prepare('DELETE FROM assets WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM asset_categories WHERE id = ?').run(id);

  return Response.json({ success: true });
}
