'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/icon'
import { MarketplaceLogo, marketplaceLabel } from '@/components/marketplace-logo'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import { OrderDrawer } from './order-drawer'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | 'all' | 'custom'

export type UnifiedOrder = {
  marketplace: 'magazord' | 'mercado_livre' | 'shopee' | 'shein'
  order_id: string
  connection_id: string
  external_id: string | null
  status_code: string | null
  status_text: string | null
  status_class: 'paid' | 'cancelled' | 'pending' | 'other' | null
  total_amount: number | string | null
  currency: string | null
  buyer_name: string | null
  source_marketplace: string | null
  order_date: string | null
  uf: string | null
  cidade: string | null
  payment_method: string | null
}

const MARKETPLACES: { id: UnifiedOrder['marketplace']; label: string }[] = [
  { id: 'magazord',      label: 'Magazord' },
  { id: 'mercado_livre', label: 'Mercado Livre' },
  { id: 'shopee',        label: 'Shopee' },
  { id: 'shein',         label: 'Shein' },
]

const STATUS_FILTERS: { id: string; label: string; icon: string; tone: string }[] = [
  { id: '',          label: 'Todos',      icon: 'list',         tone: 'text-zinc-50' },
  { id: 'paid',      label: 'Aprovados',  icon: 'check_circle', tone: 'text-secondary' },
  { id: 'pending',   label: 'Pendentes',  icon: 'schedule',     tone: 'text-tertiary' },
  { id: 'cancelled', label: 'Cancelados', icon: 'cancel',       tone: 'text-error' },
]

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

const magSituacaoLabel: Record<string, string> = {
  '1':  'Aguardando Pagto.',
  '2':  'Cancelado Pagto.',
  '3':  'Em Análise Pagto.',
  '4':  'Aprovado',
  '5':  'Aprovado e Integrado',
  '6':  'NF Emitida',
  '7':  'Transporte',
  '8':  'Entregue',
  '9':  'Fraude',
  '14': 'Cancelado Análise',
  '21': 'Devolvido Estoque',
  '23': 'Faturamento Iniciado',
  '26': 'NF Cancelada',
}

function prettyStatus(o: UnifiedOrder): string {
  if (o.marketplace === 'magazord' && o.status_code && magSituacaoLabel[o.status_code]) {
    return magSituacaoLabel[o.status_code]
  }
  return o.status_text ?? o.status_code ?? '—'
}

