import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';

interface SnapshotRow {
  date: string;
  member: string;
  category: string;
  account: string;
  symbol: string | null;
  currency: string;
  amount: number;
  unitPriceJPY: number | null;
}

const ROLE_MAP: Record<string, string> = {
  robin: 'me',
  shino: 'wife',
};

const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
  bank: { name: 'Bank Accounts', icon: '🏦', sort_order: 0 },
  cash: { name: 'Cash', icon: '💴', sort_order: 1 },
  crypto: { name: 'Cryptocurrency', icon: '₿', sort_order: 2 },
  precious_metal: { name: 'Precious Metals', icon: '🥇', sort_order: 3 },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const wipeFirst = formData.get('wipe') === 'true';

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'File too large (max 10 MB)' }, { status: 413 });
  }

  if (!file.name.endsWith('.xlsx')) {
    return Response.json({ error: 'Only .xlsx files are supported' }, { status: 400 });
  }

  let workbook: ExcelJS.Workbook;
  try {
    const arrayBuffer = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    return Response.json({ error: 'Failed to parse xlsx file' }, { status: 400 });
  }

  const sheet = workbook.getWorksheet('Snapshots');
  if (!sheet) {
    return Response.json({ error: 'No "Snapshots" sheet found' }, { status: 400 });
  }

  // Parse rows
  const rows: SnapshotRow[] = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // skip header
    const date = String(row.getCell(1).value ?? '').trim();
    const member = String(row.getCell(2).value ?? '').trim();
    const category = String(row.getCell(3).value ?? '').trim();
    const account = String(row.getCell(4).value ?? '').trim();
    const symbol = row.getCell(5).value ? String(row.getCell(5).value).trim() : null;
    const currency = String(row.getCell(6).value ?? 'JPY').trim();
    const amount = Number(row.getCell(7).value) || 0;
    const unitPriceJPY = row.getCell(8).value != null ? Number(row.getCell(8).value) : null;

    if (!date || !member || !category || !account) return;
    rows.push({ date, member, category, account, symbol, currency, amount, unitPriceJPY });
  });

  if (rows.length === 0) {
    return Response.json({ error: 'No data rows found' }, { status: 400 });
  }

  const db = getDb();

  // All mutations happen inside a single transaction for atomicity
  const result = db.transaction(() => {
    // Optionally wipe existing data
    if (wipeFirst) {
      db.exec('DELETE FROM ledger_entries');
      db.exec('DELETE FROM accounts');
      db.exec('DELETE FROM family_members');
      db.exec('DELETE FROM asset_categories');
    }

    // Ensure members exist
    const memberIds = new Map<string, string>();
    const existingMembers = db.prepare('SELECT id, name FROM family_members').all() as { id: string; name: string }[];
    for (const m of existingMembers) {
      memberIds.set(m.name.toLowerCase(), m.id);
    }

    let membersCreated = 0;
    const uniqueMembers = [...new Set(rows.map(r => r.member))];
    for (const name of uniqueMembers) {
      if (!memberIds.has(name.toLowerCase())) {
        const id = uuidv4();
        const role = ROLE_MAP[name.toLowerCase()] || 'me';
        db.prepare('INSERT INTO family_members (id, name, role, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(id, name, role);
        memberIds.set(name.toLowerCase(), id);
        membersCreated++;
      }
    }

    // Ensure categories exist
    const categoryIds = new Map<string, string>();
    const existingCats = db.prepare('SELECT id, type FROM asset_categories').all() as { id: string; type: string }[];
    for (const c of existingCats) {
      categoryIds.set(c.type, c.id);
    }

    let categoriesCreated = 0;
    const uniqueCategories = [...new Set(rows.map(r => r.category))];
    for (const catType of uniqueCategories) {
      if (!categoryIds.has(catType)) {
        const id = uuidv4();
        const defaults = CATEGORY_DEFAULTS[catType] || { name: catType, icon: '📁', sort_order: 99 };
        db.prepare('INSERT INTO asset_categories (id, name, type, icon, sort_order) VALUES (?, ?, ?, ?, ?)').run(id, defaults.name, catType, defaults.icon, defaults.sort_order);
        categoryIds.set(catType, id);
        categoriesCreated++;
      }
    }

    // Ensure accounts exist (keyed by member + account name + category)
    const accountIds = new Map<string, string>();
    const existingAccounts = db.prepare(`
      SELECT acc.id, acc.name, acc.family_member_id, c.type AS category_type
      FROM accounts acc JOIN asset_categories c ON acc.category_id = c.id
    `).all() as { id: string; name: string; family_member_id: string; category_type: string }[];

    for (const a of existingAccounts) {
      const key = `${a.family_member_id}|${a.category_type}|${a.name}`;
      accountIds.set(key, a.id);
    }

    let accountsCreated = 0;
    for (const row of rows) {
      const memberId = memberIds.get(row.member.toLowerCase())!;
      const catId = categoryIds.get(row.category)!;
      const key = `${memberId}|${row.category}|${row.account}`;
      if (!accountIds.has(key)) {
        const id = uuidv4();
        db.prepare(
          'INSERT INTO accounts (id, category_id, family_member_id, name, symbol, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
        ).run(id, catId, memberId, row.account, row.symbol, row.currency);
        accountIds.set(key, id);
        accountsCreated++;
      }
    }

    // Group rows by account, sort by date, compute deltas and write ledger entries
    const grouped = new Map<string, SnapshotRow[]>();
    for (const row of rows) {
      const memberId = memberIds.get(row.member.toLowerCase())!;
      const key = `${memberId}|${row.category}|${row.account}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    let entryCount = 0;
    const insertEntry = db.prepare(`
      INSERT INTO ledger_entries (id, account_id, entry_date, entry_type, amount, unit_price, description, tag, balance_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const [key, snapshots] of grouped) {
      const accountId = accountIds.get(key)!;
      snapshots.sort((a, b) => a.date.localeCompare(b.date));

      let prevAmount = 0;
      for (const snap of snapshots) {
        const delta = snap.amount - prevAmount;
        const isQuantityType = snap.category === 'crypto' || snap.category === 'precious_metal';

        // Skip zero-to-zero transitions for non-quantity types
        if (delta === 0 && !isQuantityType) {
          prevAmount = snap.amount;
          continue;
        }

        // For quantity types with delta=0, record a price snapshot
        if (delta === 0 && isQuantityType) {
          insertEntry.run(
            uuidv4(), accountId, snap.date, 'adjustment', 0,
            snap.unitPriceJPY, 'Monthly snapshot', null, snap.amount
          );
          entryCount++;
          prevAmount = snap.amount;
          continue;
        }

        const entryType = delta > 0 ? 'add' : 'remove';
        insertEntry.run(
          uuidv4(), accountId, snap.date, entryType, delta,
          isQuantityType ? snap.unitPriceJPY : null,
          'Monthly snapshot', null, snap.amount
        );
        entryCount++;
        prevAmount = snap.amount;
      }
    }

    return {
      rows_parsed: rows.length,
      members_created: membersCreated,
      categories_created: categoriesCreated,
      accounts_created: accountsCreated,
      ledger_entries_created: entryCount,
    };
  })();

  return Response.json({ success: true, summary: result });
}
