'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { mapOrderStatus, statusToneClass } from '@/lib/shein-status'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'custom'

export type OrderItem = {
  quantity?: number | null
  commission?: number | string | null
  service_charge?: number | string | null
  estimated_income?: number | string | null
  seller_price?: number | string | null
  product_name?: string | null
}

export type OrderRow = {
  id: string
  order_no: string
  store_code: string | null
  order_status: string | null
  payment_status: string | null
  shipping_status: string | null
  total_amount: number | string | null
  currency: string | null
  buyer_name: string | null
  buyer_email: string | null
  order_time: string | null
  payment_time: string | null
  raw: { estimatedGrossIncome?: string | number | null } | null
  shein_order_items: OrderItem[]
}

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

const toneClasses: Record<Tone, string> = {
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  blue:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red:    'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:   'bg-outline/20 text-zinc-500 border border-outline/30',
}

function statusTone(s: string | null): Tone {
  if (!s) return 'gray'
  const v = s.toLowerCase()
  if (v.includes('cancel') || v.includes('refund') || v.includes('reject')) return 'red'
  if (v.includes('paid') || v.includes('delivered') || v.includes('complete') || v.includes('success')) return 'green'
  if (v.includes('ship') || v.includes('transit') || v.includes('process')) return 'blue'
  if (v.includes('pend') || v.includes('wait') || v.includes('hold')) return 'yellow'
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
  payment,
  shipping,
  search,
  statuses,
}: {
  orders: OrderRow[]
  totalCount: number
  periodTotals: { gmv: number; fees: number; estimated: number }
  page: number
  period: Period
  customFrom: string | null
  customTo: string | null
  status: string
  payment: string
  shipping: string
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
      <TopBar title="Pedidos — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[280px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar order_no, comprador..."
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
                  <option key={s} value={s}>{mapOrderStatus(s).label}</option>
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
                  {p === '7d' ? '7d' : p === '30d' ? '30d' : '90d'}
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
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">GMV período</p>
              <p className="text-sm font-semibold text-white">{fmtBrl(periodTotals.gmv)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Taxas Shein</p>
              <p className="text-sm font-semibold text-error">{fmtBrl(periodTotals.fees)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Líquido est.</p>
              <p className="text-sm font-semibold text-secondary">{fmtBrl(periodTotals.estimated)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Pedidos</p>
              <p className="text-sm font-semibold text-white">{totalCount.toLocaleString('pt-BR')}</p>
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
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Taxas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido est.</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Quando</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum pedido encontrado. Aguarde sincronização (Reconciliar a cada 30min).
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const items = o.shein_order_items ?? []
                  let fees = 0
                  for (const it of items) {
                    fees += Number(it.commission ?? 0) + Number(it.service_charge ?? 0)
                  }
                  // Líquido = raw estimatedGrossIncome order-level (Shein zera em reembolso), igual card Repasse.
                  const estimated = Number(o.raw?.estimatedGrossIncome ?? 0)
                  const firstProduct = items[0]?.product_name?.trim() || '—'
                  const extraCount = items.length > 1 ? ` +${items.length - 1}` : ''
                  return (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/shein/pedidos/${encodeURIComponent(o.order_no)}`)}
                      className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <p className="line-clamp-2 max-w-[340px] text-sm font-medium text-white">
                          {firstProduct}
                          {extraCount && <span className="ml-1 text-xs text-zinc-500">{extraCount}</span>}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">{o.order_no}</p>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const m = mapOrderStatus(o.order_status)
                          return (
                            <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', statusToneClass(m.tone))}>
                              {m.label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">{items.length}</td>
                      <td className="px-6 py-4 text-right font-medium text-white">{fmtBrl(o.total_amount, o.currency ?? 'BRL')}</td>
                      <td className="px-6 py-4 text-right text-error">{fmtBrl(fees, o.currency ?? 'BRL')}</td>
                      <td className="px-6 py-4 text-right font-medium text-secondary">{fmtBrl(estimated, o.currency ?? 'BRL')}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRelDate(o.order_time)}</td>
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
