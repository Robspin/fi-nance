import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'finance.db');

// Remove existing DB for clean seed
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  // Clean WAL/SHM files too
  for (const ext of ['-wal', '-shm']) {
    const f = dbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

const db = new Database(dbPath);

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

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES asset_categories(id),
    family_member_id TEXT NOT NULL REFERENCES family_members(id),
    name TEXT NOT NULL,
    symbol TEXT,
    currency TEXT DEFAULT 'JPY',
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('add', 'remove', 'adjustment')),
    amount REAL NOT NULL,
    unit_price REAL,
    description TEXT,
    tag TEXT,
    balance_after REAL,
    deleted_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(entry_date);
  CREATE INDEX IF NOT EXISTS idx_ledger_account_date ON ledger_entries(account_id, entry_date);

  CREATE TABLE IF NOT EXISTS tags (
    name TEXT PRIMARY KEY,
    color_bg TEXT NOT NULL,
    color_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log('Tables created.');

// Seed default tag palette
const DEFAULT_TAGS = [
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
const insertTag = db.prepare(
  'INSERT INTO tags (name, color_bg, color_text, sort_order) VALUES (?, ?, ?, ?)'
);
for (let i = 0; i < DEFAULT_TAGS.length; i++) {
  const t = DEFAULT_TAGS[i];
  insertTag.run(t.name, t.color_bg, t.color_text, i);
}
console.log(`Created ${DEFAULT_TAGS.length} tags.`);

// Create categories
const categories = [
  { id: uuidv4(), name: 'Bank Accounts', type: 'bank', icon: '🏦', sort_order: 0 },
  { id: uuidv4(), name: 'Cash', type: 'cash', icon: '💴', sort_order: 1 },
  { id: uuidv4(), name: 'Cryptocurrency', type: 'crypto', icon: '₿', sort_order: 2 },
  { id: uuidv4(), name: 'Precious Metals', type: 'precious_metal', icon: '🥇', sort_order: 3 },
];

const insertCategory = db.prepare(
  'INSERT INTO asset_categories (id, name, type, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
);
for (const c of categories) {
  insertCategory.run(c.id, c.name, c.type, c.icon, c.sort_order);
}
console.log(`Created ${categories.length} categories.`);

const catByType = Object.fromEntries(categories.map((c) => [c.type, c.id]));

// Create members
const members = [
  { id: uuidv4(), name: 'Me', role: 'me' },
  { id: uuidv4(), name: 'Wife', role: 'wife' },
  { id: uuidv4(), name: 'Child 1', role: 'child' },
];

const insertMember = db.prepare(
  "INSERT INTO family_members (id, name, role, created_at) VALUES (?, ?, ?, datetime('now'))"
);
for (const m of members) {
  insertMember.run(m.id, m.name, m.role);
}
console.log(`Created ${members.length} members.`);

const [me, wife, child] = members;

// Create accounts
const accounts = [
  { id: uuidv4(), category_id: catByType['bank'], family_member_id: me.id, name: 'Savings Account', symbol: null, currency: 'JPY', notes: null },
  { id: uuidv4(), category_id: catByType['cash'], family_member_id: me.id, name: 'Wallet Cash', symbol: null, currency: 'JPY', notes: null },
  { id: uuidv4(), category_id: catByType['crypto'], family_member_id: me.id, name: 'Bitcoin', symbol: 'bitcoin', currency: 'JPY', notes: null },
  { id: uuidv4(), category_id: catByType['precious_metal'], family_member_id: me.id, name: 'Gold', symbol: 'XAU', currency: 'JPY', notes: '1 oz bars' },
  { id: uuidv4(), category_id: catByType['bank'], family_member_id: wife.id, name: 'Savings Account', symbol: null, currency: 'JPY', notes: null },
  { id: uuidv4(), category_id: catByType['cash'], family_member_id: wife.id, name: 'Wallet Cash', symbol: null, currency: 'JPY', notes: null },
  { id: uuidv4(), category_id: catByType['bank'], family_member_id: child.id, name: 'Junior Savings', symbol: null, currency: 'JPY', notes: null },
];

const insertAccount = db.prepare(
  'INSERT INTO accounts (id, category_id, family_member_id, name, symbol, currency, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
);
for (const a of accounts) {
  insertAccount.run(a.id, a.category_id, a.family_member_id, a.name, a.symbol, a.currency, a.notes);
}
console.log(`Created ${accounts.length} accounts.`);

const [meSavings, meCash, meBtc, meGold, wifeSavings, wifeCash, childSavings] = accounts;

// Create ledger entries — a realistic 6-month history
const insertEntry = db.prepare(
  `INSERT INTO ledger_entries (id, account_id, entry_date, entry_type, amount, unit_price, description, tag, created_at, balance_after)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
);

const today = new Date();
function monthDate(monthsAgo: number, day = 1): string {
  const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
  return d.toISOString().slice(0, 10);
}

const runningBalances = new Map<string, number>();
let entryCount = 0;
function addEntry(accountId: string, date: string, type: 'add' | 'remove' | 'adjustment', amount: number, unitPrice: number | null, desc: string, tag: string | null = null) {
  const prev = runningBalances.get(accountId) ?? 0;
  const balanceAfter = prev + amount;
  runningBalances.set(accountId, balanceAfter);
  insertEntry.run(uuidv4(), accountId, date, type, amount, unitPrice, desc, tag, balanceAfter);
  entryCount++;
}

// Me - Savings Account: salary deposits and expenses over 6 months
addEntry(meSavings.id, monthDate(5, 25), 'add', 500000, null, 'Salary', 'salary');
addEntry(meSavings.id, monthDate(5, 28), 'remove', -120000, null, 'Rent', 'rent');
addEntry(meSavings.id, monthDate(4, 25), 'add', 500000, null, 'Salary', 'salary');
addEntry(meSavings.id, monthDate(4, 28), 'remove', -120000, null, 'Rent', 'rent');
addEntry(meSavings.id, monthDate(4, 15), 'add', 200000, null, 'Bonus', 'bonus');
addEntry(meSavings.id, monthDate(3, 25), 'add', 500000, null, 'Salary', 'salary');
addEntry(meSavings.id, monthDate(3, 28), 'remove', -120000, null, 'Rent', 'rent');
addEntry(meSavings.id, monthDate(3, 10), 'remove', -50000, null, 'Insurance', 'insurance');
addEntry(meSavings.id, monthDate(2, 25), 'add', 500000, null, 'Salary', 'salary');
addEntry(meSavings.id, monthDate(2, 28), 'remove', -120000, null, 'Rent', 'rent');
addEntry(meSavings.id, monthDate(1, 25), 'add', 500000, null, 'Salary', 'salary');
addEntry(meSavings.id, monthDate(1, 28), 'remove', -120000, null, 'Rent', 'rent');
addEntry(meSavings.id, monthDate(0, 25), 'add', 500000, null, 'Salary', 'salary');
addEntry(meSavings.id, monthDate(0, 5), 'remove', -80000, null, 'Utilities', 'utilities');

// Me - Cash
addEntry(meCash.id, monthDate(5, 1), 'add', 50000, null, 'ATM withdrawal', 'atm');
addEntry(meCash.id, monthDate(3, 15), 'remove', -20000, null, 'Groceries', 'groceries');
addEntry(meCash.id, monthDate(2, 1), 'add', 30000, null, 'ATM withdrawal', 'atm');
addEntry(meCash.id, monthDate(1, 10), 'remove', -15000, null, 'Dining out', 'dining');
addEntry(meCash.id, monthDate(0, 1), 'add', 40000, null, 'ATM withdrawal', 'atm');

// Me - Bitcoin: bought over time at different prices
addEntry(meBtc.id, monthDate(5, 5), 'add', 0.2, 9500000, 'Initial BTC purchase', 'investment');
addEntry(meBtc.id, monthDate(3, 10), 'add', 0.15, 10200000, 'DCA buy', 'investment');
addEntry(meBtc.id, monthDate(1, 20), 'add', 0.1, 11000000, 'DCA buy', 'investment');
addEntry(meBtc.id, monthDate(0, 5), 'add', 0.05, 10800000, 'Small buy', 'investment');

// Me - Gold
addEntry(meGold.id, monthDate(4, 1), 'add', 1.0, 1850000, 'Bought 1 oz gold', 'investment');
addEntry(meGold.id, monthDate(1, 15), 'add', 0.5, 1920000, 'Bought 0.5 oz gold', 'investment');

// Wife - Savings
addEntry(wifeSavings.id, monthDate(5, 1), 'add', 300000, null, 'Initial balance', null);
addEntry(wifeSavings.id, monthDate(4, 25), 'add', 350000, null, 'Salary', 'salary');
addEntry(wifeSavings.id, monthDate(3, 25), 'add', 350000, null, 'Salary', 'salary');
addEntry(wifeSavings.id, monthDate(3, 5), 'remove', -100000, null, 'Shopping', 'shopping');
addEntry(wifeSavings.id, monthDate(2, 25), 'add', 350000, null, 'Salary', 'salary');
addEntry(wifeSavings.id, monthDate(1, 25), 'add', 350000, null, 'Salary', 'salary');
addEntry(wifeSavings.id, monthDate(1, 10), 'remove', -200000, null, 'Travel', 'travel');
addEntry(wifeSavings.id, monthDate(0, 25), 'add', 350000, null, 'Salary', 'salary');

// Wife - Cash
addEntry(wifeCash.id, monthDate(4, 1), 'add', 30000, null, 'ATM withdrawal', 'atm');
addEntry(wifeCash.id, monthDate(2, 15), 'remove', -10000, null, 'Market', 'market');
addEntry(wifeCash.id, monthDate(0, 1), 'add', 20000, null, 'ATM withdrawal', 'atm');

// Child - Savings
addEntry(childSavings.id, monthDate(5, 1), 'add', 100000, null, 'Birthday gift', 'gift');
addEntry(childSavings.id, monthDate(3, 1), 'add', 50000, null, 'New Year money', 'gift');
addEntry(childSavings.id, monthDate(0, 15), 'add', 50000, null, 'Allowance savings', 'allowance');

console.log(`Created ${entryCount} ledger entries.`);
console.log('Seed complete!');

db.close();
