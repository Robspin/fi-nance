import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { AppProvider } from "@/lib/context"
import { ToastProvider } from "@/lib/toast"
import { Header } from "@/components/header"
import { NavTabs } from "@/components/nav-tabs"
import { EvaBackground } from "@/components/eva-background"

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "fi-nance",
  description: "NERV financial operations interface",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-mono eva-scanlines">
        <AppProvider>
          <ToastProvider>
            <EvaBackground />
            <Header />
            <NavTabs />
            <main className="flex-1 eva-grid relative" style={{ zIndex: 1 }}>{children}</main>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  )
}
