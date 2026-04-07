"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp } from "@/lib/context"
import { useConvert } from "@/lib/use-convert"
import { formatCurrency, formatPercent } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

type CashflowRow = {
  month: string
  inflows: number
  outflows: number
  net: number
}

const TIME_RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "3Y", months: 36 },
]

export default function ReportsPage() {
  const { selectedMember, selectedCurrency } = useApp()
  const { convert } = useConvert()
  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [cashflow, setCashflow] = useState<CashflowRow[]>([])
  const [selectedRange, setSelectedRange] = useState(12)

  useEffect(() => {
    const params = new URLSearchParams({ months: String(selectedRange) })
    if (selectedMember) params.set("member_id", selectedMember)
    fetch(`/api/reports/monthly?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.monthly && setMonthly(d.monthly))
      .catch(() => {})
  }, [selectedMember, selectedRange])

  useEffect(() => {
    const params = new URLSearchParams({ months: String(selectedRange) })
    if (selectedMember) params.set("member_id", selectedMember)
    fetch(`/api/reports/cashflow?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.months && setCashflow(d.months))
      .catch(() => {})
  }, [selectedMember, selectedRange])

  const chartData = useMemo(() => {
    return monthly.map((r) => ({
      month: r.month.slice(2).replace("-", "/"),
      Total: convert(r.total_value),
      Bank: convert(r.bank_total),
      Cash: convert(r.cash_total),
      Crypto: convert(r.crypto_total),
      Metals: convert(r.metal_total),
    }))
  }, [monthly, convert])

  const cashflowChartData = useMemo(() => {
    return cashflow.map((r) => ({
      month: r.month.slice(2).replace("-", "/"),
      Inflows: convert(r.inflows),
      Outflows: convert(r.outflows),
    }))
  }, [cashflow, convert])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold text-[#00f0ff] neon-text">Reports</h2>
        <div className="flex gap-1">
          {TIME_RANGES.map((tr) => (
            <Button
              key={tr.months}
              variant={selectedRange === tr.months ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRange(tr.months)}
            >
              {tr.label}
            </Button>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <Card className="cyber-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Stacked Category Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gBank" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00ff88" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gCrypto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gMetals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffe600" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ffe600" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                  <XAxis dataKey="month" stroke="#555" fontSize={11} tickLine={false} />
                  <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.15 0.01 270)",
                      border: "1px solid rgba(0,240,255,0.2)",
                      borderRadius: "8px",
                      color: "#eee",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area type="monotone" dataKey="Bank" stackId="1" stroke="#3b82f6" fill="url(#gBank)" />
                  <Area type="monotone" dataKey="Cash" stackId="1" stroke="#00ff88" fill="url(#gCash)" />
                  <Area type="monotone" dataKey="Crypto" stackId="1" stroke="#00f0ff" fill="url(#gCrypto)" />
                  <Area type="monotone" dataKey="Metals" stackId="1" stroke="#ffe600" fill="url(#gMetals)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="cyber-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No data yet. Add ledger entries to see reports.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Bank</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">Crypto</TableHead>
                    <TableHead className="text-right">Metals</TableHead>
                    <TableHead className="text-right">MoM</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthly.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-mono text-xs">{row.month}</TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatCurrency(convert(row.total_value), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {formatCurrency(convert(row.bank_total), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {formatCurrency(convert(row.cash_total), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {formatCurrency(convert(row.crypto_total), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-xs">
                        {formatCurrency(convert(row.metal_total), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: row.mom_change >= 0 ? "#00ff88" : "#ff3366" }}>
                        {formatCurrency(convert(row.mom_change), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: row.mom_change_pct >= 0 ? "#00ff88" : "#ff3366" }}>
                        {formatPercent(row.mom_change_pct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {cashflowChartData.length > 0 && (
        <Card className="cyber-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                  <XAxis dataKey="month" stroke="#555" fontSize={11} tickLine={false} />
                  <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.15 0.01 270)",
                      border: "1px solid rgba(0,240,255,0.2)",
                      borderRadius: "8px",
                      color: "#eee",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Inflows" fill="#00ff88" opacity={0.85} />
                  <Bar dataKey="Outflows" fill="#ff3366" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="cyber-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Cash Flow Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {cashflow.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No cash flow data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Inflows</TableHead>
                    <TableHead className="text-right">Outflows</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashflow.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-mono text-xs">{row.month}</TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: "#00ff88" }}>
                        {formatCurrency(convert(row.inflows), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs" style={{ color: "#ff3366" }}>
                        {formatCurrency(convert(row.outflows), selectedCurrency)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-xs" style={{ color: row.net >= 0 ? "#00ff88" : "#ff3366" }}>
                        {formatCurrency(convert(row.net), selectedCurrency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
