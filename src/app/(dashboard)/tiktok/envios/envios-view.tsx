'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { fmtNum } from '../_ui'

const PAGE_SIZE = 50
type Period = '7d' | '30d' | '90d'

export type ShipmentRow = {
  order_id: string
  tracking_number: string | null
  shipping_provider: string | null
  delivery_option: string | null
  order_status: string | null
  buyer_name: string | null
  destino: string | null
  create_time: string | null
  delivery_time: string | null
}

// Cards de resumo -> filtram por status da API (nome cru)
const CARDS = [
  { key: 'enviado', label: 'Enviado', icon: 'local_shipping', tone: 'text-blue-400', status: 'IN_TRANSIT' },
  { key: 'concluido', label: 'Concluído', icon: 'check_circle', tone: 'text-secondary', status: 'DELIVERED' },
  { key: 'aEnviar', label: 'A Enviar', icon: 'pending_actions', tone: 'text-[#facc3c]', status: 'AWAITING_SHIPMENT' },
  { key: 'cancelado', label: 'Cancelado', icon: 'cancel', tone: 'text-error', status: 'CANCELLED' },
  { key: 'semRastreio', label: 'Sem Rastreio', icon: 'help', tone: 'text-zinc-500', status: '' },
] as const

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
  if (v.includes('CANCEL')) return 'red'
  if (v === 'DELIVERED' || v === 'COMPLETED') return 'green'
  if (v.includes('TRANSIT') || v.includes('COLLECTION')) return 'blue'
  if (v.includes('AWAITING') || v === 'ON_HOLD' || v === 'UNPAID') return 'yellow'
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

export function EnviosView({
  summary,
  shipments,
  page,
  period,
  status,
  search,
}: {
  summary: { enviado: number; concluido: number; aEnviar: number; cancelado: number; semRastreio: number }
  shipments: ShipmentRow[]
  page: number
  period: Period
  status: string
  search: string
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
      if (s && s !== status) n.set('status', s)
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

  return (
    <>
      <TopBar title="Envios — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        {/* Cards resumo (clicáveis = filtro) */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-5">
          {CARDS.map((c) => {
            const active = c.status !== '' && status === c.status
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => c.status && setStatus(c.status)}
                disabled={!c.status}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border bg-zinc-900/40 p-lg text-left transition-colors',
                  active ? 'border-zinc-50/40 ring-1 ring-zinc-50/20' : 'border-zinc-800',
                  c.status ? 'hover:bg-zinc-900/70' : 'cursor-default',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{c.label}</span>
                  <span className={`material-symbols-outlined text-lg ${c.tone}`}>{c.icon}</span>
                </div>
                <span className="text-[32px] font-semibold leading-none text-zinc-50">
                  {fmtNum(summary[c.key])}
                </span>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-[300px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40"
              placeholder="Buscar rastreio, pedido, comprador..."
            />
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <button
                onClick={() => setStatus('')}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
              >
                {status}
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
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
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Rastreio</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Transportadora</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Entrega</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum envio encontrado no período.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.order_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-300">{s.tracking_number ?? '—'}</td>
                    <td className="px-6 py-4 font-mono text-[10px] text-zinc-500">{s.order_id}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{s.buyer_name ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{s.shipping_provider ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(s.order_status)])}>
                        {s.order_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(s.create_time)}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(s.delivery_time)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <span className="text-sm text-slate-400">Página {page}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={shipments.length < PAGE_SIZE}
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
