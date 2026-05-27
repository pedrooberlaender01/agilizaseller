'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { cn } from '@/lib/utils'
import type { ShopeeWalletTransaction, ShopeePayout } from '@/types'
import type { Period } from '@/components/metrics-chart'

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
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
  period,
  typeFilter,
  nickname,
}: {
  transactions: ShopeeWalletTransaction[]
  payouts: ShopeePayout[]
  latestBalanceCents: number | null
  period: Period
  typeFilter: string
  nickname: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: Period) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
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
      <main className={cn('flex flex-1 flex-col gap-gutter overflow-y-auto p-margin', pending && 'opacity-70 pointer-events-none')}>
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
        </div>

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
      </main>
    </>
  )
}
