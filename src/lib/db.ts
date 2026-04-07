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

  // Migration: add is_active to accounts
  const accCols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!accCols.some(c => c.name === 'is_active')) {
    db.exec("ALTER TABLE accounts ADD COLUMN is_active INTEGER DEFAULT 1");
  }

  // Migration: if old 'assets' table exists, drop it (seed will recreate data)
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('assets', 'asset_snapshots')"
  ).all() as { name: string }[];
  for (const t of tables) {
    db.exec(`DROP TABLE IF EXISTS ${t.name}`);
  }

  return db;
}
