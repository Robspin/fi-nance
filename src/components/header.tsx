"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/lib/context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

function NervLogo() {
  return (
    <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="shrink-0">
      <path d="M10 0L20 20H0L10 0Z" fill="none" stroke="#FF4800" strokeWidth="1.5" />
      <path d="M10 6L16 18H4L10 6Z" fill="rgba(255,72,0,0.15)" stroke="#FF4800" strokeWidth="0.5" />
    </svg>
  )
}

export function Header() {
  const {
    selectedMember,
    setSelectedMember,
    selectedCurrency,
    setSelectedCurrency,
    members,
  } = useApp()

  const [time, setTime] = useState("")

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(now.toLocaleTimeString("en-US", { hour12: false }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-[rgba(255,72,0,0.2)]"
      style={{ boxShadow: "0 1px 12px rgba(255, 72, 0, 0.08)" }}
    >
      <div className="flex items-center gap-3">
        <NervLogo />
        <h1 className="text-lg sm:text-xl font-bold tracking-[0.15em] text-[#FF4800] nerv-text select-none uppercase">
          NERV//FINANCE
        </h1>
      </div>

      <div className="hidden sm:flex items-center gap-4 text-[10px] text-[#777] tracking-wider uppercase">
        <span className="eva-blink text-[#00FFFF]">SYSTEM: NOMINAL</span>
        <span className="text-[#FF4800] font-bold tabular-nums">{time}</span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={selectedMember ?? "all"}
          onValueChange={(v) => setSelectedMember(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[120px] sm:w-[140px] text-xs h-8">
            <span>{selectedMember ? members.find(m => m.id === selectedMember)?.name ?? "ALL" : "ALL PILOTS"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ALL PILOTS</SelectItem>
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
          <SelectTrigger className="w-[80px] text-xs h-8">
            <span className="text-[#00FFFF]">{selectedCurrency}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="JPY">JPY</SelectItem>
            <SelectItem value="EUR">EUR</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="BTC">BTC</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>
  )
}
