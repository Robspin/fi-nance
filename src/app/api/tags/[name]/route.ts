import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ name: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { name } = await params;
  const currentName = decodeURIComponent(name);
  const body = await request.json();
  const { new_name, color_bg, color_text, sort_order } = body as {
    new_name?: string;
    color_bg?: string;
    color_text?: string;
    sort_order?: number;
  };

  const db = getDb();
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(currentName);
  if (!existing) {
    return Response.json({ error: 'Tag not found' }, { status: 404 });
  }

  const finalName = new_name && new_name !== currentName ? new_name : currentName;

  // If renaming, ensure the new name is free
  if (finalName !== currentName) {
    const clash = db.prepare('SELECT name FROM tags WHERE name = ?').get(finalName);
    if (clash) {
      return Response.json({ error: 'A tag with that name already exists' }, { status: 409 });
    }
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE tags SET
         name = ?,
         color_bg = COALESCE(?, color_bg),
         color_text = COALESCE(?, color_text),
         sort_order = COALESCE(?, sort_order)
       WHERE name = ?`
    ).run(finalName, color_bg ?? null, color_text ?? null, sort_order ?? null, currentName);

    if (finalName !== currentName) {
      db.prepare('UPDATE ledger_entries SET tag = ? WHERE tag = ?').run(finalName, currentName);
    }
  });
  tx();

  const updated = db
    .prepare('SELECT name, color_bg, color_text, sort_order FROM tags WHERE name = ?')
    .get(finalName);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { name } = await params;
  const targetName = decodeURIComponent(name);
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  const db = getDb();
  const existing = db.prepare('SELECT name FROM tags WHERE name = ?').get(targetName);
  if (!existing) {
    return Response.json({ error: 'Tag not found' }, { status: 404 });
  }

  const { count: usage } = db
    .prepare('SELECT COUNT(*) AS count FROM ledger_entries WHERE tag = ? AND deleted_at IS NULL')
    .get(targetName) as { count: number };

  if (usage > 0 && !force) {
    return Response.json(
      {
        error: 'Tag is in use',
        usage,
        hint: 'Pass ?force=1 to clear the tag from affected ledger entries',
      },
      { status: 409 }
    );
  }

  const tx = db.transaction(() => {
    if (usage > 0) {
      db.prepare('UPDATE ledger_entries SET tag = NULL WHERE tag = ?').run(targetName);
    }
    db.prepare('DELETE FROM tags WHERE name = ?').run(targetName);
  });
  tx();

  return Response.json({ success: true, cleared: usage });
}
