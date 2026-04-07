# fi-nance

Family finance tracker with a Neon Genesis Evangelion-inspired UI. Track bank accounts, cash, crypto, and precious metals across family members with real-time exchange rates and reporting.

## Features

- **Dashboard** - Net worth overview with category breakdown and portfolio trend chart
- **Accounts & Ledger** - Manage bank, cash, crypto, and precious metal accounts with full transaction history
- **Transactions** - Filterable ledger view across all accounts with tag-based categorization
- **Reports** - Monthly breakdown, stacked category trends, and cash flow analysis
- **Live Rates** - Real-time exchange rates and crypto/metal prices
- **Multi-member** - Track finances per family member or view combined totals
- **Multi-currency** - View all values in JPY, USD, EUR, or BTC

## Tech Stack

- Next.js 16 (App Router)
- React 19
- SQLite (better-sqlite3)
- Tailwind CSS 4 + shadcn/ui
- Recharts
- React Three Fiber (background effect)

## Getting Started

```bash
# Install dependencies
npm install

# Seed the database with sample data
npm run seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
src/
  app/
    api/          # REST API routes (accounts, ledger, members, prices, reports)
    assets/       # Accounts & ledger page
    members/      # Family member management
    rates/        # Live exchange rates
    reports/      # Financial reports & charts
    transactions/ # Transaction history
  components/     # UI components (header, nav, shadcn/ui)
  lib/            # Database, context, utilities
  scripts/        # Database seed script
data/             # SQLite database (gitignored)
```
