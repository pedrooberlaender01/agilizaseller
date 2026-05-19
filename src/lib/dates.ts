const LOCALE = 'pt-BR'

export function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function fmtTime(s: string): string {
  return new Date(s).toLocaleTimeString(LOCALE, {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function fmtDateLong(s: string): string {
  return new Date(s).toLocaleDateString(LOCALE, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function fmtCurrency(v: number): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' }).format(v)
}

export function fmtNumber(v: number): string {
  return new Intl.NumberFormat(LOCALE).format(v)
}

export function timeAgo(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'agora'
  if (mins  < 60) return `há ${mins} min`
  if (hours < 24) return `há ${hours}h`
  if (days  === 1) return 'ontem'
  return fmtDate(s)
}

export function timeAgoDetailed(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'agora'
  if (mins  < 60) return `há ${mins} min`
  if (hours < 24) {
    const m = mins % 60
    return m > 0 ? `há ${hours}h ${m}min` : `há ${hours}h`
  }
  if (days === 1) return 'ontem'
  return new Date(s).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })
}
