import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { RevenueChart } from '@/components/revenue-chart'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { PeriodFilter, type Period } from './period-filter'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Marketplace = 'magazord' | 'shein' | 'shopee'

type DailyMetric = {
  connection_id: string
  date?: string
  metric_date?: string
  origem?: number | null
  orders_count: number
  orders_aprovados_count?: number
  orders_cancelled_count?: number
  cancellations?: number
  gross_revenue: number | string
  net_revenue?: number | string
  total_frete?: number | string
  total_desconto?: number | string
  items_sold?: number
  ticket_medio?: number | string
}

type SyncLog = {
  workflow: string
  status: string
  finished_at: string | null
  started_at: string | null
  records_processed: number | null
  error_message: string | null
}

const fmtBrl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtBrlCompact = (n: number) => {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `R$ ${(n / 1000).toFixed(0)}k`
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const MARKETPLACE_LABEL: Record<Marketplace, string> = {
  magazord: 'Magazord',
  shein: 'Shein',
  shopee: 'Shopee',
}

const RPC_NAME: Record<Marketplace, string> = {
  magazord: 'mag_metrics_realtime',
  shein: 'shein_metrics_realtime',
  shopee: 'shopee_metrics_realtime',
}

function relTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `Há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Há ${hours}h`
  const days = Math.floor(hours / 24)
  return `Há ${days}d`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === 'all' || raw === 'custom') return raw
  return '30d'
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

function presetCutoff(period: Period): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function periodTitle(period: Period, from: Date | null, to: Date | null): string {
  if (period === 'custom' && from && to) {
    const f = `${String(from.getDate()).padStart(2, '0')}/${String(from.getMonth() + 1).padStart(2, '0')}/${from.getFullYear()}`
    const t = `${String(to.getDate()).padStart(2, '0')}/${String(to.getMonth() + 1).padStart(2, '0')}/${to.getFullYear()}`
    return `${f} → ${t}`
  }
  if (period === '7d') return 'Últimos 7 dias'
  if (period === 'all') return 'Período total'
  return 'Últimos 30 dias'
}

function chartDaysCount(period: Period, from: Date | null, to: Date | null): number {
  if (period === '7d') return 7
  if (period === '30d') return 30
  if (period === 'all') return 30
  if (period === 'custom' && from && to) {
    const diff = Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1
    return Math.max(1, Math.min(30, diff))
  }
  return 30
}

function buildChartData(
  rows: DailyMetric[],
  days: number,
  endRef: Date | null,
) {
  const end = endRef ? new Date(endRef) : new Date()
  end.setHours(0, 0, 0, 0)

  const byDate = new Map<string, number>()
  for (const r of rows) {
    const key = (r.date ?? r.metric_date) as string | undefined
    if (!key) continue
    byDate.set(key, (byDate.get(key) ?? 0) + Number(r.gross_revenue ?? 0))
  }

  const out: { day: string; faturamento: number; lucro: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(end.getDate() - i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const lbl = days <= 7
      ? WEEKDAY_SHORT[d.getDay()]
      : `${String(d.getDate()).padStart(2, '0')}/${MONTH_SHORT[d.getMonth()]}`
    out.push({
      day: lbl,
      faturamento: byDate.get(iso) ?? 0,
      lucro: 0,
    })
  }
  return out
}

type MarketplaceData = {
  marketplace: Marketplace
  nickname: string | null
  metrics: DailyMetric[]
  syncs: SyncLog[]
  feesTotal?: number
  estimatedIncomeTotal?: number
}

async function fetchMarketplaceData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marketplace: Marketplace,
  cutoff: Date | null,
  endAt: Date | null,
): Promise<MarketplaceData | null> {
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', marketplace)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return null

  const cutoffIso = cutoff?.toISOString() ?? '1970-01-01T00:00:00.000Z'

  const [{ data: rows }, { data: syncRows }] = await Promise.all([
    supabase.rpc(RPC_NAME[marketplace], {
      p_connection_id: conn.id,
      p_cutoff: cutoffIso,
      p_end: endAt?.toISOString() ?? null,
    }),
    supabase
      .from('sync_logs')
      .select('workflow, status, finished_at, started_at, records_processed, error_message')
      .ilike('workflow', `${marketplace}%`)
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(6),
  ])

  let feesTotal: number | undefined
  let estimatedIncomeTotal: number | undefined
  if (marketplace === 'shein') {
    let feeQuery = supabase
      .from('shein_order_items')
      .select('commission, service_charge, estimated_income, shein_orders!inner(connection_id, order_time)')
      .eq('shein_orders.connection_id', conn.id)
      .gte('shein_orders.order_time', cutoffIso)
    if (endAt) feeQuery = feeQuery.lt('shein_orders.order_time', endAt.toISOString())
    const { data: feeRows } = await feeQuery
    let f = 0
    let est = 0
    for (const r of (feeRows ?? []) as Array<{ commission: number | string | null; service_charge: number | string | null; estimated_income: number | string | null }>) {
      f += Number(r.commission ?? 0) + Number(r.service_charge ?? 0)
      est += Number(r.estimated_income ?? 0)
    }
    feesTotal = f
    estimatedIncomeTotal = est
  }

  return {
    marketplace,
    nickname: conn.nickname ?? null,
    metrics: (rows ?? []) as DailyMetric[],
    syncs: (syncRows ?? []) as SyncLog[],
    feesTotal,
    estimatedIncomeTotal,
  }
}

