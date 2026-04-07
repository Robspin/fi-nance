export function formatCurrency(amount: number, currency: string): string {
  if (currency === 'BTC') {
    return `₿${amount.toFixed(amount < 0.01 ? 6 : 4)}`
  }
  if (currency === 'JPY') {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function formatShort(value: number, currency: string): string {
  if (currency === 'JPY') {
    if (Math.abs(value) >= 100_000_000) {
      return `${(value / 100_000_000).toFixed(1)}億`
    }
    if (Math.abs(value) >= 10_000) {
      return `${(value / 10_000).toFixed(1)}万`
    }
    return value.toLocaleString('ja-JP')
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toFixed(2)
}
