'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { MetricsChart, type MetricsChartData } from '@/components/metrics-chart'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import { KpiCard, fmtBrl, fmtNum, fmtPct } from '../_ui'

type Period = '7d' | '30d' | '90d' | 'mes' | 'custom'
export type StatusCount = { status: string; count: number }
export type DailyRow = { dia: string; pedidos: number; faturamento: number; cancelados: number }

const fmtDia = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MetricasView({
  period,
  customFrom,
  customTo,
  kpi,
  daily,
  cancelBreakdown,
  affiliate,
  adsSpend,
}: {
  period: Period
  customFrom: string | null
  customTo: string | null
  kpi: { orders: number; gross: number; ticket: number; cancelled: number; delivered: number; repasse: number; taxas: number }
  byStatus: StatusCount[]
  daily: DailyRow[]
  cancelBreakdown: { total: number; naoPago: number; comprador: number; loja: number; outros: number }
  affiliate: { commission: number; shipping: number; coverage: number }
  adsSpend: number
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

  function pushParams(updater: (n: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }
  function setPeriod(p: Period) {
    pushParams((n) => { n.set('period', p); if (p !== 'custom') { n.delete('from'); n.delete('to') } })
  }
  function applyCustomRange(f: string, t: string) {
    pushParams((n) => { n.set('period', 'custom'); n.set('from', f); n.set('to', t) })
    setShowDatePicker(false)
  }

  const totalOrders = kpi.orders + kpi.cancelled
  const cancelPct = totalOrders > 0 ? (kpi.cancelled / totalOrders) * 100 : 0

  const chartData: MetricsChartData = useMemo(() => ({
    dates: daily.map((d) => new Date(d.dia + 'T00:00:00')),
    current: {
      faturamento: daily.map((d) => d.faturamento),
      pedidos: daily.map((d) => d.pedidos),
      lucro: daily.map(() => 0),
    },
    previous: { faturamento: [], pedidos: [], lucro: [] },
  }), [daily])
  const chartPeriod = (period === 'custom' ? '30d' : period) as '7d' | '30d' | '90d' | 'mes'

  const recent = [...daily].slice(-5).reverse()

  return (
    <>
      <TopBar title="Métricas — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        {/* Filtros */}
        <div className="mb-lg flex items-center justify-end gap-3">
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {(['7d', '30d', '90d', 'mes'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn('rounded px-3 py-1 text-xs font-medium transition-colors', period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}
              >
                {p === 'mes' ? 'Este Mês' : p}
              </button>
            ))}
          </div>
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#050507] px-3 py-1.5 text-xs font-medium transition-colors', period === 'custom' ? 'border-zinc-50/40 text-white' : 'text-slate-400 hover:text-white')}
            >
              <span className="material-symbols-outlined text-[14px]">event</span>
              {period === 'custom' && customFrom && customTo ? `${fmtDateBRShort(customFrom)} → ${fmtDateBRShort(customTo)}` : 'Personalizar'}
            </button>
            {showDatePicker && (
              <DateRangePopover from={customFrom} to={customTo} onApply={applyCustomRange} onClose={() => setShowDatePicker(false)} align="right" />
            )}
          </div>
        </div>

        {/* KPIs principais */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Faturamento" value={fmtBrl(kpi.gross)} icon="payments" tone="green" />
          <KpiCard label="Pedidos" value={fmtNum(kpi.orders)} icon="shopping_cart" />
          <KpiCard label="Ticket Médio" value={fmtBrl(kpi.ticket)} icon="receipt_long" />
          {/* Cancelamentos (total) com destaque de culpa da loja */}
          <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg transition-colors hover:bg-zinc-900/70">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Cancelamentos (total)</span>
              <span className="material-symbols-outlined text-lg text-error">remove_shopping_cart</span>
            </div>
            <div className="text-2xl font-semibold text-error">{fmtPct(cancelPct)}</div>
            <div className="font-mono text-[10px] text-zinc-500">{fmtNum(kpi.cancelled)} de {fmtNum(totalOrders)}</div>
            <div className="mt-auto flex items-center gap-1.5 border-t border-zinc-800 pt-2 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-slate-400">Culpa da loja:</span>
              <span className="font-mono font-medium text-white">{fmtNum(cancelBreakdown.loja)}</span>
              <span className="text-zinc-500">
                ({fmtPct(cancelBreakdown.total > 0 ? (cancelBreakdown.loja / cancelBreakdown.total) * 100 : 0, 0)})
              </span>
            </div>
          </div>
        </div>

        {/* Despesas */}
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Despesas</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="Gasto em Ads" value={fmtBrl(adsSpend)} icon="campaign" tone="red" sub="GMV Max (TikTok Ads)" />
          <KpiCard label="Comissão Afiliados" value={fmtBrl(affiliate.commission)} icon="handshake" tone="red" sub={affiliate.coverage > 0 ? `${fmtNum(affiliate.coverage)} pedidos com fee sync` : 'sync em andamento'} />
          <KpiCard label="Frete Vendedor" value={fmtBrl(affiliate.shipping)} icon="local_shipping" tone="red" sub="frete pago pela loja" />
          <KpiCard label="Taxas TikTok" value={fmtBrl(kpi.taxas)} icon="percent" tone="red" sub="comissão + taxas do período" />
          <KpiCard label="Repasse Liberado" value={fmtBrl(kpi.repasse)} icon="account_balance" tone="green" sub="settlements liberados" />
        </div>

        {/* Gráfico */}
        <div className="mb-lg">
          <MetricsChart period={chartPeriod} data={chartData} />
        </div>

        {/* Dados diários + distribuição */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          <div className="lg:col-span-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Dados Diários</h3>
              <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">Últimos 5 dias</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 text-right font-medium">Pedidos</th>
                    <th className="px-4 py-3 text-right font-medium">Canc.</th>
                    <th className="px-4 py-3 text-right font-medium">Fat. (R$)</th>
                    <th className="px-4 py-3 text-right font-medium">Comissão</th>
                    <th className="px-4 py-3 text-right font-medium">Frete</th>
                    <th className="px-4 py-3 text-right font-medium">Ads</th>
                    <th className="px-4 py-3 text-right font-medium">Lucro</th>
                    <th className="px-4 py-3 text-right font-medium">Margem</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {recent.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-500">Sem dados no período.</td></tr>
                  ) : (
                    recent.map((d) => (
                      <tr key={d.dia} className="border-b border-zinc-800/60">
                        <td className="px-4 py-3 font-mono text-xs">{fmtDia(d.dia)}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(d.pedidos)}</td>
                        <td className="px-4 py-3 text-right text-error">{d.cancelados || '—'}</td>
                        <td className="px-4 py-3 text-right">{fmtBrl(d.faturamento)}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">—</td>
                        <td className="px-4 py-3 text-right text-zinc-600">—</td>
                        <td className="px-4 py-3 text-right text-zinc-600">—</td>
                        <td className="px-4 py-3 text-right text-zinc-600">—</td>
                        <td className="px-4 py-3 text-right text-zinc-600">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Distribuição de Margem</h3>
              <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">Precisa de custos (COGS)</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-lg">
              {['Excelente (>30%)', 'Boa (20-30%)', 'Média (10-20%)', 'Baixa (0-10%)', 'Prejuízo (<0%)'].map((l) => (
                <div key={l} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{l}</span>
                    <span className="text-zinc-600">—</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full w-0 rounded-full bg-blue-500/60" /></div>
                </div>
              ))}
              <p className="mt-2 text-[11px] text-zinc-600">Cadastre custos dos produtos pra calcular margem.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
