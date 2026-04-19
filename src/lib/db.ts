import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'finance.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('me', 'wife', 'child')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bank', 'cash', 'crypto', 'precious_metal')),
      icon TEXT,
      sort_order INTEGER DEFAULT 0
    );

    -- Accounts represent named holdings (a bank account, a crypto wallet, etc.)
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES asset_categories(id),
      family_member_id TEXT NOT NULL REFERENCES family_members(id),
      name TEXT NOT NULL,
      symbol TEXT,
      currency TEXT DEFAULT 'JPY',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Immutable ledger entries. Every add/remove is a new row.
    -- For bank/cash: amount = JPY value (positive = deposit, negative = withdrawal)
    -- For crypto/metal: amount = quantity (positive = buy, negative = sell),
    --   unit_price = price per unit at time of transaction
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      entry_date TEXT NOT NULL,
      entry_type TEXT NOT NULL CHECK(entry_type IN ('add', 'remove', 'adjustment')),
      amount REAL NOT NULL,
      unit_price REAL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_account
      ON ledger_entries(account_id);
    CREATE INDEX IF NOT EXISTS idx_ledger_date
      ON ledger_entries(entry_date);
    CREATE INDEX IF NOT EXISTS idx_ledger_account_date
      ON ledger_entries(account_id, entry_date);

    -- Tag registry. ledger_entries.tag stores the name directly (TEXT);
    -- this table holds display metadata (colors, ordering).
    CREATE TABLE IF NOT EXISTS tags (
      name TEXT PRIMARY KEY,
      color_bg TEXT NOT NULL,
      color_text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: add 'tag' column to ledger_entries if missing
  const leCols = db.prepare("PRAGMA table_info(ledger_entries)").all() as { name: string }[];
  if (!leCols.some(c => c.name === 'tag')) {
    db.exec("ALTER TABLE ledger_entries ADD COLUMN tag TEXT");
  }

  // Migration: add deleted_at to ledger_entries
  if (!leCols.some(c => c.name === 'deleted_at')) {
    db.exec("ALTER TABLE ledger_entries ADD COLUMN deleted_at TEXT");
  }

  // Migration: add balance_after to ledger_entries
  if (!leCols.some(c => c.name === 'balance_after')) {
    db.exec("ALTER TABLE ledger_entries ADD COLUMN balance_after REAL");
  }

  // Migration: add is_active to accounts (defaults to 1; backfill any NULLs)
  const accCols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!accCols.some(c => c.name === 'is_active')) {
    db.exec("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1");
  }
  db.exec("UPDATE accounts SET is_active = 1 WHERE is_active IS NULL");

  // Migration: if old 'assets' table exists, drop it (seed will recreate data)
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('assets', 'asset_snapshots')"
  ).all() as { name: string }[];
  for (const t of tables) {
    db.exec(`DROP TABLE IF EXISTS ${t.name}`);
  }

  // Seed default tags on first boot (empty table only — never overwrites user edits)
  const { count: tagCount } = db.prepare('SELECT COUNT(*) AS count FROM tags').get() as { count: number };
  if (tagCount === 0) {
    const insertTag = db.prepare(
      'INSERT INTO tags (name, color_bg, color_text, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (let i = 0; i < DEFAULT_TAGS.length; i++) {
      const t = DEFAULT_TAGS[i];
      insertTag.run(t.name, t.color_bg, t.color_text, i);
    }
  }

  return db;
}

// Default tag palette. Used on first boot and by `npm run seed`.
// Keep in sync with src/scripts/seed.ts.
export const DEFAULT_TAGS: { name: string; color_bg: string; color_text: string }[] = [
  { name: 'salary',     color_bg: 'rgba(0,255,65,0.15)',   color_text: '#00FF41' },
  { name: 'bonus',      color_bg: 'rgba(0,204,51,0.1)',    color_text: '#00CC33' },
  { name: 'rent',       color_bg: 'rgba(255,0,0,0.15)',    color_text: '#FF0000' },
  { name: 'insurance',  color_bg: 'rgba(255,72,0,0.15)',   color_text: '#FF4800' },
  { name: 'utilities',  color_bg: 'rgba(255,160,0,0.15)',  color_text: '#FFA000' },
  { name: 'groceries',  color_bg: 'rgba(0,200,255,0.15)',  color_text: '#00C8FF' },
  { name: 'dining',     color_bg: 'rgba(123,47,190,0.15)', color_text: '#9B59B6' },
  { name: 'atm',        color_bg: 'rgba(180,180,180,0.15)', color_text: '#AAAAAA' },
  { name: 'investment', color_bg: 'rgba(0,255,255,0.15)',  color_text: '#00FFFF' },
  { name: 'gift',       color_bg: 'rgba(255,180,100,0.15)', color_text: '#FFB464' },
  { name: 'allowance',  color_bg: 'rgba(0,204,51,0.15)',   color_text: '#00CC33' },
  { name: 'shopping',   color_bg: 'rgba(123,47,190,0.15)', color_text: '#7B2FBE' },
  { name: 'travel',     color_bg: 'rgba(100,150,255,0.15)', color_text: '#6496FF' },
  { name: 'market',     color_bg: 'rgba(0,204,153,0.15)',  color_text: '#00CC99' },
  { name: 'other',      color_bg: 'rgba(150,150,150,0.15)', color_text: '#969696' },
];
