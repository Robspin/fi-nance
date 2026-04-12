"use client"

import { useEffect, useState } from "react"
import { useApp, type Tag } from "@/lib/context"
import { useToast } from "@/lib/toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, PencilIcon, TrashIcon } from "lucide-react"

type TagFormState = {
  name: string
  color_bg: string
  color_text: string
}

const emptyForm: TagFormState = {
  name: "",
  color_bg: "rgba(150,150,150,0.15)",
  color_text: "#969696",
}

export default function TagsPage() {
  const { tags, refreshTags } = useApp()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [form, setForm] = useState<TagFormState>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    refreshTags()
  }, [refreshTags])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(tag: Tag) {
    setEditing(tag)
    setForm({
      name: tag.name,
      color_bg: tag.color_bg,
      color_text: tag.color_text,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    const trimmed = form.name.trim()
    if (!trimmed) return

    try {
      if (editing) {
        const body: Record<string, unknown> = {
          color_bg: form.color_bg,
          color_text: form.color_text,
        }
        if (trimmed !== editing.name) body.new_name = trimmed
        const res = await fetch(`/api/tags/${encodeURIComponent(editing.name)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          setDialogOpen(false)
          refreshTags()
          toast("Tag updated")
        } else {
          const data = await res.json().catch(() => ({}))
          toast(data.error || "Failed to update tag", "error")
        }
      } else {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmed,
            color_bg: form.color_bg,
            color_text: form.color_text,
          }),
        })
        if (res.ok) {
          setDialogOpen(false)
          refreshTags()
          toast("Tag created")
        } else {
          const data = await res.json().catch(() => ({}))
          toast(data.error || "Failed to create tag", "error")
        }
      }
    } catch {
      toast("Something went wrong", "error")
    }
  }

  async function handleDelete(tag: Tag, force = false) {
    try {
      const url = `/api/tags/${encodeURIComponent(tag.name)}${force ? "?force=1" : ""}`
      const res = await fetch(url, { method: "DELETE" })
      if (res.ok) {
        setDeleteConfirm(null)
        refreshTags()
        toast("Tag deleted")
      } else if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        const usage: number = data.usage ?? 0
        const confirmed = window.confirm(
          `Tag "${tag.name}" is used by ${usage} ledger ${usage === 1 ? "entry" : "entries"}. Delete anyway? (The tag will be cleared from those entries.)`
        )
        if (confirmed) {
          await handleDelete(tag, true)
        }
      } else {
        toast("Failed to delete tag", "error")
      }
    } catch {
      toast("Something went wrong", "error")
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-mono font-bold text-[#00FFFF] nerv-text">TAGS</h2>
        <Button onClick={openAdd}>
          <PlusIcon className="size-4 mr-1" /> Add Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No tags yet</p>
          <p className="text-sm mt-1">Add tags to categorize your ledger entries</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map((tag) => (
            <div
              key={tag.name}
              className="eva-border rounded-lg p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  variant="outline"
                  className="text-xs font-mono"
                  style={{
                    background: tag.color_bg,
                    borderColor: tag.color_text,
                    color: tag.color_text,
                  }}
                >
                  {tag.name}
                </Badge>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon-xs" onClick={() => openEdit(tag)}>
                  <PencilIcon />
                </Button>
                {deleteConfirm === tag.name ? (
                  <Button variant="destructive" size="xs" onClick={() => handleDelete(tag)}>
                    Delete?
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon-xs" onClick={() => setDeleteConfirm(tag.name)}>
                    <TrashIcon />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Tag" : "Add Tag"}</DialogTitle>
            <DialogDescription>
              {editing ? "Rename or restyle this tag" : "Create a new ledger tag"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. salary"
              />
            </div>
            <div className="space-y-2">
              <Label>Text color (hex)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="color"
                  value={form.color_text}
                  onChange={(e) => setForm((p) => ({ ...p, color_text: e.target.value }))}
                  className="w-16 h-9 p-1"
                />
                <Input
                  value={form.color_text}
                  onChange={(e) => setForm((p) => ({ ...p, color_text: e.target.value }))}
                  placeholder="#00FF41"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Background color (CSS)</Label>
              <Input
                value={form.color_bg}
                onChange={(e) => setForm((p) => ({ ...p, color_bg: e.target.value }))}
                placeholder="rgba(0,255,65,0.15)"
              />
            </div>
            <div className="space-y-2">
              <Label>Preview</Label>
              <div>
                <Badge
                  variant="outline"
                  className="text-xs font-mono"
                  style={{
                    background: form.color_bg,
                    borderColor: form.color_text,
                    color: form.color_text,
                  }}
                >
                  {form.name || "preview"}
                </Badge>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
