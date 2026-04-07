"use client"
import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type Toast = {
  id: number
  message: string
  type: "success" | "error"
}

type ToastContextValue = {
  toast: (message: string, type?: "success" | "error") => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let nextId = 0

  const toast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto px-4 py-2.5 text-xs font-bold tracking-wider uppercase shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200"
            style={{
              backgroundColor: t.type === "success" ? "rgba(0,255,65,0.1)" : "rgba(255,0,0,0.1)",
              border: `1px solid ${t.type === "success" ? "rgba(0,255,65,0.4)" : "rgba(255,0,0,0.4)"}`,
              color: t.type === "success" ? "#00FF41" : "#FF0000",
              backdropFilter: "blur(8px)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
