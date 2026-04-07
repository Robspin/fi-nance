import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { AppProvider } from "@/lib/context"
import { ToastProvider } from "@/lib/toast"
import { Header } from "@/components/header"
import { NavTabs } from "@/components/nav-tabs"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "FINANCE//TRACKER",
  description: "Family finance tracker with cyberpunk aesthetics",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProvider>
          <ToastProvider>
            <Header />
            <NavTabs />
            <main className="flex-1 cyber-grid">{children}</main>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  )
}
