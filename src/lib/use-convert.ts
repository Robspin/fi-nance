"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/context"

type Rates = Record<string, number>

export function useConvert() {
  const { selectedCurrency } = useApp()
  const [rates, setRates] = useState<Rates>({})
  const [btcPrice, setBtcPrice] = useState<number>(0)

  useEffect(() => {
    fetch("/api/prices?type=exchange&base=USD")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.rates && setRates(d.rates))
      .catch(() => {})

    // Fetch BTC price in USD for BTC conversion
    fetch("/api/prices?type=crypto&symbols=bitcoin&vs=usd")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.bitcoin?.usd && setBtcPrice(d.bitcoin.usd))
      .catch(() => {})
  }, [])

  // Convert a value from one currency to the selected display currency
  // rates are USD-based: rates[X] = how many X per 1 USD
  const convert = useCallback(
    (value: number, fromCurrency = "JPY") => {
      if (fromCurrency === selectedCurrency) return value
      if (!rates[fromCurrency] && fromCurrency !== "USD" && fromCurrency !== "BTC") return value

      // Step 1: convert to USD
      let usd: number
      if (fromCurrency === "USD") {
        usd = value
      } else if (fromCurrency === "BTC") {
        usd = value * btcPrice
      } else {
        usd = value / (rates[fromCurrency] || 1)
      }

      // Step 2: convert from USD to target
      if (selectedCurrency === "USD") return usd
      if (selectedCurrency === "BTC") {
        return btcPrice > 0 ? usd / btcPrice : 0
      }
      return usd * (rates[selectedCurrency] || 1)
    },
    [selectedCurrency, rates, btcPrice]
  )

  return { convert, rates, btcPrice, selectedCurrency }
}
