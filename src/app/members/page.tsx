"use client"

import { useEffect, useState, useCallback } from "react"
import { useApp, type Member } from "@/lib/context"
import { useToast } from "@/lib/toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, PencilIcon, TrashIcon, UserIcon } from "lucide-react"

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  me: { bg: "rgba(255,72,0,0.15)", text: "#FF4800" },
  wife: { bg: "rgba(0,255,255,0.15)", text: "#00FFFF" },
  child: { bg: "rgba(255,215,0,0.15)", text: "#FFD700" },
}

export default function MembersPage() {
  const { members, refreshMembers } = useApp()
  const { toast } = useToast()
  const [accountCounts, setAccountCounts] = useState<Record<string, number>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [name, setName] = useState("")
  const [role, setRole] = useState<string>("me")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchAccountCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts")
      if (res.ok) {
        const accs = await res.json()
        const counts: Record<string, number> = {}
        for (const a of accs) {
          counts[a.family_member_id] = (counts[a.family_member_id] || 0) + 1
        }
        setAccountCounts(counts)
      }
    } catch { /* */ }
  }, [])

  useEffect(() => {
    refreshMembers()
    fetchAccountCounts()
  }, [refreshMembers, fetchAccountCounts])

  function openAdd() {
    setEditing(null)
    setName("")
    setRole("me")
    setDialogOpen(true)
  }

  function openEdit(member: Member) {
    setEditing(member)
    setName(member.name)
    setRole(member.role)
    setDialogOpen(true)
  }

  async function handleSave() {
    const body = { name, role }
    const url = editing ? `/api/members/${editing.id}` : "/api/members"
    const method = editing ? "PUT" : "POST"
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (res.ok) {
        setDialogOpen(false)
        refreshMembers()
        fetchAccountCounts()
        toast(editing ? "Member updated" : "Member added")
      }
    } catch { /* */ }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/members/${id}`, { method: "DELETE" })
      if (res.ok) {
        setDeleteConfirm(null)
        refreshMembers()
        fetchAccountCounts()
        toast("Member deleted")
      }
    } catch { /* */ }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold text-[#FF4800] nerv-text">PILOTS</h2>
        <Button onClick={openAdd}>
          <PlusIcon className="size-4 mr-1" /> Add Member
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No members yet</p>
          <p className="text-sm mt-1">Add family members to start tracking finances</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => {
            const colors = ROLE_COLORS[member.role] || ROLE_COLORS.me
            const count = accountCounts[member.id] || 0
            return (
              <Card
                key={member.id}
                className="eva-border relative group"
                style={{ boxShadow: `0 0 8px ${colors.bg}` }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center size-10 rounded-full"
                        style={{ backgroundColor: colors.bg }}
                      >
                        <UserIcon className="size-5" style={{ color: colors.text }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{member.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className="mt-1 text-xs"
                          style={{ borderColor: colors.text, color: colors.text }}
                        >
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-xs" onClick={() => openEdit(member)}>
                        <PencilIcon />
                      </Button>
                      {deleteConfirm === member.id ? (
                        <Button variant="destructive" size="xs" onClick={() => handleDelete(member.id)}>
                          Delete?
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteConfirm(member.id)}>
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {count} {count === 1 ? "account" : "accounts"}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Member" : "Add Member"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update member details" : "Add a new family member"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Member name" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Me</SelectItem>
                  <SelectItem value="wife">Wife</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
