'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { MetricsChart, type MetricsChartData, type Period } from '@/components/metrics-chart'
import { cn } from '@/lib/utils'
import type { ShopeeDailyMetric } from '@/types'

type PeriodKey = Period

const periods: { key: PeriodKey; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) =>
  `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const fmtShortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const sum = (arr: ShopeeDailyMetric[], key: keyof ShopeeDailyMetric) =>
  arr.reduce((a, x) => a + (Number(x[key]) || 0), 0)

const avg = (arr: ShopeeDailyMetric[], key: keyof ShopeeDailyMetric) => {
  const valid = arr.filter((x) => x[key] !== null && x[key] !== undefined)
  if (valid.length === 0) return 0
  return valid.reduce((a, x) => a + Number(x[key]), 0) / valid.length
}

type Trend = 'up' | 'down' | 'flat'

function deltaPct(curr: number, prev: number): { delta: string; trend: Trend } {
  if (prev === 0) return { delta: '—', trend: 'flat' }
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return { delta: '0,0%', trend: 'flat' }
  return {
    delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`,
    trend: pct >= 0 ? 'up' : 'down',
  }
}

type MargemTone = 'great' | 'good' | 'warn' | 'bad'
function toneFor(pct: number | null): MargemTone {
  if (pct === null) return 'bad'
  if (pct >= 30) return 'great'
  if (pct >= 20) return 'good'
  if (pct >= 10) return 'warn'
  return 'bad'
}

const margemBadge: Record<MargemTone, string> = {
  great: 'bg-secondary/10 text-secondary border border-secondary/20',
  good: 'bg-primary/10 text-primary-fixed border border-primary/20',
  warn: 'bg-tertiary/10 text-tertiary-fixed border border-tertiary/20',
  bad: 'bg-error/10 text-error border border-error/20',
}

function buildChartData(
  period: PeriodKey,
  current: ShopeeDailyMetric[],
  previous: ShopeeDailyMetric[],
): MetricsChartData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let len: number
  let startCurrent: Date
  if (period === 'mes') {
    len = today.getDate()
    startCurrent = new Date(today.getFullYear(), today.getMonth(), 1)
  } else {
    len = period === '7d' ? 7 : period === '90d' ? 90 : 30
    startCurrent = new Date(today)
    startCurrent.setDate(today.getDate() - len + 1)
  }

  const startPrev = new Date(startCurrent)
  startPrev.setDate(startPrev.getDate() - len)

  const curMap = new Map(current.map((r) => [r.date, r]))
  const prevMap = new Map(previous.map((r) => [r.date, r]))

  const dates: Date[] = []
  const cur = { faturamento: [] as number[], pedidos: [] as number[], lucro: [] as number[] }
  const prev = { faturamento: [] as number[], pedidos: [] as number[], lucro: [] as number[] }

  for (let i = 0; i < len; i++) {
    const d = new Date(startCurrent)
    d.setDate(d.getDate() + i)
    dates.push(d)

    const curKey = d.toISOString().slice(0, 10)
    const cRow = curMap.get(curKey)
    cur.faturamento.push(cRow ? Number(cRow.gross_revenue) || 0 : 0)
    cur.pedidos.push(cRow ? Number(cRow.orders_count) || 0 : 0)
    cur.lucro.push(cRow ? Number(cRow.gross_profit) || 0 : 0)

    const dPrev = new Date(startPrev)
    dPrev.setDate(dPrev.getDate() + i)
    const prevKey = dPrev.toISOString().slice(0, 10)
    const pRow = prevMap.get(prevKey)
    prev.faturamento.push(pRow ? Number(pRow.gross_revenue) || 0 : 0)
    prev.pedidos.push(pRow ? Number(pRow.orders_count) || 0 : 0)
    prev.lucro.push(pRow ? Number(pRow.gross_profit) || 0 : 0)
  }

  return { dates, current: cur, previous: prev }
}

function buildDistribution(rows: ShopeeDailyMetric[]) {
  const buckets = { great: 0, good: 0, warn: 0, low: 0, loss: 0 }
  rows.forEach((r) => {
    const m = r.avg_margin_pct
    if (m === null) return
    if (m > 30) buckets.great++
    else if (m >= 20) buckets.good++
    else if (m >= 10) buckets.warn++
    else if (m >= 0) buckets.low++
    else buckets.loss++
  })
  const total = buckets.great + buckets.good + buckets.warn + buckets.low + buckets.loss
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  return [
    { label: 'Excelente (> 30%)', percent: pct(buckets.great), color: 'bg-primary-fixed', count: buckets.great },
    { label: 'Boa (20% - 30%)',   percent: pct(buckets.good),  color: 'bg-secondary',     count: buckets.good },
    { label: 'Média (10% - 20%)', percent: pct(buckets.warn),  color: 'bg-tertiary',      count: buckets.warn },
    { label: 'Baixa (0% - 10%)',  percent: pct(buckets.low),   color: 'bg-error-container', count: buckets.low },
    { label: 'Prejuízo (< 0%)',   percent: pct(buckets.loss),  color: 'bg-error',         count: buckets.loss },
  ]
}

