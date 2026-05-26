import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { MetricasView, type DailyMetric } from './metricas-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}

function isoDate(d: Date): string {
  return d.toISOString()
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function parseIsoDateOnly(s: string | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, da] = m
  const d = new Date(Number(y), Number(mo) - 1, Number(da))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function periodCutoff(period: Period): Date {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export default async function MagazordMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; mkt?: string; origem?: string }>
}) {
  const sp = await searchParams
  let period = parsePeriod(sp.period)

  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const mktFilter = (sp.mkt ?? '').trim() || null
  const origemRaw = (sp.origem ?? '').trim()
  const origemFilter = origemRaw && /^[0-9]+$/.test(origemRaw) ? Number(origemRaw) : null

  let cutoff: Date
  let endAt: Date | null = null

  if (period === 'custom' && customFrom && customTo) {
    cutoff = startOfDay(customFrom)
    endAt = endOfDay(customTo)
  } else if (customFrom && customTo) {
    period = 'custom'
    cutoff = startOfDay(customFrom)
    endAt = endOfDay(customTo)
  } else {
    if (period === 'custom') period = '30d'
    cutoff = periodCutoff(period)
  }

  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'magazord')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Métricas — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-outline">Sem conexão Magazord ativa.</p>
        </main>
      </>
    )
  }

  const [{ data: rows, error }, { data: mktRows }] = await Promise.all([
    supabase.rpc('mag_metrics_realtime', {
      p_connection_id: conn.id,
      p_cutoff: isoDate(cutoff),
      p_end: endAt ? isoDate(endAt) : null,
      p_marketplace: mktFilter,
      p_origem: origemFilter,
    }),
    supabase.rpc('mag_marketplaces', { p_connection_id: conn.id }),
  ])

  if (error) {
    return (
      <>
        <TopBar title="Métricas — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-error">Erro ao calcular métricas: {error.message}</p>
        </main>
      </>
    )
  }

  const marketplaces = ((mktRows ?? []) as Array<{ marketplace: string }>).map((r) => r.marketplace)

  return (
    <MetricasView
      rows={(rows ?? []) as DailyMetric[]}
      period={period}
      from={customFrom ? customFrom.toISOString().slice(0, 10) : null}
      to={customTo ? customTo.toISOString().slice(0, 10) : null}
      mkt={mktFilter}
      marketplaces={marketplaces}
      origem={origemFilter}
      nickname={conn.nickname}
    />
  )
}
