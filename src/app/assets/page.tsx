"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp, type Account, type LedgerEntry, type Category } from "@/lib/context"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/lib/toast"
import { useConvert } from "@/lib/use-convert"
import { formatCurrency } from "@/lib/format"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, ListIcon, ArchiveIcon } from "lucide-react"

const CRYPTO_SYMBOLS = [
  "bitcoin", "ethereum", "dogecoin", "solana", "cardano", "ripple", "polkadot", "litecoin",
]
const METAL_SYMBOLS = [
  { symbol: "XAU", label: "XAU (Gold)" },
  { symbol: "XAG", label: "XAG (Silver)" },
  { symbol: "XPT", label: "XPT (Platinum)" },
]

type AccountFormState = {
  name: string
  symbol: string
  notes: string
  family_member_id: string
}

type EntryFormState = {
  entry_date: string
  entry_type: "add" | "remove"
  amount: string
  unit_price: string
  description: string
  tag: string
}

const emptyAccountForm: AccountFormState = { name: "", symbol: "", notes: "", family_member_id: "" }

export default function AssetsPage() {
  const { selectedMember, selectedCurrency, members, categories, refreshCategories } = useApp()
  const { convert } = useConvert()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [accountForm, setAccountForm] = useState<AccountFormState>(emptyAccountForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Ledger entry dialog
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [activeAccount, setActiveAccount] = useState<Account | null>(null)
  const [entryForm, setEntryForm] = useState<EntryFormState>({
    entry_date: new Date().toISOString().slice(0, 10),
    entry_type: "add",
    amount: "",
    unit_price: "",
    description: "",
    tag: "",
  })

  // Ledger history dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [historyAccount, setHistoryAccount] = useState<Account | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])

  const fetchAccounts = useCallback(async () => {
    const params = new URLSearchParams()
    if (selectedMember) params.set("member_id", selectedMember)
    try {
      const res = await fetch(`/api/accounts?${params}`)
      if (res.ok) setAccounts(await res.json())
    } catch { /* API not available */ }
    setLoading(false)
  }, [selectedMember])

  useEffect(() => {
    fetchAccounts()
    refreshCategories()
  }, [fetchAccounts, refreshCategories])

  const isMarket = (cat: Category) => cat.type === "crypto" || cat.type === "precious_metal"

  const accountsForCategory = (catId: string) => accounts.filter((a) => a.category_id === catId)

  const accountValue = (a: Account) => {
    const cat = categories.find(c => c.id === a.category_id)
    if (cat && isMarket(cat)) {
      return convert(a.quantity * a.avg_unit_price, a.currency || "JPY")
    }
    return convert(a.balance, a.currency || "JPY")
  }

  const categoryTotal = (catId: string) =>
    accountsForCategory(catId).reduce((sum, a) => sum + accountValue(a), 0)

  function openAddAccount(cat: Category) {
    setActiveCategory(cat)
    setAccountForm({ ...emptyAccountForm, family_member_id: selectedMember || "" })
    setAccountDialogOpen(true)
  }

  function openAddEntry(account: Account, type: "add" | "remove") {
    setActiveAccount(account)
    setEntryForm({
      entry_date: new Date().toISOString().slice(0, 10),
      entry_type: type,
      amount: "",
      unit_price: "",
      description: "",
      tag: "",
    })
    setEntryDialogOpen(true)
  }

  async function openHistory(account: Account) {
    setHistoryAccount(account)
    setHistoryDialogOpen(true)
    try {
      const res = await fetch(`/api/ledger?account_id=${account.id}&limit=50`)
      if (res.ok) setLedgerEntries(await res.json())
    } catch { /* */ }
  }

  async function fetchPriceForSymbol(symbol: string, catType: string) {
    if (!symbol) return
    try {
      const type = catType === "crypto" ? "crypto" : "metal"
      const res = await fetch(`/api/prices?type=${type}&symbols=${symbol}&vs=jpy`)
      if (res.ok) {
        const data = await res.json()
        const price = catType === "crypto"
          ? data[symbol]?.jpy
          : data[symbol]?.jpy
        if (price) {
          setEntryForm(prev => ({ ...prev, unit_price: String(price) }))
        }
      }
    } catch { /* */ }
  }

  async function handleSaveAccount() {
    if (!activeCategory) return
    const body: Record<string, unknown> = {
      category_id: activeCategory.id,
      family_member_id: accountForm.family_member_id,
      name: accountForm.name,
      currency: "JPY",
    }
    if (isMarket(activeCategory)) {
      body.symbol = accountForm.symbol
    }
    if (accountForm.notes) body.notes = accountForm.notes

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setAccountDialogOpen(false)
        fetchAccounts()
        toast("Account created")
      }
    } catch {
      toast("Something went wrong", "error")
    }
  }

  async function handleSaveEntry() {
    if (!activeAccount) return
    const cat = categories.find(c => c.id === activeAccount.category_id)
    const body: Record<string, unknown> = {
      account_id: activeAccount.id,
      entry_date: entryForm.entry_date,
      entry_type: entryForm.entry_type,
      amount: parseFloat(entryForm.amount) || 0,
      description: entryForm.description || null,
      tag: entryForm.tag || null,
    }
    if (cat && isMarket(cat) && entryForm.unit_price) {
      body.unit_price = parseFloat(entryForm.unit_price) || null
    }

    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEntryDialogOpen(false)
        fetchAccounts()
        toast(`${entryForm.entry_type === "add" ? "Added" : "Removed"} entry`)
      }
    } catch {
      toast("Something went wrong", "error")
    }
  }

  async function handleDeleteAccount(id: string) {
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" })
      if (res.ok) {
        setDeleteConfirm(null)
        fetchAccounts()
        toast("Deleted successfully")
      }
    } catch {
      toast("Something went wrong", "error")
    }
  }

  async function handleToggleActive(acc: Account) {
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: acc.is_active === 1 ? 0 : 1 }),
      })
      if (res.ok) fetchAccounts()
    } catch { /* */ }
  }

  async function handleDeleteEntry(id: string) {
    try {
      const res = await fetch(`/api/ledger/${id}`, { method: "DELETE" })
      if (res.ok) {
        // Refresh both
        if (historyAccount) {
          const res2 = await fetch(`/api/ledger?account_id=${historyAccount.id}&limit=50`)
          if (res2.ok) setLedgerEntries(await res2.json())
        }
        fetchAccounts()
        toast("Deleted successfully")
      }
    } catch {
      toast("Something went wrong", "error")
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <h2 className="text-2xl font-mono font-bold text-[#00f0ff] neon-text">Accounts & Ledger</h2>
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <h2 className="text-2xl font-mono font-bold text-[#00f0ff] neon-text">Accounts & Ledger</h2>

      {categories.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No categories found. Run the seed script first.</p>
        </div>
      ) : (
        <Accordion>
          {categories
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((cat) => {
              const catAccounts = accountsForCategory(cat.id)
              const total = categoryTotal(cat.id)
              return (
                <AccordionItem key={cat.id} value={cat.id} className="cyber-border rounded-lg mb-3 px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{cat.icon}</span>
                      <span className="font-medium">{cat.name}</span>
                      <Badge variant="secondary" className="ml-2">{catAccounts.length}</Badge>
                      <span className="ml-auto mr-4 font-mono text-sm text-muted-foreground">
                        {formatCurrency(total, selectedCurrency)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {catAccounts.length > 0 ? (
                        <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              {isMarket(cat) && (
                                <>
                                  <TableHead>Symbol</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Avg Price</TableHead>
                                </>
                              )}
                              <TableHead className="text-right">Balance</TableHead>
                              {!selectedMember && <TableHead>Member</TableHead>}
                              <TableHead className="w-[160px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {catAccounts.map((acc) => {
                              const val = accountValue(acc)
                              const isClosed = acc.is_active === 0
                              return (
                                <TableRow key={acc.id} className={isClosed ? "opacity-50" : ""}>
                                  <TableCell className="font-medium">
                                    <span className="flex items-center gap-2">
                                      {acc.name}
                                      {isClosed && (
                                        <Badge variant="secondary" className="text-[10px] bg-gray-700 text-gray-400">Closed</Badge>
                                      )}
                                    </span>
                                  </TableCell>
                                  {isMarket(cat) && (
                                    <>
                                      <TableCell className="text-muted-foreground font-mono text-xs">{acc.symbol}</TableCell>
                                      <TableCell className="text-right font-mono">{acc.quantity}</TableCell>
                                      <TableCell className="text-right font-mono text-xs">
                                        {formatCurrency(convert(acc.avg_unit_price, acc.currency || "JPY"), selectedCurrency)}
                                      </TableCell>
                                    </>
                                  )}
                                  <TableCell className="text-right font-mono font-bold">
                                    {formatCurrency(val, selectedCurrency)}
                                  </TableCell>
                                  {!selectedMember && (
                                    <TableCell className="text-muted-foreground text-xs">{acc.member_name}</TableCell>
                                  )}
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {!isClosed && (
                                        <>
                                          <Button variant="ghost" size="icon-xs" title="Add funds" onClick={() => openAddEntry(acc, "add")}>
                                            <ArrowUpIcon className="text-green-400" />
                                          </Button>
                                          <Button variant="ghost" size="icon-xs" title="Remove funds" onClick={() => openAddEntry(acc, "remove")}>
                                            <ArrowDownIcon className="text-red-400" />
                                          </Button>
                                        </>
                                      )}
                                      <Button variant="ghost" size="icon-xs" title="View history" onClick={() => openHistory(acc)}>
                                        <ListIcon />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        title={isClosed ? "Reopen account" : "Close account"}
                                        onClick={() => handleToggleActive(acc)}
                                      >
                                        <ArchiveIcon className={isClosed ? "text-yellow-400" : "text-muted-foreground"} />
                                      </Button>
                                      {deleteConfirm === acc.id ? (
                                        <Button variant="destructive" size="xs" onClick={() => handleDeleteAccount(acc.id)}>
                                          Confirm
                                        </Button>
                                      ) : (
                                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteConfirm(acc.id)}>
                                          <TrashIcon />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-2">No accounts in this category</p>
                      )}
                      <Button variant="outline" size="sm" onClick={() => openAddAccount(cat)}>
                        <PlusIcon className="size-3.5 mr-1" /> Add Account
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
        </Accordion>
      )}

      {/* Add Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
            <DialogDescription>
              {activeCategory ? `Category: ${activeCategory.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={accountForm.name} onChange={(e) => setAccountForm(p => ({ ...p, name: e.target.value }))} placeholder="Account name" />
            </div>
            {activeCategory && isMarket(activeCategory) && (
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Select value={accountForm.symbol} onValueChange={(v) => v && setAccountForm(p => ({ ...p, symbol: v }))}>
                  <SelectTrigger className="w-full">
                    <span>{accountForm.symbol || "Select symbol"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategory.type === "crypto"
                      ? CRYPTO_SYMBOLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)
                      : METAL_SYMBOLS.map((s) => <SelectItem key={s.symbol} value={s.symbol}>{s.label}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={accountForm.family_member_id} onValueChange={(v) => v && setAccountForm(p => ({ ...p, family_member_id: v }))}>
                <SelectTrigger className="w-full">
                  <span>{members.find(m => m.id === accountForm.family_member_id)?.name || "Select member"}</span>
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={accountForm.notes} onChange={(e) => setAccountForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccount} disabled={!accountForm.name.trim() || !accountForm.family_member_id}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Ledger Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {entryForm.entry_type === "add" ? "Add Funds" : "Remove Funds"}
            </DialogTitle>
            <DialogDescription>
              {activeAccount ? activeAccount.name : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={entryForm.entry_date} onChange={(e) => setEntryForm(p => ({ ...p, entry_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={entryForm.entry_type} onValueChange={(v) => v && setEntryForm(p => ({ ...p, entry_type: v as "add" | "remove" }))}>
                <SelectTrigger className="w-full">
                  <span>{entryForm.entry_type === "add" ? "Add / Deposit" : "Remove / Withdraw"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add / Deposit</SelectItem>
                  <SelectItem value="remove">Remove / Withdraw</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {activeAccount && (categories.find(c => c.id === activeAccount.category_id)?.type === "crypto" || categories.find(c => c.id === activeAccount.category_id)?.type === "precious_metal")
                  ? "Quantity"
                  : "Amount (JPY)"
                }
              </Label>
              <Input
                type="number"
                step="any"
                value={entryForm.amount}
                onChange={(e) => setEntryForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            {activeAccount && (categories.find(c => c.id === activeAccount.category_id)?.type === "crypto" || categories.find(c => c.id === activeAccount.category_id)?.type === "precious_metal") && (
              <div className="space-y-2">
                <Label>Unit Price (JPY)</Label>
                <Input
                  type="number"
                  step="any"
                  value={entryForm.unit_price}
                  onChange={(e) => setEntryForm(p => ({ ...p, unit_price: e.target.value }))}
                  placeholder="Price per unit"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => activeAccount.symbol && fetchPriceForSymbol(
                    activeAccount.symbol,
                    categories.find(c => c.id === activeAccount.category_id)?.type || ""
                  )}
                >
                  Fetch live price
                </Button>
                {entryForm.amount && entryForm.unit_price && (
                  <p className="text-xs text-muted-foreground">
                    Total: {formatCurrency((parseFloat(entryForm.amount) || 0) * (parseFloat(entryForm.unit_price) || 0), "JPY")}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={entryForm.description} onChange={(e) => setEntryForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Salary, DCA buy..." />
            </div>
            <div className="space-y-2">
              <Label>Tag</Label>
              <Select value={entryForm.tag} onValueChange={(v) => setEntryForm(p => ({ ...p, tag: v === "__none__" ? "" : (v ?? "") }))}>
                <SelectTrigger className="w-full">
                  <span>{entryForm.tag || "Select tag (optional)"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {["salary", "rent", "bonus", "insurance", "utilities", "groceries", "dining", "atm", "investment", "gift", "allowance", "shopping", "travel", "market", "other"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveEntry}
              disabled={!entryForm.amount || parseFloat(entryForm.amount) === 0}
              className={entryForm.entry_type === "remove" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {entryForm.entry_type === "add" ? "Add" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ledger History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ledger History</DialogTitle>
            <DialogDescription>
              {historyAccount?.name} — all transactions
            </DialogDescription>
          </DialogHeader>
          {ledgerEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No entries yet</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.entry_date}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{
                          borderColor: e.amount >= 0 ? "#00ff88" : "#ff3366",
                          color: e.amount >= 0 ? "#00ff88" : "#ff3366",
                        }}
                      >
                        {e.entry_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono" style={{ color: e.amount >= 0 ? "#00ff88" : "#ff3366" }}>
                      {e.amount >= 0 ? "+" : ""}{e.amount}
                      {e.unit_price != null && (
                        <span className="text-muted-foreground text-[10px] ml-1">
                          @{formatCurrency(e.unit_price, "JPY")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {e.balance_after != null ? formatCurrency(e.balance_after, "JPY") : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {e.description}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteEntry(e.id)}>
                        <TrashIcon className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