function statusBadgeClass(cls: UnifiedOrder['status_class']): string {
  switch (cls) {
    case 'paid':      return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
    case 'cancelled': return 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
    case 'pending':   return 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
    default:          return 'bg-outline/15 text-outline border border-outline/20'
  }
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function PedidosView({
  orders,
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
  orders: UnifiedOrder[]
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
  const popoverRef = useRef<HTMLDivElement>(null)
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null)

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

  function toggleMarketplace(id: UnifiedOrder['marketplace']) {
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
    setPopoverOpen(false)
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
    return orders.reduce(
      (acc, o) => {
        acc.gmv += Number(o.total_amount ?? 0)
        if (o.status_class === 'cancelled') acc.cancel++
        else if (o.status_class === 'paid') acc.paid++
        return acc
      },
      { gmv: 0, paid: 0, cancel: 0 },
    )
  }, [orders])

  const noFilter = selectedMarketplaces.length === 0
  const totalAll = Object.values(marketplaceCounts).reduce((s, n) => s + n, 0)

  return (
    <>
    <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
      <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2 font-semibold text-zinc-50">Pedidos consolidados</h2>
          <p className="mt-1 text-xs text-zinc-400">Todos os marketplaces em uma única visão.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-surface-container/60 px-3 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(69,223,164,0.6)]" />
          <span className="text-xs font-medium text-zinc-50">Dados em tempo real</span>
        </div>
      </div>

      <div className="mb-lg flex flex-wrap items-center gap-2">
        <button
          onClick={clearMarketplaces}
          className={cn(
            'flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
            noFilter
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-50 hover:border-zinc-700 hover:text-zinc-50',
          )}
        >
          <span className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md',
            noFilter ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-900/60/5 text-outline',
          )}>
            <Icon name="apps" size={12} />
          </span>
          Todos
          <span className={cn(
            'rounded px-1.5 py-0.5 font-mono text-[10px]',
            noFilter ? 'bg-primary/20 text-primary' : 'bg-zinc-900/60/5 text-outline',
          )}>
            {fmtInt(totalAll)}
          </span>
        </button>

        {MARKETPLACES.map((m) => {
          const active = selectedMarketplaces.includes(m.id)
          const count = marketplaceCounts[m.id] ?? 0
          return (
            <button
              key={m.id}
              onClick={() => toggleMarketplace(m.id)}
              className={cn(
                'flex h-[34px] items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                active
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-50 hover:border-zinc-700 hover:text-zinc-50',
                count === 0 && 'opacity-50',
              )}
            >
              <MarketplaceLogo name={m.id} size={20} />
              {m.label}
              <span className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px]',
                active ? 'bg-primary/20 text-primary' : 'bg-zinc-900/60/5 text-outline',
              )}>
                {fmtInt(count)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mb-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[280px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-10 pr-4 text-sm text-zinc-50 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Buscar código ou comprador..."
            />
          </div>

          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  status === s.id ? 'bg-zinc-50 text-zinc-900' : 'text-zinc-400 hover:text-zinc-50',
                )}
              >
                <Icon name={s.icon} size={12} className={status === s.id ? s.tone : ''} />
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
            {(['7d', '30d', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  period === p ? 'bg-zinc-50 text-zinc-900' : 'text-zinc-400 hover:text-zinc-50',
                )}
              >
                {p === 'all' ? 'Tudo' : p === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>

          <div ref={popoverRef} className="relative">
            <button
              type="button"
              onClick={() => setPopoverOpen((v) => !v)}
              className={cn(
                'flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
                period === 'custom'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-50',
              )}
            >
              <Icon name="event" size={14} />
              <span className={cn(period === 'custom' && 'font-mono tracking-tight')}>
                {period === 'custom' && from && to
                  ? `${fmtDateBRShort(from)} – ${fmtDateBRShort(to)}`
                  : 'Personalizar'}
              </span>
              <Icon name={popoverOpen ? 'expand_less' : 'expand_more'} size={14} className="text-outline" />
            </button>
            {popoverOpen && (
              <DateRangePopover
                from={from}
                to={to}
                onApply={applyCustomRange}
                onClose={() => setPopoverOpen(false)}
              />
            )}
          </div>
        </div>

        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">GMV nesta página</p>
            <p className="text-sm font-semibold text-zinc-50">{fmtCurrency(totals.gmv)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">Pedidos</p>
            <p className="text-sm font-semibold text-zinc-50">{fmtInt(totalCount)}</p>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Marketplace</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Código</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Comprador</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Situação</th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Total</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">UF</th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Data</th>
            </tr>
          </thead>
          <tbody className="text-sm text-zinc-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-outline">
                  Nenhum pedido encontrado.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={`${o.marketplace}-${o.order_id}`}
                  onClick={() => setSelectedOrder(o)}
                  className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/60"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <MarketplaceLogo name={o.marketplace} size={28} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-50">{marketplaceLabel(o.marketplace)}</p>
                        {o.source_marketplace && (
                          <p className="mt-0.5 text-[10px] text-outline">via {o.source_marketplace}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-50">{o.external_id ?? '—'}</td>
                  <td className="px-6 py-4 text-xs">{o.buyer_name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', statusBadgeClass(o.status_class))}>
                      {prettyStatus(o)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-zinc-50">{fmtCurrency(o.total_amount, o.currency ?? 'BRL')}</td>
                  <td className="px-6 py-4 font-mono text-[10px] text-zinc-400">{o.uf ?? '—'}</td>
                  <td className="px-6 py-4 text-xs text-zinc-400">{fmtRelDate(o.order_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <span className="text-sm text-zinc-400">
            {totalCount === 0
              ? '0 resultados'
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${fmtInt(totalCount)}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900/60 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-2 text-xs text-zinc-50">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900/60 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </main>
    {selectedOrder && (
      <OrderDrawer orderRow={selectedOrder} onClose={() => setSelectedOrder(null)} />
    )}
    </>
  )
}
