export type Period = '7d' | '30d' | '90d' | 'mes'

export function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes') return raw
  return '30d'
}

export function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export interface DateRange {
  current: { from: string; to: string }
  previous: { from: string; to: string }
}

export function periodRange(period: Period): DateRange {
  const today = new Date()
  const toStr = today.toISOString().slice(0, 10)

  if (period === 'mes') {
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const days = Math.max(1, today.getDate())
    const prevTo = new Date(startMonth)
    prevTo.setDate(prevTo.getDate() - 1)
    const prevFrom = new Date(prevTo)
    prevFrom.setDate(prevFrom.getDate() - days + 1)
    return {
      current: { from: startMonth.toISOString().slice(0, 10), to: toStr },
      previous: { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) },
    }
  }

  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const from = new Date(today)
  from.setDate(from.getDate() - days + 1)
  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - days + 1)
  return {
    current: { from: from.toISOString().slice(0, 10), to: toStr },
    previous: { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) },
  }
}

export function customRange(fromIso: string, toIso: string): DateRange {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  const prevTo = new Date(from)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - days + 1)
  return {
    current: { from: fromIso, to: toIso },
    previous: { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) },
  }
}
