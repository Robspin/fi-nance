import { getDb } from '@/lib/db';
import ExcelJS from 'exceljs';

interface AccountInfo {
  id: string;
  name: string;
  symbol: string | null;
  currency: string;
  category_type: string;
  member_name: string;
}

interface LedgerRow {
  entry_date: string;
  amount: number;
  unit_price: number | null;
  balance_after: number | null;
}

export async function GET() {
  const db = getDb();

  // Get all accounts with their category and member info
  const accounts = db.prepare(`
    SELECT
      acc.id, acc.name, acc.symbol, acc.currency,
      c.type AS category_type,
      m.name AS member_name
    FROM accounts acc
    JOIN asset_categories c ON acc.category_id = c.id
    JOIN family_members m ON acc.family_member_id = m.id
    ORDER BY m.name, c.sort_order, acc.name
  `).all() as AccountInfo[];

  // Get all non-deleted ledger entries ordered by date
  const allEntries = db.prepare(`
    SELECT account_id, entry_date, amount, unit_price, balance_after
    FROM ledger_entries
    WHERE deleted_at IS NULL
    ORDER BY entry_date ASC, created_at ASC
  `).all() as (LedgerRow & { account_id: string })[];

  // Group entries by account
  const entriesByAccount = new Map<string, (LedgerRow & { account_id: string })[]>();
  for (const e of allEntries) {
    if (!entriesByAccount.has(e.account_id)) entriesByAccount.set(e.account_id, []);
    entriesByAccount.get(e.account_id)!.push(e);
  }

  // Collect all unique month-ends (24th) across all entries
  const monthSet = new Set<string>();
  for (const e of allEntries) {
    const d = e.entry_date.slice(0, 7); // YYYY-MM
    monthSet.add(d);
  }
  const months = [...monthSet].sort();

  // Build snapshot rows
  const snapRows: (string | number | null)[][] = [];

  for (const acc of accounts) {
    const entries = entriesByAccount.get(acc.id) || [];
    if (entries.length === 0) continue;

    const isQuantityType = acc.category_type === 'crypto' || acc.category_type === 'precious_metal';

    for (const month of months) {
      const snapshotDate = `${month}-24`;

      // Find all entries on or before the 24th of this month
      const relevantEntries = entries.filter(e => e.entry_date <= snapshotDate);
      if (relevantEntries.length === 0) continue;

      // Balance is from the last balance_after, or sum of amounts
      const lastEntry = relevantEntries[relevantEntries.length - 1];
      let balance: number;
      if (lastEntry.balance_after != null) {
        balance = lastEntry.balance_after;
      } else {
        balance = relevantEntries.reduce((sum, e) => sum + e.amount, 0);
      }

      // Find the latest unit_price (for crypto/metals: price per unit; for EUR bank: EURJPY rate)
      let unitPrice: number | null = null;
      for (let i = relevantEntries.length - 1; i >= 0; i--) {
        if (relevantEntries[i].unit_price != null) {
          unitPrice = relevantEntries[i].unit_price;
          break;
        }
      }

      snapRows.push([
        snapshotDate,
        acc.member_name,
        acc.category_type,
        acc.name,
        acc.symbol,
        acc.currency,
        Math.round(balance * 1e8) / 1e8, // round to avoid float noise
        unitPrice,
      ]);
    }
  }

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Snapshots');

  const headers = ['Date', 'Member', 'Category', 'Account', 'Symbol', 'Currency', 'Amount', 'UnitPriceJPY'];
  sheet.addRow(headers);

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };

  for (const row of snapRows) {
    sheet.addRow(row);
  }

  // Auto-fit column widths
  sheet.columns.forEach(col => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 30);
  });

  const xlsxBuffer = await workbook.xlsx.writeBuffer();

  return new Response(xlsxBuffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="finance-export.xlsx"',
    },
  });
}
