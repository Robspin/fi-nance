"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp, type LedgerEntry } from "@/lib/context"
import { useConvert } from "@/lib/use-convert"
import { formatCurrency } from "@/lib/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type LedgerEntryFull = LedgerEntry & {
  account_name: string
  account_symbol: string | null
  category_type: string
  member_name: string
}

const FALLBACK_TAG_COLOR = { bg: "rgba(150,150,150,0.15)", text: "#969696" }

function TagBadge({
  tag,
  tagMap,
}: {
  tag: string | null
  tagMap: Record<string, { bg: string; text: string }>
}) {
  if (!tag) return <span className="text-muted-foreground text-xs">—</span>
  const color = tagMap[tag] ?? FALLBACK_TAG_COLOR
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-mono"
      style={{ background: color.bg, borderColor: color.text, color: color.text }}
    >
      {tag}
    </Badge>
  )
}

function TypeBadge({ type, amount }: { type: string; amount: number }) {
  const isPositive = amount >= 0
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{
        borderColor: isPositive ? "#00FF41" : "#FF0000",
        color: isPositive ? "#00FF41" : "#FF0000",
      }}
    >
      {type}
    </Badge>
  )
}

export default function TransactionsPage() {
  const { selectedCurrency, members, tags } = useApp()
  const { convert } = useConvert()
  const [entries, setEntries] = useState<LedgerEntryFull[]>([])
  const [loading, setLoading] = useState(true)

  const [monthFilter, setMonthFilter] = useState<string>("")
  const [tagFilter, setTagFilter] = useState<string>("")
  const [memberFilter, setMemberFilter] = useState<string>("")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/ledger?limit=200")
        if (res.ok) {
          const data = await res.json()
          setEntries(data)
        }
      } catch { /* API not available */ }
      setLoading(false)
    }
    load()
  }, [])

  // Derive available months from data
  const availableMonths = useMemo(() => {
    const seen = new Set<string>()
    for (const e of entries) {
      seen.add(e.entry_date.slice(0, 7))
    }
    return Array.from(seen).sort().reverse()
  }, [entries])

  // Lookup table for tag colors, plus a merged tag list that includes any
  // orphan tags still present in ledger data (e.g. a tag was deleted but old
  // entries still reference its name).
  const tagMap = useMemo(() => {
    const map: Record<string, { bg: string; text: string }> = {}
    for (const t of tags) {
      map[t.name] = { bg: t.color_bg, text: t.color_text }
    }
    return map
  }, [tags])

  const availableTags = useMemo(() => {
    const names = new Set<string>(tags.map((t) => t.name))
    for (const e of entries) {
      if (e.tag) names.add(e.tag)
    }
    return Array.from(names).sort()
  }, [tags, entries])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (monthFilter && !e.entry_date.startsWith(monthFilter)) return false
      if (tagFilter && e.tag !== tagFilter) return false
      if (memberFilter) {
        const member = members.find((m) => m.id === memberFilter)
        if (member && e.member_name !== member.name) return false
      }
      return true
    })
  }, [entries, monthFilter, tagFilter, memberFilter, members])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <h2 className="text-2xl font-mono font-bold text-[#00FFFF] nerv-text">TRANSACTIONS</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v === "__all__" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-[160px]">
            <span className="text-sm">{monthFilter || "All months"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All months</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={(v) => setTagFilter(v === "__all__" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-[160px]">
            <span className="text-sm">{tagFilter || "All tags"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All tags</SelectItem>
            {availableTags.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v === "__all__" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-[160px]">
            <span className="text-sm">
              {memberFilter ? (members.find((m) => m.id === memberFilter)?.name ?? "All members") : "All members"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="eva-border rounded-lg overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">No transactions found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const displayAmount = convert(e.amount, "JPY")
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {e.entry_date}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {e.account_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.member_name}
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={e.entry_type} amount={e.amount} />
                    </TableCell>
                    <TableCell
                      className="text-right font-mono font-bold text-sm"
                      style={{ color: e.amount >= 0 ? "#00FF41" : "#FF0000" }}
                    >
                      {e.amount >= 0 ? "+" : ""}
                      {formatCurrency(displayAmount, selectedCurrency)}
                    </TableCell>
                    <TableCell>
                      <TagBadge tag={e.tag} tagMap={tagMap} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {e.description ?? "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
