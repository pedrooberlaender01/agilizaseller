'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d'

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
  shein_order_items: { count: number }[]
}

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

const toneClasses: Record<Tone, string> = {
  yellow: 'bg-tertiary/15 text-tertiary border border-tertiary/30',
  blue:   'bg-primary/15 text-primary border border-primary/30',
  green:  'bg-secondary/15 text-secondary border border-secondary/30',
  red:    'bg-error/15 text-error border border-error/30',
  gray:   'bg-outline/20 text-outline border border-outline/30',
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
  page,
  period,
  status,
  payment,
  shipping,
  search,
  statuses,
}: {
  orders: OrderRow[]
  totalCount: number
  page: number
  period: Period
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
    pushParams((next) => next.set('period', p))
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
        if (o.order_status?.toLowerCase().includes('cancel')) acc.cancel++
        else acc.valid++
        return acc
      },
      { gmv: 0, valid: 0, cancel: 0 },
    )
  }, [orders])

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
                className="w-full rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar order_no, comprador..."
              />
            </div>
            {statuses.length > 0 && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-tertiary"
              >
                <option value="">Todos status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
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
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">GMV período</p>
              <p className="text-sm font-semibold text-white">{fmtBrl(totals.gmv)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Pedidos</p>
              <p className="text-sm font-semibold text-white">{totalCount.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pagamento</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Envio</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Itens</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Quando</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-outline">
                    Nenhum pedido encontrado. Aguarde sincronização (Reconciliar a cada 30min).
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const items = o.shein_order_items?.[0]?.count ?? 0
                  return (
                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs text-white">{o.order_no}</p>
                        {o.store_code && <p className="mt-1 font-mono text-[10px] text-outline">{o.store_code}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-200">{o.buyer_name || '—'}</p>
                        {o.buyer_email && <p className="mt-1 text-[11px] text-outline">{o.buyer_email}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(o.order_status)])}>
                          {o.order_status || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(o.payment_status)])}>
                          {o.payment_status || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(o.shipping_status)])}>
                          {o.shipping_status || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-slate-400">{items}</td>
                      <td className="px-6 py-4 text-right font-medium text-white">{fmtBrl(o.total_amount, o.currency ?? 'BRL')}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRelDate(o.order_time)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            <span className="text-sm text-slate-400">
              {totalCount === 0
                ? '0 resultados'
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-300">Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
