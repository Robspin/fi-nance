"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp, type Account } from "@/lib/context"
import { useConvert } from "@/lib/use-convert"
import { formatCurrency, formatPercent } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

type MonthlyRow = {
  month: string
  total_value: number
  bank_total: number
  cash_total: number
  crypto_total: number
  metal_total: number
  mom_change: number
  mom_change_pct: number
}

type ReportData = {
  monthly: MonthlyRow[]
  current: {
    month: string
    total_value: number
    bank_total: number
    cash_total: number
    crypto_total: number
    metal_total: number
  }
}

const CATEGORY_CARDS = [
  { key: "bank_total" as const, label: "Bank", color: "#00FFFF", icon: "🏦", marketType: null },
  { key: "cash_total" as const, label: "Cash", color: "#00FF41", icon: "💴", marketType: null },
  { key: "crypto_total" as const, label: "Crypto", color: "#FF4800", icon: "₿", marketType: "crypto" },
  { key: "metal_total" as const, label: "Metals", color: "#FFD700", icon: "🥇", marketType: "precious_metal" },
]

export default function DashboardPage() {
  const { selectedMember, selectedCurrency, members } = useApp()
  const { convert } = useConvert()
  const [report, setReport] = useState<ReportData | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const reportParams = new URLSearchParams({ months: "12" })
    if (selectedMember) reportParams.set("member_id", selectedMember)
    const accountParams = new URLSearchParams()
    if (selectedMember) accountParams.set("member_id", selectedMember)

    Promise.all([
      fetch(`/api/reports/monthly?${reportParams}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/accounts?${accountParams}`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([reportData, accountData]) => {
      if (reportData) setReport(reportData)
      if (accountData) setAccounts(accountData)
      setLoading(false)
    })
  }, [selectedMember])

  const current = report?.current
  const totalValue = current ? convert(current.total_value) : 0

  const lastMonth = report?.monthly?.at(-2)
  const momChange = lastMonth ? convert(current!.total_value - lastMonth.total_value) : 0
  const momPct = lastMonth && lastMonth.total_value !== 0
    ? ((current!.total_value - lastMonth.total_value) / lastMonth.total_value) * 100
    : 0

  // Market value uses the live price when available, else the weighted-average
  // purchase price (cost basis). Falling back to cost basis keeps the UI from
  // collapsing to zero when the upstream price API is offline.
  const marketPriceFor = (a: Account) =>
    a.live_price != null && Number.isFinite(a.live_price)
      ? a.live_price
      : a.avg_unit_price

  const marketPnL = useMemo(() => {
    const result: Record<string, number> = { crypto: 0, precious_metal: 0 }
    for (const a of accounts) {
      if (a.category_type === "crypto" || a.category_type === "precious_metal") {
        // cost_basis is in JPY (sum of qty * stored unit_price); the live
        // price helper also resolves to JPY, so subtract directly before
        // converting to the user's selected display currency.
        const marketValueJpy = a.quantity * marketPriceFor(a)
        const pnlJpy = marketValueJpy - a.cost_basis
        result[a.category_type] += convert(pnlJpy, "JPY")
      }
    }
    return result
  }, [accounts, convert])

  const memberTotals = useMemo(() => {
    if (selectedMember) return []
    const grouped: Record<string, { name: string; total: number }> = {}
    for (const a of accounts) {
      const valDisplay =
        a.category_type === "crypto" || a.category_type === "precious_metal"
          ? convert(a.quantity * marketPriceFor(a), "JPY")
          : convert(a.balance, a.currency || "JPY")
      if (!grouped[a.family_member_id]) {
        grouped[a.family_member_id] = { name: a.member_name, total: 0 }
      }
      grouped[a.family_member_id].total += valDisplay
    }
    return Object.entries(grouped).map(([id, d]) => ({
      id,
      name: d.name,
      total: d.total,
    }))
  }, [accounts, selectedMember, convert])

  const chartData = useMemo(() => {
    if (!report?.monthly) return []
    return report.monthly.map((r) => ({
      month: r.month.slice(2).replace("-", "/"),
      total: convert(r.total_value),
      bank: convert(r.bank_total),
      crypto: convert(r.crypto_total),
    }))
  }, [report, convert])

  // Pie slice per non-zero category, in display currency. Filtering keeps the
  // donut readable when one of the categories has nothing in it.
  const allocationData = useMemo(() => {
    if (!current) return []
    return CATEGORY_CARDS
      .map((cat) => ({
        name: cat.label,
        value: convert(current[cat.key]),
        color: cat.color,
      }))
      .filter((d) => d.value > 0)
  }, [current, convert])

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-medium">NET WORTH</p>
          <Skeleton className="h-12 w-64 mx-auto" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[280px]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Portfolio total */}
      <div className="text-center space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-medium">NET WORTH</p>
        <p className="text-3xl sm:text-5xl font-mono font-bold text-[#00FFFF] nerv-text">
          {formatCurrency(totalValue, selectedCurrency)}
        </p>
        {momChange !== 0 && (
          <p className="text-sm font-mono" style={{ color: momChange >= 0 ? "#00FF41" : "#FF0000" }}>
            {momChange >= 0 ? "+" : ""}{formatCurrency(momChange, selectedCurrency)}
            {" "}
            <span className="text-muted-foreground">({formatPercent(momPct)})</span>
            {" "}
            <span className="text-muted-foreground text-xs">vs last month</span>
          </p>
        )}
      </div>

      {/* Category breakdown cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CATEGORY_CARDS.map((cat) => {
          const val = current ? convert(current[cat.key]) : 0
          const pct = totalValue > 0 ? (val / totalValue) * 100 : 0
          const pnl = cat.marketType ? convert(marketPnL[cat.marketType] ?? 0) : null
          return (
            <Card key={cat.key} className="eva-border overflow-hidden">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: cat.color }}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-lg sm:text-xl font-mono font-bold">
                  {formatCurrency(val, selectedCurrency)}
                </p>
                {pnl !== null && (
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: pnl >= 0 ? "#00FF41" : "#FF0000" }}>
                    {pnl >= 0 ? "+" : "-"}{formatCurrency(Math.abs(pnl), selectedCurrency)}
                    {" "}
                    <span className="text-muted-foreground">Unrealized P/L</span>
                  </p>
                )}
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cat.color }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{pct.toFixed(1)}%</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Allocation pie + Portfolio trend, side-by-side on lg+ */}
      {(allocationData.length > 0 || chartData.length > 1) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {allocationData.length > 0 && (
            <Card className="eva-border lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={2}
                        stroke="none"
                        label={({ percent }) =>
                          percent != null && percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
                        }
                        labelLine={false}
                      >
                        {allocationData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(0,255,255,0.2)",
                          borderRadius: "8px",
                          color: "#eee",
                          fontSize: "12px",
                        }}
                        formatter={(value: number, name) => [
                          formatCurrency(value, selectedCurrency),
                          name as string,
                        ]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        wrapperStyle={{ fontSize: "11px" }}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {chartData.length > 1 && (
            <Card className={`eva-border ${allocationData.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Portfolio Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00FFFF" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#00FFFF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.06)" />
                      <XAxis dataKey="month" stroke="#555" fontSize={11} tickLine={false} />
                      <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(0,255,255,0.2)",
                          borderRadius: "8px",
                          color: "#eee",
                          fontSize: "12px",
                        }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#00FFFF" strokeWidth={2} fill="url(#gradTotal)" dot={false} />
                      <Area type="monotone" dataKey="bank" stroke="#3b82f6" strokeWidth={1} fill="none" dot={false} />
                      <Area type="monotone" dataKey="crypto" stroke="#FF4800" strokeWidth={1} fill="none" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Per-member breakdown */}
      {!selectedMember && memberTotals.length > 0 && (
        <Card className="eva-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Per-Member Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberTotals.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(m.total, selectedCurrency)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-mono">
                      {totalValue > 0 ? formatPercent((m.total / totalValue) * 100) : "0%"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!report && accounts.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No data yet</p>
          <p className="text-sm mt-1">Add members and accounts to get started</p>
        </div>
      )}
    </div>
  )
}
