'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { cn } from '@/lib/utils'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'

const PAGE_SIZE = 50
type Period = '7d' | '30d' | '90d' | 'custom'

export type StatementRow = {
  statement_id: string | null
  settlement_amount: number | string | null
  fee: number | string | null
  revenue: number | string | null
  currency: string | null
  statement_time: string | null
  raw: { payment_status?: string | null } | null
}

export type TransactionRow = {
  transaction_id: string | null
  statement_id: string | null
  type: string | null
  settlement_amount: number | string | null
  order_create_time: string | null
}

export type OrderFeeRow = {
  order_id: string
  platform_commission: number | string | null
  sfp_service_fee: number | string | null
  fee_per_item: number | string | null
  affiliate_commission: number | string | null
  shipping_cost_amount: number | string | null
  settlement_amount: number | string | null
  revenue_amount: number | string | null
  paid_time: string | null
}

export type WithdrawalRow = {
  withdrawal_id: string
  type: string | null
  amount: number | string | null
  currency: string | null
  status: string | null
  create_time: string | null
}

const txTypeLabel: Record<string, string> = {
  ORDER: 'Pedido',
  GMV_PAYMENT_FOR_TIKTOK_ADS: 'Pagamento de Ads',
  LOGISTICS_REIMBURSEMENT: 'Reembolso de Logística',
  PLATFORM_REIMBURSEMENT: 'Reembolso da Plataforma',
}
const txTypeIcon: Record<string, string> = {
  ORDER: 'shopping_bag',
  GMV_PAYMENT_FOR_TIKTOK_ADS: 'campaign',
  LOGISTICS_REIMBURSEMENT: 'local_shipping',
  PLATFORM_REIMBURSEMENT: 'redeem',
}

const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

type Tone = 'green' | 'yellow' | 'red' | 'gray'
const toneClasses: Record<Tone, string> = {
  green:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  red:    'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:   'bg-outline/20 text-zinc-500 border border-outline/30',
}
function payTone(s: string | null | undefined): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v === 'PAID') return 'green'
  if (v === 'FAILED') return 'red'
  if (v === 'PROCESSING') return 'yellow'
  return 'gray'
}
function withdrawalTone(s: string | null | undefined): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v === 'SUCCESS') return 'green'
  if (v === 'FAILED' || v === 'REVERSE') return 'red'
  if (v === 'PROCESSING') return 'yellow'
  return 'gray'
}

function KpiCard({ label, value, tone, soon, sub }: { label: string; value: string; tone?: 'white' | 'green' | 'red'; soon?: boolean; sub?: string }) {
  const color = tone === 'green' ? 'text-secondary' : tone === 'red' ? 'text-error' : 'text-white'
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
        {soon && (
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-200">
            Em breve
          </span>
        )}
      </div>
      <p className={cn('mt-1 text-xl font-semibold', soon ? 'text-zinc-600' : color)}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  )
}

type ViewMode = 'overview' | 'transacoes' | 'taxas' | 'saques' | 'repasses'

