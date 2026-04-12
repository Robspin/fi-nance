"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export type Member = {
  id: string
  name: string
  role: "me" | "wife" | "child"
  created_at: string
}

export type Category = {
  id: string
  name: string
  type: "bank" | "cash" | "crypto" | "precious_metal"
  icon: string
  sort_order: number
}

export type Account = {
  id: string
  category_id: string
  family_member_id: string
  name: string
  symbol: string | null
  currency: string
  notes: string | null
  created_at: string
  category_name: string
  category_type: string
  member_name: string
  balance: number
  quantity: number
  avg_unit_price: number
  cost_basis: number
  is_active: number
}

export type LedgerEntry = {
  id: string
  account_id: string
  entry_date: string
  entry_type: "add" | "remove" | "adjustment"
  amount: number
  unit_price: number | null
  description: string | null
  tag: string | null
  created_at: string
  account_name?: string
  balance_after: number | null
}

export type Tag = {
  name: string
  color_bg: string
  color_text: string
  sort_order: number
}

type CurrencyCode = "JPY" | "EUR" | "USD" | "BTC"

type AppContextValue = {
  selectedMember: string | null
  setSelectedMember: (id: string | null) => void
  selectedCurrency: CurrencyCode
  setSelectedCurrency: (c: CurrencyCode) => void
  members: Member[]
  categories: Category[]
  tags: Tag[]
  refreshMembers: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshTags: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("JPY")
  const [members, setMembers] = useState<Member[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const refreshMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members")
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch {
      // API not available yet
    }
  }, [])

  const refreshCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories")
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch {
      // API not available yet
    }
  }, [])

  const refreshTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags")
      if (res.ok) {
        const data = await res.json()
        setTags(data)
      }
    } catch {
      // API not available yet
    }
  }, [])

  useEffect(() => {
    refreshMembers()
    refreshCategories()
    refreshTags()
  }, [refreshMembers, refreshCategories, refreshTags])

  return (
    <AppContext value={{
      selectedMember,
      setSelectedMember,
      selectedCurrency,
      setSelectedCurrency,
      members,
      categories,
      tags,
      refreshMembers,
      refreshCategories,
      refreshTags,
    }}>
      {children}
    </AppContext>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error("useApp must be used within AppProvider")
  }
  return ctx
}
