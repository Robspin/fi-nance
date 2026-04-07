"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { label: "Dashboard", href: "/" },
  { label: "Accounts", href: "/assets" },
  { label: "Transactions", href: "/transactions" },
  { label: "Reports", href: "/reports" },
  { label: "Rates", href: "/rates" },
  { label: "Members", href: "/members" },
]

export function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-nowrap gap-1 px-6 py-2 bg-[oklch(0.13_0.01_270)] border-b border-[rgba(0,240,255,0.1)] overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "text-[#00f0ff] bg-[rgba(0,240,255,0.08)]"
                : "text-muted-foreground hover:text-foreground hover:bg-[rgba(0,240,255,0.04)]"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#00f0ff] rounded-full" style={{ boxShadow: "0 0 8px rgba(0, 240, 255, 0.6)" }} />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
