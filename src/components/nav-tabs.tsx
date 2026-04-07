"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { label: "DASHBOARD", href: "/" },
  { label: "ACCOUNTS", href: "/assets" },
  { label: "LEDGER", href: "/transactions" },
  { label: "REPORTS", href: "/reports" },
  { label: "RATES", href: "/rates" },
  { label: "PILOTS", href: "/members" },
]

export function NavTabs() {
  const pathname = usePathname()

  return (
    <nav
      className="flex flex-nowrap gap-0 px-4 sm:px-6 bg-[#0A0A0A]/90 border-b border-[rgba(255,72,0,0.15)] overflow-x-auto relative z-10"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-4 py-2.5 text-[11px] font-bold tracking-[0.12em] transition-colors border-b-2 ${
              isActive
                ? "text-[#FF4800] border-[#FF4800] bg-[rgba(255,72,0,0.06)]"
                : "text-[#666] border-transparent hover:text-[#999] hover:bg-[rgba(255,72,0,0.03)]"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
