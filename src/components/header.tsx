"use client"

import { useApp } from "@/lib/context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function Header() {
  const {
    selectedMember,
    setSelectedMember,
    selectedCurrency,
    setSelectedCurrency,
    members,
  } = useApp()

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-[oklch(0.13_0.01_270)] border-b border-[rgba(0,240,255,0.15)]"
      style={{ boxShadow: "0 1px 12px rgba(0, 240, 255, 0.08)" }}
    >
      <h1 className="font-mono text-xl font-bold tracking-wider text-[#00f0ff] neon-text select-none">
        FINANCE//TRACKER
      </h1>

      <div className="flex items-center gap-3">
        <Select
          value={selectedMember ?? "all"}
          onValueChange={(v) => setSelectedMember(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[140px]">
            <span>{selectedMember ? members.find(m => m.id === selectedMember)?.name ?? "All Family" : "All Family"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Family</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedCurrency}
          onValueChange={(v) => v && setSelectedCurrency(v as "JPY" | "EUR" | "USD")}
        >
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="JPY">JPY ¥</SelectItem>
            <SelectItem value="EUR">EUR €</SelectItem>
            <SelectItem value="USD">USD $</SelectItem>
            <SelectItem value="BTC">BTC ₿</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>
  )
}
