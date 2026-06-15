'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import type { ShopeeWalletTransaction, ShopeePayout, ShopeeDailyMetric } from '@/types'
import type { Period } from '@/components/metrics-chart'

export type FinanceiroPeriod = Period | 'custom'

const periods: { key: FinanceiroPeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => n.toLocaleString('pt-BR')

const typeLabel: Record<string, string> = {
  ESCROW_VERIFIED_ADD: 'Repasse de Venda',
  ESCROW_VERIFIED_MINUS: 'Estorno Repasse',
  WITHDRAWAL_CREATED: 'Saque Solicitado',
  WITHDRAWAL_COMPLETED: 'Saque Concluído',
  SPM_DEDUCT: 'Marketing Shopee (SPM)',
  SPM_DEDUCT_DIRECT: 'Marketing Shopee Direto',
  ADJUSTMENT_CENTER_DEDUCT: 'Ajuste — Débito',
  ADJUSTMENT_CENTER_ADD: 'Ajuste — Crédito',
  ADJUSTMENT_FOR_RR_AFTER_ESCROW_VERIFIED: 'Ajuste Pós-Repasse',
  FAST_ESCROW_DEDUCT: 'Repasse Rápido — Taxa',
  RETURN_COMPENSATION_SERVICE_ADD: 'Compensação Devolução',
}

const typeIcon: Record<string, string> = {
  ESCROW_VERIFIED_ADD: 'shopping_bag',
  ESCROW_VERIFIED_MINUS: 'undo',
  WITHDRAWAL_CREATED: 'arrow_circle_down',
  WITHDRAWAL_COMPLETED: 'check_circle',
  SPM_DEDUCT: 'campaign',
  SPM_DEDUCT_DIRECT: 'campaign',
  ADJUSTMENT_CENTER_DEDUCT: 'remove_circle',
  ADJUSTMENT_CENTER_ADD: 'add_circle',
  ADJUSTMENT_FOR_RR_AFTER_ESCROW_VERIFIED: 'tune',
  FAST_ESCROW_DEDUCT: 'bolt',
  RETURN_COMPENSATION_SERVICE_ADD: 'redeem',
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const fmtShortDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type TypeAgg = {
  type: string
  qty: number
  total_cents: number
  is_in: boolean
}

function aggregateByType(txs: ShopeeWalletTransaction[]): TypeAgg[] {
  const map = new Map<string, TypeAgg>()
  for (const t of txs) {
    const key = t.transaction_type || 'unknown'
    if (!map.has(key)) {
      map.set(key, { type: key, qty: 0, total_cents: 0, is_in: false })
    }
    const agg = map.get(key)!
    agg.qty++
    agg.total_cents += Number(t.amount_cents) || 0
  }
  for (const a of map.values()) {
    a.is_in = a.total_cents >= 0
  }
  return Array.from(map.values()).sort((a, b) => Math.abs(b.total_cents) - Math.abs(a.total_cents))
}

function buildDailyFlow(txs: ShopeeWalletTransaction[]) {
  const byDate = new Map<string, { in_cents: number; out_cents: number }>()
  for (const t of txs) {
    const date = t.create_time.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, { in_cents: 0, out_cents: 0 })
    const e = byDate.get(date)!
    const amt = Number(t.amount_cents) || 0
    if (amt >= 0) e.in_cents += amt
    else e.out_cents += amt
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, in_value: v.in_cents / 100, out_value: Math.abs(v.out_cents / 100), net: (v.in_cents + v.out_cents) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function FinanceiroView({
  transactions,
  payouts,
  latestBalanceCents,
  dailyMetrics,
  period,
  customFrom,
  customTo,
  typeFilter,
  nickname,
}: {
  transactions: ShopeeWalletTransaction[]
  payouts: ShopeePayout[]
  latestBalanceCents: number | null
  dailyMetrics: ShopeeDailyMetric[]
  period: FinanceiroPeriod
  customFrom: string | null
  customTo: string | null
  typeFilter: string
  nickname: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showDatePicker) return
    function onDown(e: MouseEvent) {
      if (!datePickerRef.current) return
      if (!datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showDatePicker])

  type ViewMode = 'overview' | 'transacoes' | 'saques' | 'payouts'
  const rawView = searchParams.get('view') as ViewMode | null
  const view: ViewMode =
    rawView === 'transacoes' || rawView === 'saques' || rawView === 'payouts' || rawView === 'overview'
      ? rawView
      : 'overview'

  function setView(v: ViewMode) {
    const sp = new URLSearchParams(searchParams.toString())
    if (v === 'overview') sp.delete('view')
    else sp.set('view', v)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const withdrawalCount = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_CREATED').length

  function setPeriod(p: FinanceiroPeriod) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    if (p !== 'custom') {
      sp.delete('from')
      sp.delete('to')
    }
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', 'custom')
    sp.set('from', from)
    sp.set('to', to)
    setShowDatePicker(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function setType(t: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (t === 'all') sp.delete('type')
    else sp.set('type', t)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const aggregated = useMemo(() => aggregateByType(transactions), [transactions])
  const daily = useMemo(() => buildDailyFlow(transactions), [transactions])

  const totalIn = transactions.reduce((a, t) => a + Math.max(0, Number(t.amount_cents) || 0), 0) / 100
  const totalOut = transactions.reduce((a, t) => a + Math.min(0, Number(t.amount_cents) || 0), 0) / 100
  const netPeriodo = totalIn + totalOut
  const escrowVendas = transactions.filter(t => t.transaction_type === 'ESCROW_VERIFIED_ADD').reduce((a, t) => a + (Number(t.amount_cents) || 0), 0) / 100
  const totalSaques = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_CREATED').reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100
  const gastosSpm = transactions.filter(t => t.transaction_type?.startsWith('SPM_')).reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100

  const filteredTxs = useMemo(() => {
    if (typeFilter === 'all') return transactions
    return transactions.filter(t => t.transaction_type === typeFilter)
  }, [transactions, typeFilter])

  const maxBar = Math.max(...daily.map(d => Math.max(d.in_value, d.out_value)), 1)
  const totalPayoutsReais = payouts.reduce((a, p) => a + (Number(p.payout_amount_cents) || 0), 0) / 100

  return (
    <>
      <TopBar title="Financeiro — Shopee" />
      <main
        className={cn('flex flex-1 flex-col gap-gutter overflow-y-auto p-margin', pending && 'opacity-70 pointer-events-none')}
        style={showDatePicker ? { paddingBottom: '560px' } : undefined}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-zinc-50 flex items-center gap-sm">
              Financeiro
              <span className="text-zinc-500 font-normal">—</span>
              <span className="text-zinc-50">Shopee</span>
            </h1>
            <p className="font-body-md text-body-md text-zinc-400 mt-1">
              {nickname ? `Conta ${nickname}` : 'Conta Shopee ativa'} · fluxo de caixa real da carteira.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center rounded-lg p-1 border border-zinc-800 bg-zinc-900/60">
              {periods.map((p) => {
                const active = period === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      'px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors',
                      active ? 'bg-zinc-50 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-50',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <div ref={datePickerRef} className="relative z-30">
              <button
                type="button"
                onClick={() => setShowDatePicker(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  period === 'custom'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-50',
                )}
              >
                <span className="material-symbols-outlined text-[14px]">event</span>
                {period === 'custom' && customFrom && customTo
                  ? `${fmtDateBRShort(customFrom)} → ${fmtDateBRShort(customTo)}`
                  : 'Personalizado'}
              </button>
              {showDatePicker && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={applyCustomRange}
                  onClose={() => setShowDatePicker(false)}
                  align="right"
                />
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800">
          {[
            { key: 'overview' as const, label: 'Visão Geral', icon: 'dashboard', badge: null as number | null },
            { key: 'transacoes' as const, label: 'Transações', icon: 'receipt_long', badge: transactions.length },
            { key: 'saques' as const, label: 'Saques Bancários', icon: 'account_balance', badge: withdrawalCount },
            { key: 'payouts' as const, label: 'Repasses', icon: 'paid', badge: payouts.length || null },
          ].map((t) => {
            const active = view === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  active
                    ? 'border-primary text-zinc-50'
                    : 'border-transparent text-zinc-500 hover:text-zinc-200',
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-mono font-semibold',
                    active ? 'bg-primary/20 text-primary' : 'bg-zinc-800 text-zinc-400',
                  )}>
                    {t.badge.toLocaleString('pt-BR')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {view === 'overview' && (<>
        {/* Lucro Bruto Macro — fórmula João: Vendas − Taxas Shopee − Ads */}
        {(() => {
          const vendas = dailyMetrics.reduce((a, m) => a + (Number(m.gross_revenue) || 0), 0)
          const taxas = dailyMetrics.reduce((a, m) => a + (Number(m.total_commission) || 0) + (Number(m.total_shipping_cost) || 0), 0)
          const ads = dailyMetrics.reduce((a, m) => a + (Number(m.ads_spend_cents) || 0), 0) / 100
          const lucroBruto = vendas - taxas - ads
          const margemBruta = vendas > 0 ? (lucroBruto / vendas) * 100 : 0
          if (dailyMetrics.length === 0) return null
          return (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03) 50%, rgba(248,113,113,0.04))',
                border: '1px solid #27272a',
                borderRadius: '14px',
                padding: '20px 24px',
              }}
            >
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-emerald-400">savings</span>
                    Lucro Bruto Macro — Shopee
                  </div>
                  <div className={cn('font-h1 text-h1 mt-2', lucroBruto >= 0 ? 'text-secondary' : 'text-error')}>
                    {lucroBruto >= 0 ? '+' : ''}{fmtBrlInt(lucroBruto)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Vendas − Taxas Marketplace − Investimento Ads · margem {margemBruta.toFixed(1).replace('.', ',')}%
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 min-w-[440px]">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Vendas</div>
                    <div className="text-zinc-50 font-h3 text-h3 mt-1">{fmtBrlInt(vendas)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Taxas Shopee</div>
                    <div className="text-error font-h3 text-h3 mt-1">−{fmtBrlInt(taxas)}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">comissão + frete</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Ads</div>
                    <div className="text-error font-h3 text-h3 mt-1">−{fmtBrlInt(ads)}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{vendas > 0 ? `${((ads / vendas) * 100).toFixed(1)}%` : '—'} das vendas</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
          {[
            { label: 'Saldo Atual', value: latestBalanceCents !== null ? fmtBrlInt(latestBalanceCents / 100) : '—', icon: 'account_balance_wallet', tone: 'text-zinc-50' },
            { label: 'Repasses (vendas)', value: fmtBrlInt(escrowVendas), icon: 'shopping_bag', tone: 'text-secondary' },
            { label: 'Saques Bancários', value: fmtBrlInt(totalSaques), icon: 'arrow_circle_down', tone: 'text-primary' },
            { label: 'Gastos Marketing', value: fmtBrlInt(gastosSpm), icon: 'campaign', tone: 'text-error' },
            { label: 'Total Entradas', value: fmtBrlInt(totalIn), icon: 'trending_up', tone: 'text-secondary' },
            { label: 'Total Saídas', value: fmtBrlInt(Math.abs(totalOut)), icon: 'trending_down', tone: 'text-error' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
                <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
              </div>
              <div className={cn('font-h2 text-h2', kpi.tone)}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Saldo líquido período */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex items-center justify-between gap-4">
          <div>
            <div className="text-label-md text-zinc-400 uppercase tracking-wider">Saldo Líquido do Período</div>
            <div className={cn('font-h1 text-h1 mt-1', netPeriodo >= 0 ? 'text-secondary' : 'text-error')}>
              {netPeriodo >= 0 ? '+' : ''}{fmtBrlInt(netPeriodo)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Entradas {fmtBrlInt(totalIn)} − Saídas {fmtBrlInt(Math.abs(totalOut))} = {transactions.length} transações
            </div>
          </div>
          <span className="material-symbols-outlined text-6xl text-zinc-800">savings</span>
        </div>

        {/* Gráfico fluxo diário */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-h3 text-h3 text-zinc-50">Fluxo Diário</h3>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error" /> Saídas</span>
            </div>
          </div>
          {daily.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">Sem movimentações no período</div>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto">
              {daily.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1 min-w-[44px]">
                  <div className="flex items-end gap-[2px] h-32">
                    <div
                      className="w-3 bg-secondary/80 rounded-t"
                      style={{ height: `${(d.in_value / maxBar) * 100}%` }}
                      title={`Entradas: R$ ${fmtBrl(d.in_value)}`}
                    />
                    <div
                      className="w-3 bg-error/80 rounded-t"
                      style={{ height: `${(d.out_value / maxBar) * 100}%` }}
                      title={`Saídas: R$ ${fmtBrl(d.out_value)}`}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-500">{fmtShortDate(d.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        </>)}

        {view === 'transacoes' && (<>
        {/* Resumo por tipo */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-white/10">
            <h3 className="font-h3 text-h3 text-zinc-50">Resumo por Tipo de Transação</h3>
            <p className="text-xs text-zinc-500 mt-1">Click pra filtrar a lista abaixo</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-zinc-900/60">
                <tr>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Tipo</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Qtd</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor Total</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Filtro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-lg py-3 text-zinc-50 font-medium">Todos</td>
                  <td className="px-md py-3 text-zinc-400 text-right">{fmtNum(transactions.length)}</td>
                  <td className="px-md py-3 text-right font-mono-sm">—</td>
                  <td className="px-lg py-3">
                    <button
                      type="button"
                      onClick={() => setType('all')}
                      className={cn('px-2 py-1 rounded text-[10px] font-semibold', typeFilter === 'all' ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-50')}
                    >
                      {typeFilter === 'all' ? 'Ativo' : 'Aplicar'}
                    </button>
                  </td>
                </tr>
                {aggregated.map((a) => (
                  <tr key={a.type} className="hover:bg-white/[0.02]">
                    <td className="px-lg py-3 text-zinc-50">
                      <div className="flex items-center gap-2">
                        <span className={cn('material-symbols-outlined text-[16px]', a.is_in ? 'text-secondary' : 'text-error')}>
                          {typeIcon[a.type] || 'paid'}
                        </span>
                        <div className="flex flex-col">
                          <span>{typeLabel[a.type] || a.type}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">{a.type}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-md py-3 text-zinc-400 text-right">{fmtNum(a.qty)}</td>
                    <td className={cn('px-md py-3 text-right font-mono-sm font-semibold', a.is_in ? 'text-secondary' : 'text-error')}>
                      {a.is_in ? '+' : ''}{fmtBrlInt(a.total_cents / 100)}
                    </td>
                    <td className="px-lg py-3">
                      <button
                        type="button"
                        onClick={() => setType(a.type)}
                        className={cn('px-2 py-1 rounded text-[10px] font-semibold', typeFilter === a.type ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-50')}
                      >
                        {typeFilter === a.type ? 'Ativo' : 'Aplicar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista transações */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-white/10 flex items-center justify-between">
            <h3 className="font-h3 text-h3 text-zinc-50">
              Transações {typeFilter !== 'all' && (
                <span className="text-zinc-500 font-normal text-sm ml-2">{typeLabel[typeFilter] || typeFilter}</span>
              )}
            </h3>
            <span className="text-xs text-zinc-500">{fmtNum(filteredTxs.length)} {filteredTxs.length === 1 ? 'transação' : 'transações'}</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-zinc-900/60 sticky top-0 z-10">
                <tr>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Tipo</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Pedido</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Saldo Após</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-zinc-500 py-8">Sem transações</td>
                  </tr>
                ) : (
                  filteredTxs.slice(0, 500).map((t) => {
                    const amount = Number(t.amount_cents) / 100
                    const isIn = amount >= 0
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="px-lg py-2 text-zinc-400 text-xs">{fmtDate(t.create_time)}</td>
                        <td className="px-md py-2">
                          <div className="flex items-center gap-2">
                            <span className={cn('material-symbols-outlined text-[14px]', isIn ? 'text-secondary' : 'text-error')}>
                              {typeIcon[t.transaction_type || ''] || 'paid'}
                            </span>
                            <span className="text-zinc-50 text-xs">{typeLabel[t.transaction_type || ''] || t.transaction_type || '—'}</span>
                          </div>
                        </td>
                        <td className="px-md py-2 text-zinc-500 font-mono text-[10px]">{t.order_sn || '—'}</td>
                        <td className={cn('px-md py-2 text-right font-mono-sm font-semibold', isIn ? 'text-secondary' : 'text-error')}>
                          {isIn ? '+' : ''}R$ {fmtBrl(amount)}
                        </td>
                        <td className="px-md py-2 text-right font-mono-sm text-zinc-400">
                          {t.current_balance_cents !== null ? `R$ ${fmtBrl(Number(t.current_balance_cents) / 100)}` : '—'}
                        </td>
                        <td className="px-lg py-2 text-zinc-500 text-xs">{t.status || '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredTxs.length > 500 && (
            <div className="p-3 border-t border-white/10 text-center text-xs text-zinc-500">
              Mostrando 500 mais recentes de {fmtNum(filteredTxs.length)}
            </div>
          )}
        </div>

        </>)}

        {view === 'saques' && (<>
        {/* Saques Bancários (Shopee Pay → Conta Lucas/Santander) */}
        {(() => {
          const withdrawals = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_CREATED')
          const completions = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_COMPLETED')
          if (withdrawals.length === 0) return null
          const completionByWithdrawalId = new Map<string, ShopeeWalletTransaction>()
          for (const c of completions) {
            const raw = c.raw as { withdrawal_id?: number | string } | null
            const wid = raw?.withdrawal_id != null ? String(raw.withdrawal_id) : null
            if (wid) completionByWithdrawalId.set(wid, c)
          }
          const totalSacado = withdrawals.reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100
          const maxSaque = withdrawals.reduce((m, t) => Math.max(m, Math.abs(Number(t.amount_cents) || 0)), 0) / 100
          const ultimoSaque = withdrawals[0]
          const mediaSaques = withdrawals.length > 0 ? totalSacado / withdrawals.length : 0

          return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(16,185,129,0.04))',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  padding: '20px 24px',
                }}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] text-primary">account_balance</span>
                      Saques Bancários
                    </div>
                    <h3 className="font-h3 text-h3 text-zinc-50 mt-1">Transferências Shopee Pay → Conta</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Saques sincronizados via wallet API. Cruzar withdrawal_id com extrato Santander.
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-3 min-w-[480px]">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Total Sacado</div>
                      <div className="text-primary font-h3 text-h3 mt-1">{fmtBrlInt(totalSacado)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Saques</div>
                      <div className="text-zinc-50 font-h3 text-h3 mt-1">{fmtNum(withdrawals.length)}</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">média {fmtBrlInt(mediaSaques)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Maior Saque</div>
                      <div className="text-zinc-50 font-h3 text-h3 mt-1">{fmtBrlInt(maxSaque)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Último Saque</div>
                      <div className="text-zinc-50 font-h3 text-h3 mt-1">
                        {fmtBrlInt(Math.abs(Number(ultimoSaque.amount_cents) || 0) / 100)}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">{fmtShortDate(ultimoSaque.create_time)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left font-label-md text-label-md whitespace-nowrap border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="bg-zinc-950 px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Data Solicitação</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right border-b border-white/10">Valor</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right border-b border-white/10">Saldo Após</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Withdrawal ID</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Carteira</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Conclusão</th>
                      <th className="bg-zinc-950 px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {withdrawals.map((w) => {
                      const raw = w.raw as { withdrawal_id?: number | string; transaction_fee?: number } | null
                      const wid = raw?.withdrawal_id != null ? String(raw.withdrawal_id) : null
                      const fee = (raw?.transaction_fee ?? 0) as number
                      const valor = Math.abs(Number(w.amount_cents) || 0) / 100
                      const completion = wid ? completionByWithdrawalId.get(wid) : undefined
                      return (
                        <tr key={w.id} className="hover:bg-white/[0.02]">
                          <td className="px-lg py-2 text-zinc-400 text-xs">{fmtDate(w.create_time)}</td>
                          <td className="px-md py-2 text-right font-mono-sm text-primary font-semibold">
                            R$ {fmtBrl(valor)}
                          </td>
                          <td className="px-md py-2 text-right font-mono-sm text-zinc-400">
                            {w.current_balance_cents != null ? `R$ ${fmtBrl(Number(w.current_balance_cents) / 100)}` : '—'}
                          </td>
                          <td className="px-md py-2">
                            {wid ? (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(wid)}
                                className="group inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Copiar withdrawal_id pra cruzar com extrato Santander"
                              >
                                <span>{wid}</span>
                                <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">content_copy</span>
                              </button>
                            ) : '—'}
                          </td>
                          <td className="px-md py-2 text-zinc-500 text-xs">{w.wallet_type || '—'}</td>
                          <td className="px-md py-2 text-zinc-500 text-xs">
                            {completion ? fmtDate(completion.create_time) : '—'}
                          </td>
                          <td className="px-lg py-2">
                            <span className={cn(
                              'inline-block px-2 py-0.5 rounded text-[10px] font-semibold border',
                              completion
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                            )}>
                              {completion ? 'Concluído' : (w.status || 'Solicitado')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-white/10 text-center text-[10px] text-zinc-600">
                💡 BR API não retorna banco destino. Cruzar withdrawal_id + valor + data com extrato Santander.
              </div>
            </div>
          )
        })()}

        </>)}

        {view === 'payouts' && (<>
        {/* Payouts (se houver) */}
        {payouts.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
            <div className="p-lg border-b border-white/10 flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-zinc-50">Repasses Históricos (Payouts)</h3>
              <span className="text-xs text-zinc-500">{payouts.length} repasses · Total {fmtBrlInt(totalPayoutsReais)}</span>
            </div>
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-zinc-900/60">
                <tr>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Período</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Banco</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-lg py-2 text-zinc-400 text-xs">{fmtDate(p.payout_time)}</td>
                    <td className="px-md py-2 text-zinc-500 text-xs">
                      {p.payout_period_start && p.payout_period_end
                        ? `${fmtShortDate(p.payout_period_start)} → ${fmtShortDate(p.payout_period_end)}`
                        : '—'}
                    </td>
                    <td className="px-md py-2 text-zinc-500 font-mono text-xs">{p.bank_account_masked || '—'}</td>
                    <td className="px-md py-2 text-zinc-400 text-right">{p.total_orders ?? '—'}</td>
                    <td className="px-md py-2 text-right font-mono-sm text-secondary font-semibold">
                      R$ {fmtBrl(Number(p.payout_amount_cents) / 100)}
                    </td>
                    <td className="px-lg py-2 text-zinc-500 text-xs">{p.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {payouts.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-xl flex flex-col items-center gap-md text-center">
            <span className="material-symbols-outlined text-4xl text-zinc-600">paid</span>
            <h3 className="font-h3 text-h3 text-zinc-50">Nenhum repasse registrado</h3>
            <p className="text-sm text-zinc-500 max-w-md">
              Endpoint <code className="font-mono text-xs">get_payout_detail</code> retorna <em>&quot;only applicable for cross boarder shop&quot;</em> em loja BR.
              Use a aba <strong>Saques Bancários</strong> pra ver transferências reais Shopee Pay → Conta.
            </p>
          </div>
        )}
        </>)}
      </main>
    </>
  )
}