export function FinanceiroView({
  kpi,
  statements,
  totalCount,
  transactions,
  transactionsTotalCount,
  orderFees,
  orderFeesTotalCount,
  orderFeesSummary,
  withdrawals,
  withdrawalsTotalCount,
  settles,
  settlesTotalCount,
  page,
  period,
  customFrom,
  customTo,
}: {
  kpi: { statements: number; repasse: number; taxas: number; receita: number; afiliados: number; ads: number }
  statements: StatementRow[]
  totalCount: number
  transactions: TransactionRow[]
  transactionsTotalCount: number
  orderFees: OrderFeeRow[]
  orderFeesTotalCount: number
  orderFeesSummary: { ordersCount: number; platform: number; sfp: number; feePerItem: number }
  withdrawals: WithdrawalRow[]
  withdrawalsTotalCount: number
  settles: WithdrawalRow[]
  settlesTotalCount: number
  page: number
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

  const rawView = sp.get('view') as ViewMode | null
  const view: ViewMode = rawView === 'transacoes' || rawView === 'taxas' || rawView === 'saques' || rawView === 'repasses' ? rawView : 'overview'
  function setView(v: ViewMode) {
    const next = new URLSearchParams(sp.toString())
    if (v === 'overview') next.delete('view')
    else next.set('view', v)
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }

  const txByType = new Map<string, { qty: number; total: number }>()
  for (const t of transactions) {
    const key = t.type ?? 'unknown'
    const cur = txByType.get(key) ?? { qty: 0, total: 0 }
    cur.qty += 1
    cur.total += Number(t.settlement_amount ?? 0)
    txByType.set(key, cur)
  }
  const txSummary = Array.from(txByType.entries()).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))


  useEffect(() => {
    if (!showDatePicker) return
    function onDown(e: MouseEvent) {
      if (!datePickerRef.current) return
      if (!datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showDatePicker])

  function pushParams(updater: (next: URLSearchParams) => void, resetPage = true) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    if (resetPage) next.delete('page')
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }
  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      if (p !== 'custom') { next.delete('from'); next.delete('to') }
    })
  }
  function applyCustomRange(f: string, t: string) {
    pushParams((next) => { next.set('period', 'custom'); next.set('from', f); next.set('to', t) })
    setShowDatePicker(false)
  }
  function setPage(n: number) {
    pushParams((next) => { if (n <= 1) next.delete('page'); else next.set('page', String(n)) }, false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <TopBar title="Financeiro — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
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
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#050507] px-3 py-1.5 text-xs font-medium transition-colors', period === 'custom' ? 'border-zinc-50/40 text-white' : 'text-slate-400 hover:text-white')}
            >
              <span className="material-symbols-outlined text-[14px]">event</span>
              {period === 'custom' && customFrom && customTo ? `${fmtDateBRShort(customFrom)} → ${fmtDateBRShort(customTo)}` : 'Personalizado'}
            </button>
            {showDatePicker && (
              <DateRangePopover from={customFrom} to={customTo} onApply={applyCustomRange} onClose={() => setShowDatePicker(false)} align="right" />
            )}
          </div>
        </div>

        {/* Tabs (espelha Shopee financeiro) */}
        <div className="mb-lg flex flex-wrap items-center gap-1 border-b border-zinc-800">
          {[
            { key: 'overview' as const, label: 'Visão Geral' },
            { key: 'transacoes' as const, label: 'Transações' },
            { key: 'taxas' as const, label: 'Taxas' },
            { key: 'saques' as const, label: 'Saques Bancários' },
            { key: 'repasses' as const, label: 'Repasses' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={cn(
                'px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                view === t.key ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {view === 'overview' && (<>
        <div className="mb-lg grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard label="Repasse (líquido)" value={fmtBrl(kpi.repasse)} tone="green" />
          <KpiCard label="Receita bruta" value={fmtBrl(kpi.receita)} />
          <KpiCard label="Taxas TikTok" value={fmtBrl(kpi.taxas)} tone="red" />
          <KpiCard label="Comissão afiliados" value={fmtBrl(kpi.afiliados)} tone="red" />
          <KpiCard label="Ads" value={fmtBrl(kpi.ads)} tone="red" />
          <KpiCard label="Statements" value={kpi.statements.toLocaleString('pt-BR')} />
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Statement</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pagamento</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receita</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Taxas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Repasse</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {statements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum statement no período. Sync Statements roda a cada 6h.
                  </td>
                </tr>
              ) : (
                statements.map((s) => (
                  <tr key={s.statement_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-[11px] text-zinc-400">{s.statement_id}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[payTone(s.raw?.payment_status)])}>
                        {s.raw?.payment_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-white">{fmtBrl(s.revenue, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtBrl(s.fee, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right font-medium text-secondary">{fmtBrl(s.settlement_amount, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(s.statement_time)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <span className="text-sm text-slate-400">
              {totalCount === 0 ? '0 resultados' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <span className="px-2 text-xs text-slate-300">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Próximo</button>
            </div>
          </div>
        </div>
        </>)}

        {view === 'transacoes' && (<>
        {/* Resumo por tipo */}
        <div className="mb-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Resumo por Tipo de Transação</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Tipo</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Qtd</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor Total</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {txSummary.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhuma transação no período.</td></tr>
                ) : txSummary.map(([type, agg]) => (
                  <tr key={type} className="border-b border-zinc-800/60">
                    <td className="px-6 py-4 text-white">
                      <div className="flex items-center gap-2">
                        <span className={cn('material-symbols-outlined text-[16px]', agg.total >= 0 ? 'text-secondary' : 'text-error')}>
                          {txTypeIcon[type] || 'paid'}
                        </span>
                        <div className="flex flex-col">
                          <span>{txTypeLabel[type] || type}</span>
                          <span className="font-mono text-[10px] text-zinc-600">{type}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400">{agg.qty.toLocaleString('pt-BR')}</td>
                    <td className={cn('px-6 py-4 text-right font-medium', agg.total >= 0 ? 'text-secondary' : 'text-error')}>{fmtBrl(agg.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista transações */}
        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Transações</h3>
            <span className="text-xs text-slate-400">{transactionsTotalCount.toLocaleString('pt-BR')} no período{transactions.length < transactionsTotalCount ? ` (mostrando ${transactions.length})` : ''}</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Tipo</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Statement</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {transactions.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhuma transação no período.</td></tr>
                ) : transactions.map((t) => {
                  const amount = Number(t.settlement_amount ?? 0)
                  return (
                    <tr key={t.transaction_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                      <td className="px-6 py-2 text-xs text-slate-400">{fmtDate(t.order_create_time)}</td>
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-2 text-xs text-white">
                          <span className={cn('material-symbols-outlined text-[14px]', amount >= 0 ? 'text-secondary' : 'text-error')}>
                            {txTypeIcon[t.type ?? ''] || 'paid'}
                          </span>
                          {txTypeLabel[t.type ?? ''] || t.type || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-2 font-mono text-[10px] text-zinc-500">{t.statement_id}</td>
                      <td className={cn('px-6 py-2 text-right font-medium', amount >= 0 ? 'text-secondary' : 'text-error')}>{fmtBrl(amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>)}

        {view === 'taxas' && (<>
        <div className="mb-lg grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard label="Total Taxas" value={fmtBrl(orderFeesSummary.platform + orderFeesSummary.sfp + orderFeesSummary.feePerItem)} tone="red" />
          <KpiCard label="Comissão da Plataforma" value={fmtBrl(orderFeesSummary.platform)} tone="red" />
          <KpiCard label="Taxa de Serviço (SFP)" value={fmtBrl(orderFeesSummary.sfp)} tone="red" />
          <KpiCard label="Taxa por Item" value={fmtBrl(orderFeesSummary.feePerItem)} tone="red" />
          <KpiCard label="Pedidos liquidados" value={orderFeesSummary.ordersCount.toLocaleString('pt-BR')} sub="mesma base do card Taxas TikTok (paid_time)" />
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Taxas por Pedido</h3>
            <span className="text-xs text-slate-400">{orderFeesTotalCount.toLocaleString('pt-BR')} liquidados no período{orderFees.length < orderFeesTotalCount ? ` (mostrando ${orderFees.length})` : ''}</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Pago em</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Comissão</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">SFP</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Por Item</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Repasse</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {orderFees.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhum pedido liquidado no período.</td></tr>
                ) : orderFees.map((f) => (
                  <tr key={f.order_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-2 font-mono text-[11px] text-zinc-400">{f.order_id}</td>
                    <td className="px-6 py-2 text-xs text-slate-400">{fmtDate(f.paid_time)}</td>
                    <td className="px-6 py-2 text-right text-error">{fmtBrl(f.platform_commission)}</td>
                    <td className="px-6 py-2 text-right text-error">{fmtBrl(f.sfp_service_fee)}</td>
                    <td className="px-6 py-2 text-right text-error">{fmtBrl(f.fee_per_item)}</td>
                    <td className="px-6 py-2 text-right font-medium text-secondary">{fmtBrl(f.settlement_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>)}

        {view === 'saques' && (<>
        {(() => {
          const totalSacado = withdrawals.reduce((a, w) => a + Number(w.amount ?? 0), 0)
          const ultimo = withdrawals[0]
          return (
            <div className="mb-lg grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard label="Total Sacado" value={fmtBrl(totalSacado)} tone="green" />
              <KpiCard label="Qtd Saques" value={withdrawalsTotalCount.toLocaleString('pt-BR')} sub={withdrawalsTotalCount > 0 ? `média ${fmtBrl(totalSacado / withdrawalsTotalCount)}` : undefined} />
              <KpiCard label="Último Saque" value={ultimo ? fmtBrl(ultimo.amount, ultimo.currency ?? 'BRL') : '—'} sub={ultimo ? fmtDate(ultimo.create_time) : undefined} />
            </div>
          )
        })()}

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Saques Bancários</h3>
            <span className="text-xs text-slate-400">{withdrawalsTotalCount.toLocaleString('pt-BR')} no período{withdrawals.length < withdrawalsTotalCount ? ` (mostrando ${withdrawals.length})` : ''}</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">ID Saque</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {withdrawals.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhum saque no período.</td></tr>
                ) : withdrawals.map((w) => (
                  <tr key={w.withdrawal_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-2 font-mono text-[11px] text-zinc-400">{w.withdrawal_id}</td>
                    <td className="px-6 py-2 text-xs text-slate-400">{fmtDate(w.create_time)}</td>
                    <td className="px-6 py-2">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[withdrawalTone(w.status)])}>
                        {w.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-right font-medium text-white">{fmtBrl(w.amount, w.currency ?? 'BRL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>)}

        {view === 'repasses' && (<>
        {(() => {
          const totalRepasse = settles.reduce((a, s) => a + Number(s.amount ?? 0), 0)
          const ultimo = settles[0]
          return (
            <div className="mb-lg grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard label="Total Repassado" value={fmtBrl(totalRepasse)} tone="green" />
              <KpiCard label="Qtd Repasses" value={settlesTotalCount.toLocaleString('pt-BR')} sub={settlesTotalCount > 0 ? `média ${fmtBrl(totalRepasse / settlesTotalCount)}` : undefined} />
              <KpiCard label="Último Repasse" value={ultimo ? fmtBrl(ultimo.amount, ultimo.currency ?? 'BRL') : '—'} sub={ultimo ? fmtDate(ultimo.create_time) : undefined} />
            </div>
          )
        })()}

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Repasses</h3>
            <span className="text-xs text-slate-400">{settlesTotalCount.toLocaleString('pt-BR')} no período{settles.length < settlesTotalCount ? ` (mostrando ${settles.length})` : ''}</span>
          </div>
          <p className="px-lg pb-3 text-xs text-slate-500">Créditos individuais no saldo TikTok (SETTLE) — diferente do Saques (dinheiro saindo pro banco) e do Statements da Visão Geral (relatório periódico em lote).</p>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">ID</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {settles.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">Nenhum repasse no período.</td></tr>
                ) : settles.map((s) => (
                  <tr key={s.withdrawal_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-2 font-mono text-[11px] text-zinc-400">{s.withdrawal_id}</td>
                    <td className="px-6 py-2 text-xs text-slate-400">{fmtDate(s.create_time)}</td>
                    <td className="px-6 py-2">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[withdrawalTone(s.status)])}>
                        {s.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-2 text-right font-medium text-secondary">{fmtBrl(s.amount, s.currency ?? 'BRL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>)}
      </main>
    </>
  )
}
