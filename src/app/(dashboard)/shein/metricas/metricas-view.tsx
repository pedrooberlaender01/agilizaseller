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
    blue: 'text-primary',
  }[tone]
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <Icon name={icon} size={18} className="text-outline" />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', toneCls)}>{value}</p>
    </div>
  )
}

export function MetricasView({
  rows,
  period,
  nickname,
}: {
  rows: DailyMetric[]
  period: Period
  nickname?: string | null
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
          <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
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

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatCard label="Itens Vendidos" value={fmtInt(totals.items)} icon="inventory_2" />
          <StatCard label="Receita Líquida" value={fmtBrl(totals.net)} icon="account_balance_wallet" tone="green" />
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Diário — {period === '7d' ? '7 dias' : period === '90d' ? '90 dias' : '30 dias'}</h3>
            <p className="mt-1 text-xs text-slate-400">Agregado diariamente pelo workflow Shein - Métricas Diárias (06h BRT).</p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
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
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-outline">
                    Sem métricas no período. Aguarde próxima execução do cron diário (06h BRT).
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.metric_date} className="border-b border-white/5 hover:bg-white/5">
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
