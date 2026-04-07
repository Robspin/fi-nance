"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp, type Account } from "@/lib/context"
import { formatCurrency } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCwIcon } from "lucide-react"

type RateEntry = {
  symbol: string
  name: string
  type: "exchange" | "crypto" | "metal"
  priceUSD: number
  priceJPY: number
  priceEUR: number
  priceBTC: number
}

export default function RatesPage() {
  const { selectedMember } = useApp()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rates, setRates] = useState<Record<string, number>>({})
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, Record<string, number>>>({})
  const [metalPrices, setMetalPrices] = useState<Record<string, Record<string, number>>>({})
  const [btcUsd, setBtcUsd] = useState(0)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })

    try {
      const params = new URLSearchParams()
      if (selectedMember) params.set("member_id", selectedMember)
      const accountsRes = await fetch(`/api/accounts?${params}`)
      const accountsData = accountsRes.ok ? await accountsRes.json() : []
      setAccounts(accountsData)

      const cryptoSymbols = [...new Set(
        accountsData.filter((a: Account) => a.category_type === "crypto" && a.symbol).map((a: Account) => a.symbol!)
      )]
      const metalSymbols = [...new Set(
        accountsData.filter((a: Account) => a.category_type === "precious_metal" && a.symbol).map((a: Account) => a.symbol!)
      )]

      const ratesRes = await fetch("/api/prices?type=exchange&base=USD")
      const ratesData = ratesRes.ok ? await ratesRes.json() : {}
      setRates(ratesData.rates || {})

      if (cryptoSymbols.length > 0) {
        const cryptoRes = await fetch(`/api/prices?type=crypto&symbols=${cryptoSymbols.join(",")}&vs=usd`)
        const cryptoData = cryptoRes.ok ? await cryptoRes.json() : {}
        setCryptoPrices(cryptoData)
        if (cryptoData.bitcoin?.usd) setBtcUsd(cryptoData.bitcoin.usd)
      }

      if (!cryptoSymbols.includes("bitcoin")) {
        const btcRes = await fetch("/api/prices?type=crypto&symbols=bitcoin&vs=usd")
        const btcData = btcRes.ok ? await btcRes.json() : {}
        if (btcData.bitcoin?.usd) setBtcUsd(btcData.bitcoin.usd)
      }

      if (metalSymbols.length > 0) {
        const metalRes = await fetch(`/api/prices?type=metal&symbols=${metalSymbols.join(",")}&vs=usd`)
        const metalData = metalRes.ok ? await metalRes.json() : {}
        setMetalPrices(metalData)
      }

      setFetchedAt(now)
    } catch { /* */ } finally {
      setLoading(false)
    }
  }, [selectedMember])

  useEffect(() => { fetchAll() }, [fetchAll])

  const entries: RateEntry[] = []
  const jpyRate = rates["JPY"] || 1
  const eurRate = rates["EUR"] || 1

  entries.push({
    symbol: "USD", name: "US Dollar", type: "exchange",
    priceUSD: 1, priceJPY: jpyRate, priceEUR: eurRate,
    priceBTC: btcUsd > 0 ? 1 / btcUsd : 0,
  })
  entries.push({
    symbol: "JPY", name: "Japanese Yen", type: "exchange",
    priceUSD: 1 / jpyRate, priceJPY: 1, priceEUR: eurRate / jpyRate,
    priceBTC: btcUsd > 0 ? (1 / jpyRate) / btcUsd : 0,
  })
  entries.push({
    symbol: "EUR", name: "Euro", type: "exchange",
    priceUSD: 1 / eurRate, priceJPY: jpyRate / eurRate, priceEUR: 1,
    priceBTC: btcUsd > 0 ? (1 / eurRate) / btcUsd : 0,
  })

  for (const [symbol, prices] of Object.entries(cryptoPrices)) {
    const usdPrice = prices.usd || 0
    entries.push({
      symbol: symbol.toUpperCase(), name: symbol.charAt(0).toUpperCase() + symbol.slice(1), type: "crypto",
      priceUSD: usdPrice, priceJPY: usdPrice * jpyRate, priceEUR: usdPrice * eurRate,
      priceBTC: btcUsd > 0 ? usdPrice / btcUsd : 0,
    })
  }

  for (const [symbol, prices] of Object.entries(metalPrices)) {
    const usdPrice = prices.usd || 0
    const metalNames: Record<string, string> = { XAU: "Gold (oz)", XAG: "Silver (oz)", XPT: "Platinum (oz)" }
    entries.push({
      symbol, name: metalNames[symbol] || symbol, type: "metal",
      priceUSD: usdPrice, priceJPY: usdPrice * jpyRate, priceEUR: usdPrice * eurRate,
      priceBTC: btcUsd > 0 ? usdPrice / btcUsd : 0,
    })
  }

  const typeColor: Record<string, string> = { exchange: "#3b82f6", crypto: "#00f0ff", metal: "#ffe600" }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold text-[#00f0ff] neon-text">Live Rates</h2>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs text-muted-foreground font-mono">
              {fetchedAt}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCwIcon className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="cyber-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
            Exchange rates and portfolio asset prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">USD $</TableHead>
                <TableHead className="text-right">JPY ¥</TableHead>
                <TableHead className="text-right">EUR &euro;</TableHead>
                <TableHead className="text-right">BTC ₿</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.symbol}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{entry.symbol}</span>
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" style={{ borderColor: typeColor[entry.type], color: typeColor[entry.type] }}>
                      {entry.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(entry.priceUSD, "USD")}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(entry.priceJPY, "JPY")}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(entry.priceEUR, "EUR")}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(entry.priceBTC, "BTC")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {accounts.filter(a => a.category_type === "crypto" || a.category_type === "precious_metal").length > 0 && (
        <Card className="cyber-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
              Portfolio Holdings at Live Prices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                  <TableHead className="text-right">JPY</TableHead>
                  <TableHead className="text-right">EUR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts
                  .filter(a => a.category_type === "crypto" || a.category_type === "precious_metal")
                  .map((acc) => {
                    const sym = acc.symbol?.toLowerCase() || ""
                    let usdUnitPrice = 0
                    if (acc.category_type === "crypto" && cryptoPrices[sym]?.usd) {
                      usdUnitPrice = cryptoPrices[sym].usd
                    } else if (acc.category_type === "precious_metal" && metalPrices[acc.symbol || ""]?.usd) {
                      usdUnitPrice = metalPrices[acc.symbol || ""].usd
                    }
                    const qty = acc.quantity || 0
                    const usdVal = qty * usdUnitPrice
                    return (
                      <TableRow key={acc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{acc.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{acc.symbol}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{acc.member_name}</TableCell>
                        <TableCell className="text-right font-mono">{qty}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrency(usdVal, "USD")}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrency(usdVal * jpyRate, "JPY")}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatCurrency(usdVal * eurRate, "EUR")}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