type SectionData = {
  title: string
  subtitle: string
  metrics: DailyMetric[]
  syncs: SyncLog[]
  stripPrefixes: string[]
  feesTotal?: number
  estimatedIncomeTotal?: number
}

function toSection(item: MarketplaceData): SectionData {
  return {
    title: MARKETPLACE_LABEL[item.marketplace],
    subtitle: '',
    metrics: item.metrics,
    syncs: item.syncs,
    stripPrefixes: [`${item.marketplace}-`],
    feesTotal: item.feesTotal,
    estimatedIncomeTotal: item.estimatedIncomeTotal,
  }
}

function consolidate(items: MarketplaceData[]): SectionData {
  const allSyncs = items
    .flatMap((i) => i.syncs)
    .sort((a, b) => {
      const at = new Date(a.finished_at ?? a.started_at ?? 0).getTime()
      const bt = new Date(b.finished_at ?? b.started_at ?? 0).getTime()
      return bt - at
    })
    .slice(0, 6)
  const anyFees = items.some((i) => i.feesTotal != null)
  const fees = anyFees ? items.reduce((s, i) => s + (i.feesTotal ?? 0), 0) : undefined
  const est = anyFees ? items.reduce((s, i) => s + (i.estimatedIncomeTotal ?? 0), 0) : undefined
  return {
    title: 'Consolidado',
    subtitle: `${items.length} marketplace${items.length === 1 ? '' : 's'}`,
    metrics: items.flatMap((i) => i.metrics),
    syncs: allSyncs,
    stripPrefixes: items.map((i) => `${i.marketplace}-`),
    feesTotal: fees,
    estimatedIncomeTotal: est,
  }
}

