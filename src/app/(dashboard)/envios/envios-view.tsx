'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/icon'
import { MarketplaceLogo } from '@/components/marketplace-logo'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | 'all' | 'custom'
type StatusClass = 'in_transit' | 'delivered' | 'problem' | 'pending'

export type UnifiedShipment = {
  id: string
  marketplace: 'shopee'
  order_id: string | null
  external_id: string | null
  tracking_number: string | null
  status_code: string | null
  status_class: StatusClass
  buyer_name: string | null
  total_amount: number | string | null
  currency: string | null
  ship_date: string | null
  shipping_carrier: string | null
  receiver_city: string | null
  receiver_state: string | null
  delivered_at: string | null
}

const MARKETPLACES: { id: UnifiedShipment['marketplace']; label: string }[] = [
  { id: 'shopee', label: 'Shopee' },
]

const STATUS_FILTERS: { id: string; label: string; icon: string; tone: string }[] = [
  { id: '',           label: 'Todos',       icon: 'list',           tone: 'text-zinc-50' },
  { id: 'in_transit', label: 'Em trânsito', icon: 'local_shipping', tone: 'text-blue-300' },
  { id: 'delivered',  label: 'Entregues',   icon: 'check_circle',   tone: 'text-emerald-300' },
  { id: 'pending',    label: 'Pendentes',   icon: 'schedule',       tone: 'text-amber-300' },
  { id: 'problem',    label: 'Problemas',   icon: 'error',          tone: 'text-rose-300' },
]

const SHOPEE_LABEL: Record<string, string> = {
  LOGISTICS_PICKUP_DONE: 'Em trânsito',
  LOGISTICS_DELIVERY_PENDING: 'Saiu p/ entrega',
  LOGISTICS_DELIVERY_DONE: 'Entregue',
  LOGISTICS_FAILED: 'Falha',
  LOGISTICS_PICKUP_RETRY: 'Retentando coleta',
  LOGISTICS_PICKUP_FAILED: 'Falha na coleta',
  LOGISTICS_DELIVERY_FAILED: 'Falha na entrega',
  LOGISTICS_RTS: 'Retornando',
  LOGISTICS_RETURNING: 'Em devolução',
  LOGISTICS_RETURNED: 'Devolvido',
  LOGISTICS_INVOICE_PENDING: 'NF pendente',
  LOGISTICS_READY: 'Pronto p/ retirada',
  LOGISTICS_REQUEST_CREATED: 'Coleta solicitada',
  LOGISTICS_PICKUP_REQUESTED: 'Coleta agendada',
}

function prettyStatus(s: UnifiedShipment): string {
  if (s.status_code && SHOPEE_LABEL[s.status_code]) return SHOPEE_LABEL[s.status_code]
  return s.status_code ?? '—'
}

function statusBadgeClass(cls: StatusClass): string {
  switch (cls) {
    case 'delivered':  return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
    case 'in_transit': return 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    case 'problem':    return 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
    case 'pending':    return 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
  }
}

const fmtCurrency = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : currency === 'BRL' ? 'R$' : `${currency} `
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

function fmtRelDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `Hoje, ${time}`
  if (isYesterday) return `Ontem, ${time}`
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
  shipments,
  totalCount,
  page,
  period,
  from,
  to,
  selectedMarketplaces,
  marketplaceCounts,
  status,
  search,
}: {
  shipments: UnifiedShipment[]
  totalCount: number
  page: number
  period: Period
  from: string | null
  to: string | null
  selectedMarketplaces: string[]
  marketplaceCounts: Record<string, number>
  status: string
  search: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [mktOpen, setMktOpen] = useState(false)
  const mktRef = useRef<HTMLDivElement>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  useEffect(() => {
    if (!mktOpen) return
    function onDoc(e: MouseEvent) {
      if (mktRef.current && !mktRef.current.contains(e.target as Node)) setMktOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [mktOpen])

  useEffect(() => {
    if (!statusOpen) return
    function onDoc(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [statusOpen])

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

  function toggleMarketplace(id: UnifiedShipment['marketplace']) {
    const cur = new Set(selectedMarketplaces)
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    pushParams((next) => {
      if (cur.size === 0) next.delete('mkt')
      else next.set('mkt', Array.from(cur).join(','))
    })
  }

  function clearMarketplaces() {
    pushParams((next) => next.delete('mkt'))
  }

  function setStatus(s: string) {
    pushParams((next) => {
      if (!s) next.delete('status')
      else next.set('status', s)
    })
  }

  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      if (p !== 'custom') {
        next.delete('from')
        next.delete('to')
      }
    })
  }

  function applyCustomRange(fromIsoVal: string, toIsoVal: string) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', 'custom')
    next.set('from', fromIsoVal)
    next.set('to', toIsoVal)
    next.delete('page')
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const totals = useMemo(() => {
    return shipments.reduce(
      (acc, s) => {
        acc.gmv += Number(s.total_amount ?? 0)
        return acc
      },
      { gmv: 0 },
    )
  }, [shipments])

  const noFilter = selectedMarketplaces.length === 0
  const totalAll = Object.values(marketplaceCounts).reduce((s, n) => s + n, 0)

  return (
    <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
      <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2 font-semibold text-zinc-50">Envios consolidados</h2>
          <p className="mt-1 text-xs text-zinc-400">Todos os marketplaces em uma única visão.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(69,223,164,0.6)]" />
          <span className="text-xs font-medium text-zinc-50">Dados em tempo real</span>
        </div>
      </div>

      <div className="mb-md flex items-center gap-2">
        <button
          onClick={clearMarketplaces}
          className={cn(
            'flex h-[34px] shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
            noFilter
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-50 hover:border-zinc-700 hover:text-zinc-50',
          )}
        >
          <span className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md',
            noFilter ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-800 text-zinc-400',
          )}>
            <Icon name="apps" size={12} />
          </span>
          Todos
          <span className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[10px]',
            noFilter ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-400',
          )}>
            {fmtInt(totalAll)}
          </span>
        </button>

        <div ref={mktRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMktOpen((v) => !v)}
            className={cn(
              'flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
              selectedMarketplaces.length > 0
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-50 hover:border-zinc-700 hover:text-zinc-50',
            )}
          >
            <Icon name="filter_list" size={14} />
            Filtrar
            {selectedMarketplaces.length > 0 && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
                {selectedMarketplaces.length}
              </span>
            )}
            <Icon name={mktOpen ? 'expand_less' : 'expand_more'} size={14} className="text-zinc-500" />
          </button>

          {mktOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 w-[260px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60">
              <div className="border-b border-zinc-800 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Marketplaces</p>
              </div>
              <div className="flex flex-col p-1">
                {MARKETPLACES.map((m) => {
                  const active = selectedMarketplaces.includes(m.id)
                  const count = marketplaceCounts[m.id] ?? 0
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMarketplace(m.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                        active ? 'bg-blue-500/10 text-blue-300' : 'text-zinc-50 hover:bg-zinc-800/60',
                      )}
                    >
                      <span className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border',
                        active ? 'border-blue-500/40 bg-blue-500/20' : 'border-zinc-700',
                      )}>
                        {active && <Icon name="check" size={12} className="text-blue-300" />}
                      </span>
                      <MarketplaceLogo name={m.id} size={20} />
                      <span className="flex-1 text-left">{m.label}</span>
                      <span className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[10px]',
                        active ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-400',
                      )}>
                        {fmtInt(count)}
                      </span>
                    </button>
                  )
                })}
              </div>
              {selectedMarketplaces.length > 0 && (
                <div className="border-t border-zinc-800 p-2">
                  <button
                    onClick={() => { clearMarketplaces(); setMktOpen(false) }}
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-50"
                  >
                    Limpar seleção
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-md flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-10 pr-4 text-sm text-zinc-50 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Buscar rastreio, código ou comprador..."
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div ref={statusRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setStatusOpen((v) => !v)}
                className={cn(
                  'flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap',
                  status
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-50 hover:border-zinc-700 hover:text-zinc-50',
                )}
              >
                <Icon
                  name={STATUS_FILTERS.find((s) => s.id === status)?.icon ?? 'filter_list'}
                  size={14}
                  className={STATUS_FILTERS.find((s) => s.id === status)?.tone ?? 'text-zinc-400'}
                />
                {STATUS_FILTERS.find((s) => s.id === status)?.label ?? 'Status'}
                <Icon name={statusOpen ? 'expand_less' : 'expand_more'} size={14} className="text-zinc-500" />
              </button>

              {statusOpen && (
                <div className="absolute left-0 top-full z-40 mt-2 w-[220px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60">
                  <div className="border-b border-zinc-800 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Status</p>
                  </div>
                  <div className="flex flex-col p-1">
                    {STATUS_FILTERS.map((s) => {
                      const active = status === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setStatus(s.id); setStatusOpen(false) }}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                            active ? 'bg-blue-500/10 text-blue-300' : 'text-zinc-50 hover:bg-zinc-800/60',
                          )}
                        >
                          <Icon name={s.icon} size={14} className={active ? 'text-blue-300' : s.tone} />
                          <span className="flex-1 text-left">{s.label}</span>
                          {active && <Icon name="check" size={12} className="text-blue-300" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div ref={popoverRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap',
                  'border-blue-500/30 bg-blue-500/10 text-blue-300',
                )}
              >
                <Icon name="event" size={14} />
                <span className={cn(period === 'custom' && 'font-mono tracking-tight')}>
                  {period === 'custom' && from && to
                    ? `${fmtDateBRShort(from)} – ${fmtDateBRShort(to)}`
                    : period === '7d' ? '7 dias'
                    : period === '30d' ? '30 dias'
                    : 'Tudo'}
                </span>
                <Icon name={popoverOpen ? 'expand_less' : 'expand_more'} size={14} className="text-blue-300" />
              </button>
              {popoverOpen && !customOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-[240px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60 sm:left-0 sm:right-auto">
                  <div className="border-b border-zinc-800 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Período</p>
                  </div>
                  <div className="flex flex-col p-1">
                    {(['all', '7d', '30d'] as Period[]).map((p) => {
                      const active = period === p
                      const label = p === 'all' ? 'Tudo' : p === '7d' ? '7 dias' : '30 dias'
                      return (
                        <button
                          key={p}
                          onClick={() => { setPeriod(p); setPopoverOpen(false) }}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                            active ? 'bg-blue-500/10 text-blue-300' : 'text-zinc-50 hover:bg-zinc-800/60',
                          )}
                        >
                          <Icon name="schedule" size={14} className={active ? 'text-blue-300' : 'text-zinc-400'} />
                          <span className="flex-1 text-left">{label}</span>
                          {active && <Icon name="check" size={12} className="text-blue-300" />}
                        </button>
                      )
                    })}
                    <div className="my-1 h-px bg-zinc-800" />
                    <button
                      onClick={() => { setCustomOpen(true); setPopoverOpen(false) }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                        period === 'custom' ? 'bg-blue-500/10 text-blue-300' : 'text-zinc-50 hover:bg-zinc-800/60',
                      )}
                    >
                      <Icon name="event" size={14} className={period === 'custom' ? 'text-blue-300' : 'text-zinc-400'} />
                      <span className="flex-1 text-left">
                        {period === 'custom' && from && to ? `${fmtDateBRShort(from)} – ${fmtDateBRShort(to)}` : 'Personalizar'}
                      </span>
                      {period === 'custom' && <Icon name="check" size={12} className="text-blue-300" />}
                    </button>
                  </div>
                </div>
              )}
              {customOpen && (
                <DateRangePopover
                  from={from}
                  to={to}
                  onApply={(f, t) => { applyCustomRange(f, t); setCustomOpen(false) }}
                  onClose={() => setCustomOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 sm:text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">GMV nesta página</p>
            <p className="text-sm font-semibold text-zinc-50 tabular-nums">{fmtCurrency(totals.gmv)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Envios</p>
            <p className="text-sm font-semibold text-zinc-50 tabular-nums">{fmtInt(totalCount)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Marketplace</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Pedido</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Transportadora</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Comprador</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Destino</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Status</th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Total</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Data</th>
            </tr>
          </thead>
          <tbody className="text-sm text-zinc-50">
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-zinc-500">
                  Nenhum envio encontrado.
                </td>
              </tr>
            ) : (
              shipments.map((s) => {
                const destino = [s.receiver_city, s.receiver_state].filter(Boolean).join(' / ') || '—'
                return (
                  <tr key={`${s.marketplace}-${s.id}`} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MarketplaceLogo name={s.marketplace} size={20} />
                        <span className="text-xs font-medium capitalize text-zinc-50">{s.marketplace}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-50">{s.external_id ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">{s.shipping_carrier ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-zinc-50">{s.buyer_name ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-zinc-400">{destino}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium', statusBadgeClass(s.status_class))}>
                        {prettyStatus(s)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xs tabular-nums text-zinc-50">
                      {fmtCurrency(s.total_amount, s.currency ?? 'BRL')}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">{fmtRelDate(s.delivered_at ?? s.ship_date)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-md flex items-center justify-between gap-3 text-xs text-zinc-400">
          <p>
            Página <span className="text-zinc-50">{page}</span> de <span className="text-zinc-50">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="chevron_left" size={16} />
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="chevron_right" size={16} />
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
