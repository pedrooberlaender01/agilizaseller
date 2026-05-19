import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { Period } from '@/components/metrics-chart'
import type { ShopeeDailyMetric } from '@/types'
import { MetricasView } from './metricas-view'

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes') return raw
  return '30d'
}

function periodRange(period: Period): { current: { from: string; to: string }; previous: { from: string; to: string } } {
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

function NoConnectionState() {
  return (
    <>
      <TopBar title="Métricas — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações para começar a sincronizar métricas.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-sm font-medium text-on-tertiary transition-colors hover:bg-tertiary/90"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function ShopeeMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const { current: cur, previous: prev } = periodRange(period)

  const [{ data: currentRows }, { data: previousRows }] = await Promise.all([
    supabase
      .from('shopee_daily_metrics')
      .select('*')
      .eq('connection_id', conn.id)
      .gte('date', cur.from)
      .lte('date', cur.to)
      .order('date', { ascending: true }),
    supabase
      .from('shopee_daily_metrics')
      .select('*')
      .eq('connection_id', conn.id)
      .gte('date', prev.from)
      .lte('date', prev.to)
      .order('date', { ascending: true }),
  ])

  return (
    <MetricasView
      current={(currentRows ?? []) as ShopeeDailyMetric[]}
      previous={(previousRows ?? []) as ShopeeDailyMetric[]}
      period={period}
      nickname={conn.nickname}
    />
  )
}
