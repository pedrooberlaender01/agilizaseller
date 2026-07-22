'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { KpiCard, fmtBrl as fmtBrlUi, fmtNum, fmtPct } from '../_ui'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'custom'

export type OrderItem = {
  quantity?: number | null
  unit_price?: number | string | null
  product_name?: string | null
}

export type OrderRow = {
  id: string
  order_id: string
  order_status: string | null
  total_amount: number | string | null
  currency: string | null
  buyer_name: string | null
  create_time: string | null
  tt_order_items: OrderItem[]
}

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

const toneClasses: Record<Tone, string> = {
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  blue:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red:    'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:   'bg-outline/20 text-zinc-500 border border-outline/30',
}

// Nomes crus da API TikTok. Tom apenas colore, nao traduz.
function statusTone(s: string | null): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v.includes('CANCEL') || v.includes('REFUND') || v.includes('REJECT')) return 'red'
  if (v === 'DELIVERED' || v === 'COMPLETED') return 'green'
  if (v.includes('SHIP') || v.includes('TRANSIT') || v.includes('COLLECTION')) return 'blue'
  if (v === 'UNPAID' || v === 'ON_HOLD' || v.includes('AWAITING')) return 'yellow'
  return 'gray'
}

const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

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

export function PedidosView({
  orders,
  totalCount,
  periodTotals,
  page,
  period,
  customFrom,
  customTo,
  status,
  search,
  statuses,
}: {
  orders: OrderRow[]
  totalCount: number
  periodTotals: { gmv: number; count: number; ticket: number; cancelled: number }
  page: number
  period: Period
  customFrom: string | null
  customTo: string | null
  status: string
  search: string
  statuses: string[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

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

  function setStatus(s: string) {
    pushParams((next) => {
      if (s) next.set('status', s)
      else next.delete('status')
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

  function applyCustomRange(f: string, t: string) {
    pushParams((next) => {
      next.set('period', 'custom')
      next.set('from', f)
      next.set('to', t)
    })
    setShowDatePicker(false)
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
      <TopBar title="Pedidos — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        {/* KPIs do período */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Pedidos" value={fmtNum(periodTotals.count)} icon="shopping_cart" />
          <KpiCard label="Faturamento" value={fmtBrlUi(periodTotals.gmv)} icon="payments" tone="green" />
          <KpiCard label="Repasse Real" value="—" soon />
          <KpiCard label="Ticket Médio" value={fmtBrlUi(periodTotals.ticket)} icon="receipt_long" />
          <KpiCard label="Escrow Sync" value="—" soon />
          <KpiCard
            label="Cancelados"
            value={fmtPct(periodTotals.count + periodTotals.cancelled > 0 ? (periodTotals.cancelled / (periodTotals.count + periodTotals.cancelled)) * 100 : 0)}
            icon="remove_shopping_cart"
            tone="red"
          />
        </div>

        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[280px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar order_id, comprador..."
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
            <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
              {(['7d', '30d', '90d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setShowDatePicker((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#050507] px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'custom' ? 'border-zinc-50/40 text-white' : 'text-slate-400 hover:text-white',
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
                  align="left"
                />
              )}
            </div>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Itens</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Quando</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum pedido encontrado. Aguarde sincronização (Reconciliar a cada 30min).
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const items = o.tt_order_items ?? []
                  const firstProduct = items[0]?.product_name?.trim() || '—'
                  const extraCount = items.length > 1 ? ` +${items.length - 1}` : ''
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <p className="line-clamp-2 max-w-[340px] text-sm font-medium text-white">
                          {firstProduct}
                          {extraCount && <span className="ml-1 text-xs text-zinc-500">{extraCount}</span>}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">{o.order_id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(o.order_status)])}>
                          {o.order_status ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">{items.length}</td>
                      <td className="px-6 py-4 text-right font-medium text-white">{fmtBrl(o.total_amount, o.currency ?? 'BRL')}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{o.buyer_name ?? '—'}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRelDate(o.create_time)}</td>
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