function EmptyDataState({ nickname }: { nickname: string | null }) {
  return (
    <div className="glass-card flex flex-col items-center gap-md rounded-2xl p-xl text-center">
      <span className="material-symbols-outlined text-3xl text-tertiary">hourglass_empty</span>
      <h3 className="text-h3 font-semibold text-on-surface">Sem métricas no período</h3>
      <p className="max-w-md text-sm text-on-surface-variant">
        {nickname ? `Conta ${nickname} conectada.` : ''} Aguardando próxima execução do workflow{' '}
        <span className="font-mono text-on-surface">Shopee — Métricas Diárias</span> (cron 03h BRT).
      </p>
    </div>
  )
}

export function MetricasView({
  current,
  previous,
  period,
  nickname,
}: {
  current: ShopeeDailyMetric[]
  previous: ShopeeDailyMetric[]
  period: PeriodKey
  nickname: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: PeriodKey) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false })
    })
  }

  const faturamento = sum(current, 'gross_revenue')
  const pedidos = sum(current, 'orders_count')
  const lucroBruto = sum(current, 'gross_profit')
  const ticketMedio = pedidos > 0 ? faturamento / pedidos : 0
  const margemMedia = avg(current, 'avg_margin_pct')
  const cancelados = sum(current, 'orders_cancelled_count')
  const taxaCancel = pedidos > 0 ? (cancelados / pedidos) * 100 : 0

  const prevFat = sum(previous, 'gross_revenue')
  const prevPed = sum(previous, 'orders_count')
  const prevLucro = sum(previous, 'gross_profit')
  const prevTicket = prevPed > 0 ? prevFat / prevPed : 0
  const prevMargem = avg(previous, 'avg_margin_pct')
  const prevCancel = sum(previous, 'orders_cancelled_count')
  const prevTaxaCancel = prevPed > 0 ? (prevCancel / prevPed) * 100 : 0

  const kpis = [
    { label: 'Faturamento Bruto', value: fmtBrlInt(faturamento), ...deltaPct(faturamento, prevFat),     icon: 'payments',                iconClass: 'text-tertiary',             valueClass: 'text-on-surface' },
    { label: 'Pedidos',           value: fmtNum(pedidos),         ...deltaPct(pedidos, prevPed),         icon: 'shopping_cart',           iconClass: 'text-primary',              valueClass: 'text-on-surface' },
    { label: 'Lucro Bruto',       value: fmtBrlInt(lucroBruto),   ...deltaPct(lucroBruto, prevLucro),    icon: 'account_balance_wallet',  iconClass: 'text-secondary',            valueClass: 'text-secondary-fixed' },
    { label: 'Ticket Médio',      value: `R$ ${fmtBrl(ticketMedio)}`, ...deltaPct(ticketMedio, prevTicket), icon: 'receipt_long',          iconClass: 'text-primary-fixed-dim',    valueClass: 'text-on-surface' },
    { label: 'Margem Média',      value: fmtPct(margemMedia),     ...deltaPct(margemMedia, prevMargem),  icon: 'pie_chart',               iconClass: 'text-secondary-container',  valueClass: 'text-on-surface' },
    { label: 'Cancelamentos',     value: fmtPct(taxaCancel),      ...deltaPct(taxaCancel, prevTaxaCancel), icon: 'remove_shopping_cart',  iconClass: 'text-error',                valueClass: 'text-on-surface' },
  ]

  const dailyRows = [...current].reverse().slice(0, 5)
  const distribution = buildDistribution(current)
  const chartData = useMemo(() => buildChartData(period, current, previous), [period, current, previous])

  return (
    <>
      <TopBar showSearch />
      <div className={cn('p-margin flex flex-col gap-gutter flex-1 overflow-y-auto', pending && 'opacity-70 pointer-events-none transition-opacity')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface flex items-center gap-sm">
              Métricas
              <span className="text-outline font-normal">—</span>
              <span className="text-tertiary">Shopee</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {nickname ? `Conta ${nickname}` : 'Conta Shopee ativa'} · performance e rentabilidade.
            </p>
          </div>

          <div className="flex items-center bg-surface-container-high/50 backdrop-blur-md rounded-lg p-1 border border-white/10">
            {periods.map((p) => {
              const active = period === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors border',
                    active
                      ? 'bg-tertiary-container text-on-tertiary-container shadow-sm border-tertiary/20'
                      : 'text-on-surface-variant hover:text-on-surface border-transparent',
                  )}
                  aria-pressed={active}
                >
                  {p.label}
                </button>
              )
            })}
            <button
              type="button"
              className="px-2 py-1.5 rounded-md text-on-surface-variant hover:text-on-surface flex items-center justify-center border-l border-white/10 ml-1 pl-3"
              aria-label="Selecionar intervalo"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </button>
          </div>
        </div>

        {current.length === 0 ? (
          <EmptyDataState nickname={nickname} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-2 relative overflow-hidden group hover:bg-surface-container/90 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                      {kpi.label}
                    </span>
                    <span className={cn('material-symbols-outlined text-lg', kpi.iconClass)}>
                      {kpi.icon}
                    </span>
                  </div>
                  <div className={cn('font-h2 text-h2', kpi.valueClass)}>{kpi.value}</div>
                  <div
                    className={cn(
                      'flex items-center gap-1 font-label-md text-label-md',
                      kpi.trend === 'flat' ? 'text-outline' : kpi.trend === 'up' ? 'text-secondary' : 'text-error',
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {kpi.trend === 'up' ? 'trending_up' : kpi.trend === 'down' ? 'trending_down' : 'trending_flat'}
                    </span>
                    <span>{kpi.delta}</span>
                    <span className="text-outline ml-1 text-[10px]">vs ant.</span>
                  </div>
                </div>
              ))}
            </div>

            <MetricsChart period={period} data={chartData} />

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-gutter">
              <div className="lg:col-span-6 bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 flex flex-col overflow-hidden">
                <div className="p-lg border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-h3 text-h3 text-on-surface">Dados Diários</h3>
                  <button className="font-label-md text-label-md text-tertiary flex items-center gap-1 hover:text-tertiary-fixed transition-colors">
                    Exportar CSV
                    <span className="material-symbols-outlined text-[16px]">download</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
                    <thead className="bg-surface-container-high/30">
                      <tr>
                        <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px]">Data</th>
                        <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                        <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Canc.</th>
                        <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Fat. (R$)</th>
                        <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Comissão (R$)</th>
                        <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Frete (R$)</th>
                        <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Lucro (R$)</th>
                        <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {dailyRows.map((r) => {
                        const tone = toneFor(r.avg_margin_pct)
                        const cancelTone = r.orders_cancelled_count > 0 ? 'text-error' : 'text-on-surface-variant'
                        const lucroTone = r.gross_profit > 0 ? 'text-secondary' : 'text-on-surface-variant'
                        return (
                          <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-lg py-3 text-on-surface">{fmtShortDate(r.date)}</td>
                            <td className="px-md py-3 text-on-surface-variant text-right">{r.orders_count}</td>
                            <td className={cn('px-md py-3 text-right', cancelTone)}>{r.orders_cancelled_count}</td>
                            <td className="px-md py-3 text-on-surface text-right font-mono-sm">{fmtBrl(r.gross_revenue)}</td>
                            <td className="px-md py-3 text-on-surface-variant text-right font-mono-sm">{fmtBrl(r.total_commission)}</td>
                            <td className="px-md py-3 text-on-surface-variant text-right font-mono-sm">{fmtBrl(r.total_shipping_cost)}</td>
                            <td className={cn('px-md py-3 text-right font-mono-sm', lucroTone)}>{fmtBrl(r.gross_profit)}</td>
                            <td className="px-lg py-3 text-right">
                              <span
                                className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
                                  margemBadge[tone],
                                )}
                              >
                                {r.avg_margin_pct !== null ? fmtPct(r.avg_margin_pct) : '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-white/10 text-center">
                  <button className="font-label-md text-label-md text-outline hover:text-on-surface transition-colors">
                    Ver histórico completo
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-h3 text-h3 text-on-surface">Distribuição de Margem</h3>
                  <span className="material-symbols-outlined text-outline-variant">info</span>
                </div>
                <div className="flex flex-col gap-5 flex-1 justify-center">
                  {distribution.map((m) => (
                    <div key={m.label} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between font-label-md text-label-md">
                        <span className="text-on-surface flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', m.color)} /> {m.label}
                        </span>
                        <span className="text-on-surface-variant">
                          {m.count} {m.count === 1 ? 'dia' : 'dias'} · {m.percent}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', m.color)} style={{ width: `${m.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
