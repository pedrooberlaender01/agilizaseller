'use client'

import { useMemo, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d'

export type DailyMetric = {
  connection_id: string
  date: string
  origem: number | null
  orders_count: number
  orders_cancelled_count: number
  orders_aprovados_count: number
  gross_revenue: number | string
  total_frete: number | string
  total_desconto: number | string
  ticket_medio: number | string
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

// Origens de pedido Magazord (ver doc: magazord_api_completo.md)
// 1=Site, 2=Marketplace Próprio, 3=Marketplace (ML/Shopee/Netshoes), 4=Manual, 5=PDV
const origemLabel: Record<number, string> = {
  1: 'Site',
  2: 'Marketplace Próprio',
  3: 'Marketplace',
  4: 'Manual',
  5: 'PDV',
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
        acc.cancelled += r.orders_cancelled_count
        acc.aprovados += r.orders_aprovados_count
        acc.revenue += Number(r.gross_revenue)
        acc.frete += Number(r.total_frete)
        acc.desconto += Number(r.total_desconto)
        return acc
      },
      { orders: 0, cancelled: 0, aprovados: 0, revenue: 0, frete: 0, desconto: 0 },
    )
  }, [rows])

  const ticketMedio = totals.orders > 0 ? totals.revenue / totals.orders : 0
  const cancelRate = totals.orders + totals.cancelled > 0
    ? (totals.cancelled / (totals.orders + totals.cancelled)) * 100
    : 0

  return (
    <>
      <TopBar title="Métricas — Magazord" />
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
          <StatCard label="Receita Bruta" value={fmtBrl(totals.revenue)} icon="payments" tone="green" />
          <StatCard label="Pedidos Válidos" value={fmtInt(totals.orders)} icon="shopping_cart" tone="blue" />
          <StatCard label="Ticket Médio" value={fmtBrl(ticketMedio)} icon="trending_up" />
          <StatCard label="Cancelados" value={`${fmtInt(totals.cancelled)} (${cancelRate.toFixed(1)}%)`} icon="cancel" tone="red" />
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="Aprovados" value={fmtInt(totals.aprovados)} icon="check_circle" tone="green" />
          <StatCard label="Total Frete" value={fmtBrl(totals.frete)} icon="local_shipping" />
          <StatCard label="Total Desconto" value={fmtBrl(totals.desconto)} icon="local_offer" />
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Diário — {period === '7d' ? '7 dias' : period === '90d' ? '90 dias' : '30 dias'}</h3>
            <p className="mt-1 text-xs text-slate-400">Agregado por dia e origem do pedido (Manual, Integração, WebService, etc).</p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Origem</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Pedidos</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Aprovados</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Cancelados</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receita</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-outline">
                    Sem métricas no período. Aguarde próxima execução do cron diário (03h BRT).
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.date}-${r.origem}`} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{fmtDateBR(r.date)}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{origemLabel[r.origem ?? 0] ?? `#${r.origem}`}</td>
                    <td className="px-6 py-4 text-right">{fmtInt(r.orders_count)}</td>
                    <td className="px-6 py-4 text-right text-secondary">{fmtInt(r.orders_aprovados_count)}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtInt(r.orders_cancelled_count)}</td>
                    <td className="px-6 py-4 text-right font-medium">{fmtBrl(r.gross_revenue)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{fmtBrl(r.ticket_medio)}</td>
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
