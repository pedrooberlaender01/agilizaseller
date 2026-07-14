'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { RevenueChart } from '@/components/revenue-chart'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'custom'

export type StatusCount = { status: string; count: number }
export type DailyPoint = { dia: string; pedidos: number; faturamento: number }

const fmtBrl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (n: number) => n.toLocaleString('pt-BR')

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'
const toneClasses: Record<Tone, string> = {
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  blue:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red:    'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:   'bg-outline/20 text-zinc-500 border border-outline/30',
}
function statusTone(s: string): Tone {
  const v = s.toUpperCase()
  if (v.includes('CANCEL') || v.includes('REFUND')) return 'red'
  if (v === 'DELIVERED' || v === 'COMPLETED') return 'green'
  if (v.includes('SHIP') || v.includes('TRANSIT') || v.includes('COLLECTION')) return 'blue'
  if (v === 'UNPAID' || v === 'ON_HOLD' || v.includes('AWAITING')) return 'yellow'
  return 'gray'
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: 'white' | 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-secondary' : tone === 'red' ? 'text-error' : 'text-white'
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold', color)}>{value}</p>
    </div>
  )
}

export function MetricasView({
  period,
  customFrom,
  customTo,
  kpi,
  byStatus,
  series,
}: {
  period: Period
  customFrom: string | null
  customTo: string | null
  kpi: { orders: number; gross: number; ticket: number; cancelled: number; delivered: number; repasse: number; taxas: number }
  byStatus: StatusCount[]
  series: DailyPoint[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: Period) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', p)
    if (p !== 'custom') { next.delete('from'); next.delete('to') }
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }

  const chartData = series.map((d) => {
    const dt = new Date(d.dia + 'T00:00:00')
    return {
      day: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`,
      faturamento: d.faturamento,
      lucro: 0,
    }
  })
  const totalStatus = byStatus.reduce((a, b) => a + b.count, 0) || 1

  return (
    <>
      <TopBar title="Métricas — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex items-center justify-end">
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn('rounded px-3 py-1 text-xs font-medium transition-colors', period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Pedidos" value={fmtInt(kpi.orders)} />
          <KpiCard label="Faturamento (GMV)" value={fmtBrl(kpi.gross)} />
          <KpiCard label="Ticket médio" value={fmtBrl(kpi.ticket)} />
          <KpiCard label="Repasse (líquido)" value={fmtBrl(kpi.repasse)} tone="green" />
          <KpiCard label="Entregues" value={fmtInt(kpi.delivered)} tone="green" />
          <KpiCard label="Cancelados" value={fmtInt(kpi.cancelled)} tone="red" />
          <KpiCard label="Taxas TikTok" value={fmtBrl(kpi.taxas)} tone="red" />
          <KpiCard label="Taxa cancelamento" value={`${((kpi.cancelled / (kpi.orders || 1)) * 100).toFixed(1)}%`} />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row">
          <RevenueChart
            data={chartData}
            showLucro={false}
            title="Faturamento por dia"
            subtitle="TikTok Shop · BRL"
          />
          <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Pedidos por status</h3>
              <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">Nomes da API TikTok</p>
            </div>
            <div className="flex flex-col gap-3 p-lg">
              {byStatus.length === 0 ? (
                <p className="text-sm text-zinc-500">Sem dados no período.</p>
              ) : (
                byStatus.map((s) => (
                  <div key={s.status} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(s.status)])}>
                        {s.status}
                      </span>
                      <span className="font-mono text-xs text-slate-300">{fmtInt(s.count)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${(s.count / totalStatus) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
