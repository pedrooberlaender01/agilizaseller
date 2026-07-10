'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { MetricsChart, type Period, type MetricsChartData } from '@/components/metrics-chart'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

export type DailyRow = {
  date: string // ISO yyyy-mm-dd
  pedidos: number
  cancel: number
  fat: number
}

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function MetricasView({
  rows,
  devolQtd,
  devolValor,
  period,
  customFrom,
  customTo,
}: {
  rows: DailyRow[]
  devolQtd: number
  devolValor: number
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const isCustom = !!(customFrom && customTo)

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  function setPeriod(p: Period) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    sp.delete('from')
    sp.delete('to')
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(fromIso: string, toIso: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('period')
    sp.set('from', fromIso)
    sp.set('to', toIso)
    setPopoverOpen(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  // KPIs brutos (por data de criação, inclui canceladas) — bate com ML "Vendas brutas".
  const faturamento = rows.reduce((a, r) => a + r.fat, 0)
  const pedidos = rows.reduce((a, r) => a + r.pedidos, 0)
  const cancel = rows.reduce((a, r) => a + r.cancel, 0)
  const ticket = pedidos > 0 ? faturamento / pedidos : 0
  const cancelPct = pedidos > 0 ? (cancel / pedidos) * 100 : 0

  const kpis = [
    { label: 'Faturamento Bruto', value: `R$ ${fmtBrl(faturamento)}`, icon: 'payments', iconClass: 'text-primary', valueClass: 'text-on-surface', inDev: false },
    { label: 'Pedidos', value: pedidos.toLocaleString('pt-BR'), icon: 'local_shipping', iconClass: 'text-tertiary', valueClass: 'text-on-surface', inDev: false },
    { label: 'Lucro Líquido', value: '', icon: 'construction', iconClass: 'text-amber-400', valueClass: 'text-amber-300', inDev: true },
    { label: 'Ticket Médio', value: `R$ ${fmtBrl(ticket)}`, icon: 'receipt_long', iconClass: 'text-primary-fixed-dim', valueClass: 'text-on-surface', inDev: false },
    { label: 'Margem Média', value: '', icon: 'construction', iconClass: 'text-amber-400', valueClass: 'text-amber-300', inDev: true },
    { label: 'Cancelamentos', value: `${cancelPct.toFixed(1).replace('.', ',')}%`, icon: 'remove_shopping_cart', iconClass: 'text-error', valueClass: 'text-on-surface', inDev: false },
    { label: 'Devoluções', value: devolQtd.toLocaleString('pt-BR'), icon: 'assignment_return', iconClass: 'text-error', valueClass: 'text-on-surface', inDev: false },
    { label: 'Valor Devolvido', value: `R$ ${fmtBrl(devolValor)}`, icon: 'currency_exchange', iconClass: 'text-error', valueClass: 'text-error', inDev: false },
  ]

  const chartData: MetricsChartData = useMemo(() => {
    const asc = [...rows].sort((a, b) => a.date.localeCompare(b.date))
    return {
      dates: asc.map((r) => new Date(`${r.date}T00:00:00`)),
      current: {
        faturamento: asc.map((r) => Math.round(r.fat)),
        pedidos: asc.map((r) => r.pedidos),
        lucro: asc.map(() => 0),
      },
      previous: {
        faturamento: asc.map(() => 0),
        pedidos: asc.map(() => 0),
        lucro: asc.map(() => 0),
      },
    }
  }, [rows])

  const tableRows = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 31), [rows])

  return (
    <>
      <TopBar showSearch />
      <div className={cn('p-margin flex flex-col gap-gutter flex-1 overflow-y-auto', pending && 'opacity-70 pointer-events-none transition-opacity')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface flex items-center gap-sm">
              Métricas
              <span className="text-outline font-normal">—</span>
              <span className="text-primary-fixed">Mercado Livre</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Overview de performance da conta. Lucro e margem indisponíveis (custos pendentes).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-container-high/50 backdrop-blur-md rounded-lg p-1 border border-white/10">
              {periods.map((p) => {
                const active = !isCustom && period === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors ${
                      active
                        ? 'bg-primary-container text-on-primary-container shadow-sm border border-primary/20'
                        : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                    }`}
                    aria-pressed={active}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                  isCustom
                    ? 'border-primary/30 bg-primary-container text-on-primary-container'
                    : 'border-white/10 bg-surface-container-high/50 text-on-surface-variant hover:text-on-surface',
                )}
                aria-label="Selecionar intervalo"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>
                  {isCustom && customFrom && customTo
                    ? `${fmtDateBRShort(customFrom)} – ${fmtDateBRShort(customTo)}`
                    : 'Personalizar'}
                </span>
                <span className={cn('material-symbols-outlined text-[14px] transition-transform', popoverOpen && 'rotate-180')}>expand_more</span>
              </button>
              {popoverOpen && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={applyCustomRange}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className={`backdrop-blur-[16px] rounded-xl p-lg border flex flex-col gap-2 relative overflow-hidden group transition-colors ${
                kpi.inDev
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : 'border-white/10 bg-surface-container/70 hover:bg-surface-container/90'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                  {kpi.label}
                </span>
                <span className={`material-symbols-outlined ${kpi.iconClass} text-lg`}>{kpi.icon}</span>
              </div>
              {kpi.inDev ? (
                <>
                  <div className="text-base font-semibold text-amber-300">Em desenvolvimento</div>
                  <p className="text-[10px] leading-snug text-zinc-400">
                    Precisamos cadastrar o custo dos produtos pra calcular.
                  </p>
                </>
              ) : (
                <div className={`font-h2 text-h2 ${kpi.valueClass}`}>{kpi.value}</div>
              )}
            </div>
          ))}
        </div>

        <MetricsChart period={period} data={chartData} />

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-gutter">
          <div className="lg:col-span-6 bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 flex flex-col overflow-hidden">
            <div className="p-lg border-b border-white/10 flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-surface">Dados Diários</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
                <thead className="bg-surface-container-high/30">
                  <tr>
                    <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px]">Data</th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Canc.</th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Fat. (R$)</th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Lucro (R$)</th>
                    <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Margem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-lg py-12 text-center text-on-surface-variant">
                        Nenhum pedido no período.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((r) => (
                      <tr key={r.date} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-lg py-3 text-on-surface">{shortDate(r.date)}</td>
                        <td className="px-md py-3 text-on-surface-variant text-right">{r.pedidos}</td>
                        <td className={`px-md py-3 text-right ${r.cancel > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {r.cancel}
                        </td>
                        <td className="px-md py-3 text-on-surface text-right font-mono-sm">{fmtBrl(r.fat)}</td>
                        <td className="px-md py-3 text-right font-mono-sm text-on-surface-variant">—</td>
                        <td className="px-lg py-3 text-right text-on-surface-variant">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-4 bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-surface">Distribuição de Margem</h3>
              <span className="material-symbols-outlined text-outline-variant">info</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="material-symbols-outlined text-4xl text-outline-variant">pending</span>
              <p className="text-sm text-on-surface-variant">
                Distribuição de margem indisponível.
              </p>
              <p className="text-xs text-outline">
                Cadastre os custos dos produtos para liberar o cálculo de lucro e margem.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
