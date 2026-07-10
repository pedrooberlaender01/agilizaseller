import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { Period } from '@/components/metrics-chart'
import type { ShopeeDailyMetric } from '@/types'
import { MetricasView } from './metricas-view'

export const revalidate = 60

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

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? s : null
}

function customRange(fromIso: string, toIso: string): { current: { from: string; to: string }; previous: { from: string; to: string } } {
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

export default async function ShopeeMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const isCustom = !!(customFrom && customTo)
  const { current: cur, previous: prev } = isCustom
    ? customRange(customFrom, customTo)
    : periodRange(period)

  const [
    { data: currentRows },
    { data: previousRows },
    { data: escrowCentsCur },
    { data: escrowCentsPrev },
    { data: affiliateCur },
    { data: affiliatePrev },
  ] = await Promise.all([
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
    // Soma no servidor via RPC — trazer linhas estoura o cap 1000 do Supabase (5k+ tx no período).
    supabase.rpc('sum_shopee_wallet_escrow', { p_conn: conn.id, p_from: cur.from, p_to: cur.to }),
    supabase.rpc('sum_shopee_wallet_escrow', { p_conn: conn.id, p_from: prev.from, p_to: prev.to }),
    // AMS snapshot — period_type baseado em diff dias do filter
    (() => {
      const days = Math.round((new Date(cur.to).getTime() - new Date(cur.from).getTime()) / 86400_000) + 1
      const periodType = days <= 7 ? 'Last7d' : 'Last30d'
      return supabase
        .from('shopee_affiliate_performance')
        .select('commission_cents, period_end, period_type')
        .eq('connection_id', conn.id)
        .eq('period_type', periodType)
        .order('period_end', { ascending: false })
        .limit(500)
    })(),
    (() => {
      const days = Math.round((new Date(prev.to).getTime() - new Date(prev.from).getTime()) / 86400_000) + 1
      const periodType = days <= 7 ? 'Last7d' : 'Last30d'
      return supabase
        .from('shopee_affiliate_performance')
        .select('commission_cents, period_end, period_type')
        .eq('connection_id', conn.id)
        .eq('period_type', periodType)
        .order('period_end', { ascending: false })
        .limit(500)
    })(),
  ])

  // Repasse liberado no período = escrow que a Shopee liberou (caiu na carteira). Card #72.
  // RPC retorna cents (bigint) somado no servidor — evita o cap 1000 de linhas do Supabase.
  const repasseCur = Number(escrowCentsCur ?? 0) / 100
  const repassePrev = Number(escrowCentsPrev ?? 0) / 100

  // Snapshot AMS Last30d: soma todas commission_cents do snapshot mais recente
  function sumAffiliateLatestSnapshot(rows: { commission_cents: number | null; period_end: string | null }[] | null): number {
    if (!rows || rows.length === 0) return 0
    const latest = rows[0]?.period_end
    if (!latest) return 0
    return rows
      .filter(r => r.period_end === latest)
      .reduce((a, r) => a + (Number(r.commission_cents) || 0), 0) / 100
  }
  const comissaoAfiliadosCur = sumAffiliateLatestSnapshot(affiliateCur as { commission_cents: number | null; period_end: string | null }[] | null)
  const comissaoAfiliadosPrev = sumAffiliateLatestSnapshot(affiliatePrev as { commission_cents: number | null; period_end: string | null }[] | null)

  return (
    <MetricasView
      current={(currentRows ?? []) as ShopeeDailyMetric[]}
      previous={(previousRows ?? []) as ShopeeDailyMetric[]}
      period={period}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
      repasseCur={repasseCur}
      repassePrev={repassePrev}
      comissaoAfiliadosCur={comissaoAfiliadosCur}
      comissaoAfiliadosPrev={comissaoAfiliadosPrev}
      nickname={conn.nickname}
    />
  )
}
