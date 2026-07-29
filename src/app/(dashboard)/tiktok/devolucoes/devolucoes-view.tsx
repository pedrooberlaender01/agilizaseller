'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { KpiCard, fmtBrl, fmtNum } from '../_ui'

const PAGE_SIZE = 50
type Period = '7d' | '30d' | '90d'

export type ReturnRow = {
  return_id: string
  order_id: string | null
  return_type: string | null
  return_status: string | null
  return_reason_text: string | null
  role: string | null
  refund_amount: number | string | null
  currency: string | null
  create_time: string | null
}

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'
const toneClasses: Record<Tone, string> = {
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray: 'bg-outline/20 text-zinc-500 border border-outline/30',
}
function statusTone(s: string | null): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v.includes('REJECT') || v.includes('CANCEL')) return 'red'
  if (v.includes('SUCCESS') || v.includes('COMPLETE')) return 'green'
  if (v.includes('PENDING') || v.includes('AWAITING')) return 'yellow'
  if (v.includes('PROCESS') || v.includes('SHIP')) return 'blue'
  return 'gray'
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

export function DevolucoesView({
  summary,
  returns,
  totalCount,
  page,
  period,
  status,
  search,
  statuses,
}: {
  summary: { total: number; valorPerdido: number; reembolsadas: number; pendentes: number; emDisputa: number; topMotivo: string | null }
  returns: ReturnRow[]
  totalCount: number
  page: number
  period: Period
  status: string
  search: string
  statuses: string[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)

  function pushParams(updater: (n: URLSearchParams) => void, resetPage = true) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    if (resetPage) next.delete('page')
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }

  useEffect(() => {
    if (debouncedSearch === search) return
    pushParams((n) => {
      if (debouncedSearch) n.set('q', debouncedSearch)
      else n.delete('q')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function setStatus(s: string) {
    pushParams((n) => {
      if (s) n.set('status', s)
      else n.delete('status')
    })
  }
  function setPeriod(p: Period) {
    pushParams((n) => n.set('period', p))
  }
  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <TopBar title="Devoluções — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="Devoluções" value={fmtNum(summary.total)} icon="keyboard_return" />
          <KpiCard
            label="Valor Reembolsado"
            value={fmtBrl(summary.valorPerdido)}
            icon="payments"
            tone="red"
            sub={`${fmtNum(summary.reembolsadas)} concluídas`}
          />
          <KpiCard label="Em Andamento" value={fmtNum(summary.pendentes)} icon="pending_actions" tone="gold" sub="aguardando envio/recebimento" />
          <KpiCard label="Em Disputa" value={fmtNum(summary.emDisputa)} icon="gavel" tone="red" sub="arbitragem em aberto" />
          <KpiCard label="Top Motivo" value={summary.topMotivo ?? '—'} icon="help" />
        </div>

        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[280px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40"
                placeholder="Buscar return_id, pedido..."
              />
            </div>
            {statuses.length > 0 && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
              >
                <option value="">Todos status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
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

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Return ID</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Tipo</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Motivo</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Reembolso</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhuma devolução no período. Sync roda a cada 4h.
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.return_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">{r.return_id}</td>
                    <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">{r.order_id ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{r.return_type ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(r.return_status)])}>
                        {r.return_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 max-w-[260px] text-xs text-slate-300">{r.return_reason_text ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-error">{fmtBrl(r.refund_amount, r.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(r.create_time)}</td>
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
