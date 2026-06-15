'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export type ShipmentRow = {
  id: string
  order_no: string
  package_no: string | null
  waybill_no: string
  carrier: string | null
  carrier_code: string | null
  waybill_type: number | null
  last_node: string | null
  last_node_name: string | null
  last_update_at: string | null
  product_name: string | null
  item_count: number | null
  order_status: string | null
  buyer_name: string | null
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function fmtRel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `há ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days}d`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: string; tone?: 'default' | 'green' | 'yellow' | 'blue' | 'red' }) {
  const toneCls = tone === 'green' ? 'text-emerald-300' : tone === 'yellow' ? 'text-amber-300' : tone === 'blue' ? 'text-blue-300' : tone === 'red' ? 'text-rose-300' : 'text-white'
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

function nodeBadge(nodeCode: string | null, nodeName: string | null): { label: string; cls: string } {
  if (!nodeCode) return { label: 'Aguardando', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' }
  const code = nodeCode.toLowerCase()
  if (['sign_for', 'signed', 'delivered'].includes(code)) {
    return { label: nodeName || 'Entregue', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' }
  }
  if (code.includes('return') || code.includes('exception') || code.includes('fail')) {
    return { label: nodeName || 'Exceção', cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/30' }
  }
  if (code.includes('transport') || code.includes('transit')) {
    return { label: nodeName || 'Em trânsito', cls: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' }
  }
  return { label: nodeName || nodeCode, cls: 'bg-zinc-700/30 text-zinc-300 border border-zinc-600/40' }
}

export function EnviosView({
  shipments,
  totalCount,
  page,
  search,
  carrier,
  status,
  carriers,
  stats,
  nickname,
}: {
  shipments: ShipmentRow[]
  totalCount: number
  page: number
  search: string
  carrier: string
  status: string
  carriers: string[]
  stats: { total: number; pending: number; transit: number; delivered: number }
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

  function setCarrier(v: string) {
    pushParams((next) => {
      if (!v) next.delete('carrier')
      else next.set('carrier', v)
    })
  }

  function setStatus(v: string) {
    pushParams((next) => {
      if (!v) next.delete('status')
      else next.set('status', v)
    })
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
      <TopBar title="Envios — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Envios</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Envios" value={stats.total} icon="local_shipping" />
          <StatCard label="Aguardando" value={stats.pending} icon="schedule" tone="yellow" />
          <StatCard label="Em Trânsito" value={stats.transit} icon="route" tone="blue" />
          <StatCard label="Entregues" value={stats.delivered} icon="check_circle" tone="green" />
        </div>

        <div className="mb-lg flex flex-wrap items-center gap-3">
          <div className="relative w-[300px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40"
              placeholder="Buscar order, waybill, package ou produto..."
            />
          </div>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
          >
            <option value="">Todas transportadoras</option>
            {carriers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
          >
            <option value="">Todos status</option>
            <option value="pending">Aguardando</option>
            <option value="transit">Em trânsito</option>
            <option value="delivered">Entregues</option>
          </select>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Produto / Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Transportadora</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Waybill</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Última atualização</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum envio encontrado.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => {
                  const badge = nodeBadge(s.last_node, s.last_node_name)
                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/shein/envios/${encodeURIComponent(s.waybill_no)}`)}
                      className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <p className="line-clamp-1 max-w-[320px] text-sm font-medium text-white">
                          {s.product_name || '—'}
                          {(s.item_count ?? 0) > 1 && <span className="ml-1 text-xs text-zinc-500">+{(s.item_count ?? 1) - 1}</span>}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">{s.order_no}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">{s.carrier || <span className="text-zinc-500">—</span>}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{s.waybill_no}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRel(s.last_update_at)}</td>
                    </tr>
                  )
                })
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