function Section({
  data,
  periodLabelText,
  chartDays,
  chartEnd,
}: {
  data: SectionData
  periodLabelText: string
  chartDays: number
  chartEnd: Date | null
}) {
  const label = data.title

  const totals = data.metrics.reduce(
    (acc, r) => {
      acc.revenue += Number(r.gross_revenue ?? 0)
      acc.orders += Number(r.orders_count ?? 0)
      acc.aprovados += Number(r.orders_aprovados_count ?? r.orders_count ?? 0)
      acc.cancelled += Number(r.orders_cancelled_count ?? r.cancellations ?? 0)
      acc.frete += Number(r.total_frete ?? 0)
      acc.desconto += Number(r.total_desconto ?? 0)
      return acc
    },
    { revenue: 0, orders: 0, aprovados: 0, cancelled: 0, frete: 0, desconto: 0 },
  )

  const ticketMedio = totals.aprovados > 0 ? totals.revenue / totals.aprovados : 0
  const totalAttempts = totals.aprovados + totals.cancelled
  const cancelRate = totalAttempts > 0 ? (totals.cancelled / totalAttempts) * 100 : 0
  const approvalRate = totalAttempts > 0 ? (totals.aprovados / totalAttempts) * 100 : 0

  const kpis: { label: string; value: string; sub: string; icon: string; tone: string }[] = [
    { label: 'Faturamento', value: fmtBrl(totals.revenue), sub: `${periodLabelText.toLowerCase()} · aprovados`, icon: 'payments', tone: 'text-secondary' },
    { label: 'Pedidos Aprovados', value: fmtInt(totals.aprovados), sub: `${approvalRate.toFixed(1)}% taxa aprovação`, icon: 'shopping_bag', tone: 'text-primary' },
    { label: 'Ticket Médio', value: fmtBrl(ticketMedio), sub: `${fmtInt(totals.orders)} pedidos válidos`, icon: 'trending_up', tone: 'text-white' },
    { label: 'Cancelamentos', value: fmtInt(totals.cancelled), sub: `${cancelRate.toFixed(1)}% taxa cancel.`, icon: 'cancel', tone: 'text-error' },
  ]

  if (data.feesTotal != null) {
    const feesPct = totals.revenue > 0 ? (data.feesTotal / totals.revenue) * 100 : 0
    kpis.push({
      label: 'Taxas marketplace',
      value: fmtBrl(data.feesTotal),
      sub: `${feesPct.toFixed(1)}% sobre bruto`,
      icon: 'percent',
      tone: 'text-error',
    })
  }
  if (data.estimatedIncomeTotal != null) {
    kpis.push({
      label: 'Receita líquida est.',
      value: fmtBrl(data.estimatedIncomeTotal),
      sub: 'após taxas Shein',
      icon: 'account_balance_wallet',
      tone: 'text-secondary',
    })
  }

  const chartData = buildChartData(data.metrics, chartDays, chartEnd)
  const peakDay = chartData.reduce((m, d) => (d.faturamento > m.faturamento ? d : m), chartData[0])
  const chartTotalRevenue = chartData.reduce((sum, d) => sum + d.faturamento, 0)

  const cancelLimitPct = 2.5
  const approvalTarget = 90

  const healthBars = [
    {
      label: 'Taxa de cancelamento',
      current: `${cancelRate.toFixed(1)}%`,
      limit: `${cancelLimitPct.toFixed(1)}%`,
      percent: Math.min(100, (cancelRate / cancelLimitPct) * 100),
      color: cancelRate < cancelLimitPct * 0.5 ? 'bg-secondary' : cancelRate < cancelLimitPct ? 'bg-tertiary' : 'bg-error',
    },
    {
      label: 'Taxa de aprovação',
      current: `${approvalRate.toFixed(1)}%`,
      limit: `${approvalTarget}%`,
      percent: Math.min(100, (approvalRate / approvalTarget) * 100),
      color: approvalRate >= approvalTarget ? 'bg-secondary' : approvalRate >= approvalTarget * 0.85 ? 'bg-tertiary' : 'bg-error',
    },
    {
      label: 'Desconto sobre receita',
      current: totals.revenue > 0 ? `${((totals.desconto / totals.revenue) * 100).toFixed(1)}%` : '0,0%',
      limit: '15%',
      percent: totals.revenue > 0 ? Math.min(100, ((totals.desconto / totals.revenue) * 100) / 15 * 100) : 0,
      color: 'bg-primary',
    },
  ]

  const chartSubtitle = chartDays <= 7
    ? `Últimos ${chartDays} dias · ${label} · BRL`
    : `Últimos ${chartDays} dias · ${label} · BRL`

  return (
    <section className="space-y-lg">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
        <div>
          <h3 className="flex items-baseline gap-2 text-[22px] font-bold leading-tight tracking-tight text-zinc-50">
            {label}
            {data.subtitle && (
              <span className="text-sm font-normal text-zinc-500">· {data.subtitle}</span>
            )}
          </h3>
          <p className="mt-1 text-sm text-zinc-400">{periodLabelText}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900/70"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">{k.label}</span>
              <span className={cn('material-symbols-outlined text-[18px]', k.tone)}>{k.icon}</span>
            </div>
            <div className="mt-3">
              <div className="text-[30px] font-bold leading-none tracking-tight text-zinc-50 tabular-nums">
                {k.value}
              </div>
              <p className="mt-2 text-xs text-zinc-500">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-gutter lg:flex-row">
        <RevenueChart
          data={chartData}
          subtitle={chartSubtitle}
          title="Faturamento diário"
          showLucro={false}
        />

        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 lg:w-[35%]">
          <div className="flex items-center justify-between border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Resumo</h3>
            <span className="rounded bg-primary/10 px-2 py-1 font-label-md text-label-md text-primary">
              {label}
            </span>
          </div>
          <div className="flex flex-col gap-5 p-lg">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Faturamento ({chartDays}d gráfico)</p>
              <p className="font-display text-[26px] font-bold text-white">{fmtBrl(chartTotalRevenue)}</p>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Pico de vendas</p>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-semibold text-white">{peakDay?.day ?? '—'}</p>
                <p className="font-mono text-sm text-secondary">{fmtBrlCompact(peakDay?.faturamento ?? 0)}</p>
              </div>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Frete pago (período)</p>
              <p className="font-mono text-base text-slate-300">{fmtBrl(totals.frete)}</p>
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">Descontos (período)</p>
              <p className="font-mono text-base text-slate-300">{fmtBrl(totals.desconto)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Saúde da Conta — {label}</h3>
            <p className="mt-1 text-xs text-slate-400">Indicadores do período selecionado.</p>
          </div>
          <div className="flex flex-col gap-6 p-lg">
            {healthBars.map((h) => (
              <div key={h.label}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-label-md text-label-md text-slate-300">{h.label}</span>
                  <span className="font-label-md text-label-md text-white">
                    {h.current} <span className="text-slate-500">/ {h.limit}</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', h.color)}
                    style={{ width: `${h.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Status do Sistema — {label}</h3>
            <p className="mt-1 text-xs text-slate-400">Últimas execuções dos workflows n8n.</p>
          </div>
          <div className="flex flex-col gap-4 p-lg">
            {data.syncs.length === 0 ? (
              <p className="py-4 text-center text-sm text-outline">Sem execuções registradas ainda.</p>
            ) : (
              data.syncs.map((s, i) => {
                const ok = s.status === 'success'
                let workflowLabel = s.workflow
                for (const prefix of data.stripPrefixes) {
                  workflowLabel = workflowLabel.replace(new RegExp(`^${prefix}`), '')
                }
                const label = workflowLabel.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                return (
                  <div
                    key={`${s.workflow}-${i}`}
                    className={cn(
                      'flex items-center justify-between',
                      i < data.syncs.length - 1 && 'border-b border-white/5 pb-4',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn('h-2 w-2 rounded-full', ok ? 'bg-secondary' : 'bg-error')}
                        style={{
                          boxShadow: ok
                            ? '0 0 8px rgba(69,223,164,0.55)'
                            : '0 0 8px rgba(255,180,171,0.55)',
                        }}
                      />
                      <div>
                        <p className="font-body-md text-body-md text-slate-300">{label}</p>
                        {!ok && s.error_message && (
                          <p className="mt-0.5 max-w-[260px] truncate font-mono text-[11px] text-error">
                            {s.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('font-mono-sm text-mono-sm', ok ? 'text-slate-500' : 'text-error')}>
                        {relTime(s.finished_at ?? s.started_at)}
                      </p>
                      {s.records_processed != null && s.records_processed > 0 && (
                        <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                          {s.records_processed} registros
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

type Filter = 'all' | Marketplace

function parseFilter(raw: string | undefined): Filter {
  if (raw === 'magazord' || raw === 'shein' || raw === 'shopee') return raw
  return 'all'
}

function buildHref(filter: Filter, period: Period, from: string | null, to: string | null): string {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('marketplace', filter)
  if (period !== '30d') params.set('period', period)
  if (period === 'custom' && from && to) {
    params.set('from', from)
    params.set('to', to)
  }
  const qs = params.toString()
  return qs ? `/dashboard?${qs}` : '/dashboard'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ marketplace?: string; period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const filter = parseFilter(sp.marketplace)
  let period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)

  let cutoff: Date | null
  let endAt: Date | null = null
  if ((period === 'custom' || (customFrom && customTo)) && customFrom && customTo) {
    period = 'custom'
    cutoff = startOfDay(customFrom)
    endAt = endOfDay(customTo)
  } else {
    if (period === 'custom') period = '30d'
    cutoff = presetCutoff(period)
  }

  const supabase = await createClient()

  const marketplaces: Marketplace[] = ['magazord', 'shein', 'shopee']
  const results = await Promise.all(
    marketplaces.map((m) => fetchMarketplaceData(supabase, m, cutoff, endAt)),
  )
  const active = results.filter((r): r is MarketplaceData => r !== null)

  if (active.length === 0) {
    return (
      <>
        <TopBar title="Dashboard" />
        <main className="flex-1 overflow-y-auto p-lg">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-xl text-center">
              <span className="material-symbols-outlined text-3xl text-outline">link_off</span>
              <p className="text-sm text-slate-400">Sem conexões ativas. Configure marketplaces em Configurações.</p>
            </div>
          </div>
        </main>
      </>
    )
  }

  const filtered = filter === 'all' ? active : active.filter((d) => d.marketplace === filter)
  const sections: SectionData[] =
    filter === 'all' ? [consolidate(active)] : filtered.map(toSection)
  const labels = active.map((d) => MARKETPLACE_LABEL[d.marketplace]).join(' · ')

  const filterOptions: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    ...active.map((d) => ({ value: d.marketplace as Filter, label: MARKETPLACE_LABEL[d.marketplace] })),
  ]

  const periodLabelText = periodTitle(period, customFrom, customTo)
  const chartDays = chartDaysCount(period, customFrom, customTo)
  const chartEnd = endAt ?? new Date()

  const fromIso = customFrom ? customFrom.toISOString().slice(0, 10) : null
  const toIso = customTo ? customTo.toISOString().slice(0, 10) : null

  return (
    <>
      <TopBar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-lg">
        <div className="mx-auto max-w-[1200px] space-y-xl pb-xl">
          <div className="flex flex-wrap items-end justify-between gap-md pb-2">
            <div>
              <h2 className="font-h1 text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
                {getGreeting()}, Pedro
              </h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                Marketplaces ativos · <span className="font-medium text-zinc-200">{labels}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-300">Dados em tempo real</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
              {filterOptions.map((opt) => {
                const isActive = filter === opt.value
                const href = buildHref(opt.value, period, fromIso, toIso)
                return (
                  <Link
                    key={opt.value}
                    href={href}
                    scroll={false}
                    className={cn(
                      'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-zinc-50 text-zinc-900 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-50',
                    )}
                  >
                    {opt.label}
                  </Link>
                )
              })}
            </div>

            <PeriodFilter period={period} from={fromIso} to={toIso} />
          </div>

          {sections.map((data, idx) => (
            <Section
              key={`${data.title}-${idx}`}
              data={data}
              periodLabelText={periodLabelText}
              chartDays={chartDays}
              chartEnd={chartEnd}
            />
          ))}
        </div>
      </main>
    </>
  )
}
