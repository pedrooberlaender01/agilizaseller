'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'all'

export type SettlementRow = {
  id: string
  settlement_id: string | null
  order_no: string | null
  gross_amount: number | string | null
  amount?: number | string | null
  fee: number | string | null
  commission: number | string | null
  service_charge: number | string | null
  estimated_income: number | string | null
  net_amount: number | string | null
  currency: string | null
  settlement_date: string | null
  created_at: string | null
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

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
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
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value}</p>
    </div>
  )
}

export function FinanceiroView({
  rows,
  totalCount,
  page,
  period,
  search,
  nickname,
}: {
  rows: SettlementRow[]
  totalCount: number
  page: number
  period: Period
  search: string
  nickname?: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)

  function pushParams(updater: (next: URLSearchParams) => void, resetPage = true) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    if (resetPage) next.delete('page')
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  useEffect(() => {
    if (debouncedSearch === search) return
    pushParams((next) => {
      if (debouncedSearch) next.set('q', debouncedSearch)
      else next.delete('q')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function setPeriod(p: Period) {
    pushParams((next) => next.set('period', p))
  }

  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.gross += Number(r.gross_amount ?? r.amount ?? 0)
        acc.fee += Number(r.fee ?? 0)
        acc.commission += Number(r.commission ?? 0)
        acc.service += Number(r.service_charge ?? 0)
        acc.estimated += Number(r.estimated_income ?? 0)
        acc.net += Number(r.net_amount ?? 0)
        return acc
      },
      { gross: 0, fee: 0, commission: 0, service: 0, estimated: 0, net: 0 },
    )
  }, [rows])
  const taxaPct = totals.gross > 0 ? (totals.fee / totals.gross) * 100 : 0

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <TopBar title="Financeiro — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Liquidações</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {(['7d', '30d', '90d', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {p === 'all' ? 'Tudo' : p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Bruto" value={fmtBrl(totals.gross)} icon="payments" tone="blue" />
          <StatCard label="Comissão Shein" value={fmtBrl(totals.commission)} icon="percent" tone="red" />
          <StatCard label="Service charge" value={fmtBrl(totals.service)} icon="local_shipping" tone="red" />
          <StatCard label={`Taxa total (${taxaPct.toFixed(1)}%)`} value={fmtBrl(totals.fee)} icon="receipt" tone="red" />
          <StatCard label="Receita líquida est." value={fmtBrl(totals.estimated)} icon="account_balance_wallet" tone="green" />
        </div>

        <div className="mb-lg flex flex-wrap items-center gap-4">
          <div className="relative w-[280px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
              placeholder="Buscar settlement_id ou order_no..."
            />
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Settlement ID</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Bruto</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Comissão</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Service</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido est.</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Sem liquidações no período. Aguarde sync de settlements.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-800/60 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-xs text-white">{s.settlement_id || '—'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{s.order_no || '—'}</td>
                    <td className="px-6 py-4 text-right">{fmtBrl(s.gross_amount ?? s.amount, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtBrl(s.commission, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtBrl(s.service_charge, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right font-medium text-secondary">{fmtBrl(s.estimated_income, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(s.settlement_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <span className="text-sm text-slate-400">
              {totalCount === 0
                ? '0 resultados'
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-300">Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
