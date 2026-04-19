"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { DownloadIcon, FileSpreadsheetIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react"

type ImportResult = {
  success: boolean
  summary?: {
    rows_parsed: number
    members_created: number
    categories_created: number
    accounts_created: number
    ledger_entries_created: number
  }
  error?: string
}

export default function ImportExportPage() {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [wipeFirst, setWipeFirst] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImport(file: File) {
    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (wipeFirst) formData.append("wipe", "true")

      const res = await fetch("/api/import/excel", { method: "POST", body: formData })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ success: false, error: String(err) })
    } finally {
      setImporting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch("/api/export/excel")
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "finance-export.xlsx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(String(err))
    } finally {
      setExporting(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".xlsx")) handleImport(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImport(file)
    e.target.value = ""
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <h2 className="text-lg font-bold tracking-wider text-[#00FFFF] uppercase">
        Import / Export
      </h2>

      {/* Import Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider text-[#999] uppercase">
          Import from Excel
        </h3>

        <label className="flex items-center gap-2 text-xs text-[#888] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={wipeFirst}
            onChange={(e) => setWipeFirst(e.target.checked)}
            className="accent-[#00FFFF]"
          />
          Wipe existing data before import
        </label>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-[#00FFFF] bg-[rgba(0,255,255,0.06)]"
              : "border-[rgba(0,255,255,0.15)] hover:border-[rgba(0,255,255,0.3)] hover:bg-[rgba(0,255,255,0.02)]"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={onFileChange}
            className="hidden"
          />
          <FileSpreadsheetIcon className="mx-auto mb-3 w-10 h-10 text-[#555]" />
          <p className="text-sm text-[#888]">
            {importing ? "Importing..." : "Drop .xlsx file here or click to browse"}
          </p>
          <p className="text-xs text-[#555] mt-1">
            Template format: Date | Member | Category | Account | Symbol | Currency | Amount | UnitPriceJPY
          </p>
        </div>

        {result && (
          <div className={`rounded-lg p-4 text-sm ${
            result.success
              ? "bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.2)]"
              : "bg-[rgba(255,0,0,0.08)] border border-[rgba(255,0,0,0.2)]"
          }`}>
            {result.success ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#00FF41] font-semibold">
                  <CheckCircleIcon className="w-4 h-4" />
                  Import successful
                </div>
                <div className="text-[#888] text-xs space-y-0.5 mt-2">
                  <p>Rows parsed: {result.summary?.rows_parsed}</p>
                  <p>Members: {result.summary?.members_created}</p>
                  <p>Categories: {result.summary?.categories_created}</p>
                  <p>Accounts: {result.summary?.accounts_created}</p>
                  <p>Ledger entries: {result.summary?.ledger_entries_created}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#FF0000]">
                <AlertCircleIcon className="w-4 h-4" />
                {result.error}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Export Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider text-[#999] uppercase">
          Export to Excel
        </h3>
        <p className="text-xs text-[#666]">
          Exports monthly snapshots (as of 24th) for all members and accounts.
        </p>
        <Button
          onClick={handleExport}
          disabled={exporting}
          variant="outline"
          className="border-[rgba(0,255,255,0.2)] text-[#00FFFF] hover:bg-[rgba(0,255,255,0.06)] hover:border-[rgba(0,255,255,0.4)]"
        >
          {exporting ? (
            "Exporting..."
          ) : (
            <>
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download Export
            </>
          )}
        </Button>
        {exportError && (
          <div className="rounded-lg p-4 text-sm bg-[rgba(255,0,0,0.08)] border border-[rgba(255,0,0,0.2)]">
            <div className="flex items-center gap-2 text-[#FF0000]">
              <AlertCircleIcon className="w-4 h-4" />
              {exportError}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
