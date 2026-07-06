'use client'

import { useMemo, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d'

export type DailyMetric = {
  connection_id: string
  metric_date: string
  orders_count: number
  gross_revenue: number | string
  net_revenue: number | string
  items_sold: number
  cancellations: number
}

const fmtBrl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function StatCard({ label, value, icon, tone = 'default' }: { label: string; value: string; icon: string; tone?: 'default' | 'green' | 'red' | 'blue' }) {
  const toneCls = {
    default: 'text-white',
    green: 'text-secondary',
    red: 'text-error',
    blue: 'text-blue-400',
  }[tone]
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', toneCls)}>{value}</p>
    </div>
  )
}

export type CostAgg = {
  estimated: number
  totalGross: number
  totalCommission: number
  totalServiceCharge: number
  coveredGross: number
  coveredEstimated: number
  coveredCost: number
  coveredProfit: number
  coveredUnits: number
  uncoveredUnits: number
}

export function MetricasView({
  rows,
  period,
  nickname,
  costAgg,
}: {
  rows: DailyMetric[]
  period: Period
  nickname?: string | null
  costAgg?: CostAgg
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: Period) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', p)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.orders += r.orders_count
        acc.cancellations += r.cancellations
        acc.gross += Number(r.gross_revenue)
        acc.net += Number(r.net_revenue)
        acc.items += r.items_sold
        return acc
      },
      { orders: 0, cancellations: 0, gross: 0, net: 0, items: 0 },
    )
  }, [rows])

  const ticketMedio = totals.orders > 0 ? totals.gross / totals.orders : 0
  const cancelRate = totals.orders > 0 ? (totals.cancellations / totals.orders) * 100 : 0

  return (
    <>
      <TopBar title="Métricas — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Visão geral</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Receita Bruta" value={fmtBrl(totals.gross)} icon="payments" tone="green" />
          <StatCard label="Pedidos" value={fmtInt(totals.orders)} icon="shopping_cart" tone="blue" />
          <StatCard label="Ticket Médio" value={fmtBrl(ticketMedio)} icon="trending_up" />
          <StatCard label="Cancelados" value={`${fmtInt(totals.cancellations)} (${cancelRate.toFixed(1)}%)`} icon="cancel" tone="red" />
        </div>

        {costAgg && (
          <>
            <div className="mb-lg">
              {(() => {
                const taxaTotal = costAgg.totalCommission + costAgg.totalServiceCharge
                const taxaPct = costAgg.totalGross > 0 ? (taxaTotal / costAgg.totalGross) * 100 : 0
                const repassePct = costAgg.totalGross > 0 ? (costAgg.estimated / costAgg.totalGross) * 100 : 0
                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Faturamento Bruto</span>
                        <Icon name="payments" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-white">{fmtBrl(costAgg.totalGross)}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">Receita gross dos itens vendidos</p>
                    </div>
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Taxa Shein Total</span>
                        <Icon name="receipt_long" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-rose-300">-{fmtBrl(taxaTotal)}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Comissão {fmtBrl(costAgg.totalCommission)} + Service {fmtBrl(costAgg.totalServiceCharge)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Repasse (líquido)</span>
                        <Icon name="account_balance_wallet" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-emerald-300">{fmtBrl(costAgg.estimated)}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">Que vai cair na conta Santander</p>
                    </div>
                    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">% Taxa / Repasse</span>
                        <Icon name="percent" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-white">
                        <span className="text-rose-300">{taxaPct.toFixed(1)}%</span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-emerald-300">{repassePct.toFixed(1)}%</span>
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-500">Taxa absorvida vs repasse efetivo</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="mb-lg">
              {(() => {
                const coveragePct = costAgg.totalGross > 0 ? (costAgg.coveredGross / costAgg.totalGross) * 100 : 0
                const realMarginPct = costAgg.coveredGross > 0 ? (costAgg.coveredProfit / costAgg.coveredGross) * 100 : 0
                const profitTone = costAgg.coveredProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                const marginTone = realMarginPct >= 30 ? 'text-emerald-300' : realMarginPct >= 10 ? 'text-amber-300' : 'text-rose-300'
                const covTone = coveragePct >= 80 ? 'text-emerald-300' : coveragePct >= 40 ? 'text-amber-300' : 'text-rose-300'
              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Lucro Real</span>
                      <Icon name="construction" size={18} className="text-amber-400" />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-amber-300">Em desenvolvimento</p>
                    <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                      Precisamos cadastrar o custo dos produtos pra determinar o lucro líquido.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Margem Real</span>
                      <Icon name="construction" size={18} className="text-amber-400" />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-amber-300">Em desenvolvimento</p>
                    <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                      Margem depende do custo dos produtos cadastrado.
                    </p>
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Custo Total</span>
                      <Icon name="paid" size={18} className="text-zinc-500" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-rose-300">{fmtBrl(costAgg.coveredCost)}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{fmtInt(costAgg.coveredUnits)} unidades c/ custo</p>
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Cobertura Custo</span>
                      <Icon name="data_check" size={18} className="text-zinc-500" />
                    </div>
                    <p className={cn('mt-2 text-3xl font-semibold', covTone)}>
                      {coveragePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {fmtInt(costAgg.uncoveredUnits)} unid. sem custo
                    </p>
                  </div>
                </div>
              )
            })()}
            </div>
          </>
        )}

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatCard label="Itens Vendidos" value={fmtInt(totals.items)} icon="inventory_2" />
          <StatCard label="Receita Líquida" value={fmtBrl(totals.net)} icon="account_balance_wallet" tone="green" />
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Diário — {period === '7d' ? '7 dias' : period === '90d' ? '90 dias' : '30 dias'}</h3>
            <p className="mt-1 text-xs text-slate-400">Agregado diariamente pelo workflow Shein - Métricas Diárias (06h BRT).</p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Pedidos</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Cancelados</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Itens</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Bruto</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Sem métricas no período. Aguarde próxima execução do cron diário (06h BRT).
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.metric_date} className="border-b border-zinc-800/60 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{fmtDateBR(r.metric_date)}</td>
                    <td className="px-6 py-4 text-right">{fmtInt(r.orders_count)}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtInt(r.cancellations)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{fmtInt(r.items_sold)}</td>
                    <td className="px-6 py-4 text-right font-medium">{fmtBrl(r.gross_revenue)}</td>
                    <td className="px-6 py-4 text-right text-secondary">{fmtBrl(r.net_revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
