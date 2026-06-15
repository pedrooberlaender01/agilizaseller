'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { getShipmentHistory } from '@/app/actions/shopee'
import type { ShopeeShipment, ShopeeShipmentHistory } from '@/types'

const PAGE_SIZE = 50

export type Category = 'in_transit' | 'delivered' | 'problem' | 'pending'
export type Period = '7d' | '30d' | '90d'

export type ShipmentRow = ShopeeShipment & {
  shopee_orders: {
    buyer_username: string | null
    date_created: string
    total_amount: number
  } | null
}

export const STATUS_CATEGORY: Record<string, Category> = {
  LOGISTICS_PICKUP_DONE: 'in_transit',
  LOGISTICS_DELIVERY_PENDING: 'in_transit',
  LOGISTICS_DELIVERY_DONE: 'delivered',
  LOGISTICS_FAILED: 'problem',
  LOGISTICS_PICKUP_RETRY: 'problem',
  LOGISTICS_PICKUP_FAILED: 'problem',
  LOGISTICS_DELIVERY_FAILED: 'problem',
  LOGISTICS_RTS: 'problem',
  LOGISTICS_RETURNING: 'problem',
  LOGISTICS_RETURNED: 'problem',
  LOGISTICS_INVOICE_PENDING: 'pending',
  LOGISTICS_READY: 'pending',
  LOGISTICS_REQUEST_CREATED: 'pending',
  LOGISTICS_PICKUP_REQUESTED: 'pending',
}

export function categoryOf(status: string | null): Category {
  if (!status) return 'pending'
  return STATUS_CATEGORY[status] ?? 'pending'
}

const statusMeta: Record<string, { label: string; cls: string; tone: 'blue' | 'green' | 'red' | 'yellow' }> = {
  LOGISTICS_PICKUP_DONE:      { label: 'Em trânsito',         cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',        tone: 'blue' },
  LOGISTICS_DELIVERY_PENDING: { label: 'Saiu p/ entrega',     cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',        tone: 'blue' },
  LOGISTICS_DELIVERY_DONE:    { label: 'Entregue',            cls: 'bg-secondary/10 text-secondary border border-secondary/20',  tone: 'green' },
  LOGISTICS_FAILED:           { label: 'Falha',               cls: 'bg-error/20 text-error border border-error/30',              tone: 'red' },
  LOGISTICS_PICKUP_FAILED:    { label: 'Falha na coleta',     cls: 'bg-error/20 text-error border border-error/30',              tone: 'red' },
  LOGISTICS_PICKUP_RETRY:     { label: 'Retentando coleta',   cls: 'bg-error/15 text-error border border-error/25',              tone: 'red' },
  LOGISTICS_DELIVERY_FAILED:  { label: 'Falha na entrega',    cls: 'bg-error/20 text-error border border-error/30',              tone: 'red' },
  LOGISTICS_RTS:              { label: 'Retornando',          cls: 'bg-error/15 text-error border border-error/25',              tone: 'red' },
  LOGISTICS_RETURNING:        { label: 'Em devolução',        cls: 'bg-error/15 text-error border border-error/25',              tone: 'red' },
  LOGISTICS_RETURNED:         { label: 'Devolvido',           cls: 'bg-error/15 text-error border border-error/25',              tone: 'red' },
  LOGISTICS_REQUEST_CREATED:  { label: 'Coleta solicitada',   cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/20',     tone: 'yellow' },
  LOGISTICS_PICKUP_REQUESTED: { label: 'Coleta agendada',     cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/20',     tone: 'yellow' },
  LOGISTICS_READY:            { label: 'Pronto p/ retirada',  cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/20',     tone: 'yellow' },
  LOGISTICS_INVOICE_PENDING:  { label: 'NF pendente',         cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',     tone: 'yellow' },
}

function statusLabel(status: string | null): string {
  if (!status) return '—'
  return statusMeta[status]?.label ?? status
}

function statusClass(status: string | null): string {
  if (!status) return 'bg-outline/15 text-zinc-500 border border-outline/25'
  return statusMeta[status]?.cls ?? 'bg-outline/15 text-zinc-500 border border-outline/25'
}

const fmtBrl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtRelative = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `há ${diffD}d`
  return fmtDate(iso)
}

const categoryColor: Record<Category, { text: string; ring: string; bg: string; border: string }> = {
  in_transit: { text: 'text-blue-400',   ring: 'ring-primary/40',   bg: 'bg-blue-500/10',   border: 'border-blue-500/50' },
  delivered:  { text: 'text-secondary', ring: 'ring-secondary/40', bg: 'bg-secondary/10', border: 'border-secondary/50' },
  problem:    { text: 'text-error',     ring: 'ring-error/40',     bg: 'bg-error/10',     border: 'border-error/50' },
  pending:    { text: 'text-zinc-50',  ring: 'ring-tertiary/40',  bg: 'bg-zinc-800/60',  border: 'border-zinc-50/50' },
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function SummaryCard({
  label,
  value,
  icon,
  category,
  active,
  onClick,
}: {
  label: string
  value: number
  icon: string
  category: Category
  active: boolean
  onClick: () => void
}) {
  const c = categoryColor[category]
  return (
    <button
      onClick={onClick}
      className={cn(
        'border border-zinc-800 bg-zinc-900/40 flex flex-col gap-sm rounded-xl p-lg text-left transition-all active:scale-[0.98]',
        active ? `${c.border} ${c.bg} ring-1 ${c.ring}` : 'hover:bg-white/5',
      )}
    >
      <div className={cn('flex items-center gap-1', c.text)}>
        <Icon name={icon} size={20} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-[36px] font-bold leading-none text-on-background">{value}</span>
    </button>
  )
}

function ShipmentDrawer({ shipment, onClose }: { shipment: ShipmentRow; onClose: () => void }) {
  const [history, setHistory] = useState<ShopeeShipmentHistory[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setHistory(null)
    getShipmentHistory(shipment.id).then((rows) => {
      if (!cancelled) {
        setHistory(rows)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shipment.id])

  function copyTracking() {
    if (!shipment.tracking_number) return
    navigator.clipboard?.writeText(shipment.tracking_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const destination = [shipment.receiver_city, shipment.receiver_state].filter(Boolean).join(', ') || '—'
  const buyer = shipment.shopee_orders?.buyer_username ?? null
  const orderDate = shipment.shopee_orders?.date_created
  const orderTotal = shipment.shopee_orders?.total_amount

  return (
    <aside className="absolute bottom-margin right-margin top-margin z-20 flex h-[calc(100vh-56px-80px)] w-[380px] flex-col overflow-hidden rounded-xl border-l border-zinc-800 bg-[#0d1117]/85 backdrop-blur-[20px]">
      <div className="flex items-start justify-between border-b border-zinc-800 p-lg">
        <div className="min-w-0 pr-2">
          <h3 className="text-base font-semibold text-on-background">Detalhes do Envio</h3>
          <p className="mt-1 truncate font-mono text-xs text-zinc-500">#{shipment.order_sn}</p>
        </div>
        <button
          type="button"
          aria-label="Fechar detalhes"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-xl overflow-y-auto p-lg">
        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium uppercase text-zinc-400">Código de Rastreio</span>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#050507] p-sm">
            {shipment.tracking_number ? (
              <span className="font-mono text-base tracking-widest text-zinc-50">
                {shipment.tracking_number}
              </span>
            ) : (
              <span className="text-sm text-zinc-500">Tracking não disponível</span>
            )}
            <button
              type="button"
              disabled={!shipment.tracking_number}
              aria-label="Copiar rastreio"
              onClick={copyTracking}
              className={cn(
                'flex items-center gap-1 rounded p-1 text-zinc-500 transition-colors hover:text-white',
                !shipment.tracking_number && 'cursor-not-allowed opacity-30',
              )}
            >
              {copied ? (
                <>
                  <Icon name="check" size={16} className="text-secondary" />
                  <span className="text-xs text-secondary">Copiado</span>
                </>
              ) : (
                <Icon name="content_copy" size={18} />
              )}
            </button>
          </div>
          {shipment.shipping_carrier && (
            <span className="mt-1 text-xs text-zinc-500">via {shipment.shipping_carrier}</span>
          )}
        </div>

        <div className="flex flex-col gap-md">
          <span className="text-xs font-medium uppercase text-zinc-400">Status atual</span>
          <span className={cn('inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium', statusClass(shipment.logistics_status))}>
            {statusLabel(shipment.logistics_status)}
          </span>
        </div>

        <div className="flex flex-col gap-md">
          <span className="text-xs font-medium uppercase text-zinc-400">Histórico</span>
          {loading ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-white/5 p-md text-center">
              <Icon name="progress_activity" className="animate-spin text-zinc-50" size={20} />
              <span className="text-xs text-zinc-500">Carregando histórico…</span>
            </div>
          ) : !history || history.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-white/5 p-md text-center text-xs text-zinc-500">
              Sem eventos registrados ainda. Histórico aparecerá conforme push da Shopee.
            </div>
          ) : (
            <div className="relative pl-sm">
              <div className="absolute bottom-2 left-[15px] top-2 w-px bg-white/10" />
              {history.map((ev, i) => {
                const meta = statusMeta[ev.logistics_status]
                const dotBg =
                  meta?.tone === 'green' ? 'bg-secondary'
                    : meta?.tone === 'blue' ? 'bg-blue-500'
                      : meta?.tone === 'red' ? 'bg-error'
                        : 'bg-zinc-50'
                const desc = ev.description ?? statusLabel(ev.logistics_status)
                return (
                  <div key={ev.id} className="relative mb-lg flex gap-md">
                    <div className={cn('z-10 mt-1.5 h-2 w-2 rounded-full ring-4 ring-[#0d1117]', i === 0 ? dotBg : 'bg-white/20')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm leading-tight', i === 0 ? 'font-semibold text-on-background' : 'text-on-background')}>
                        {desc}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-400">{fmtDateTime(ev.event_date)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-xs">
          <span className="text-xs font-medium uppercase text-zinc-400">Pedido vinculado</span>
          <div className="rounded-lg border border-zinc-800/60 bg-white/5 p-md">
            <p className="font-mono text-xs text-zinc-500">#{shipment.order_sn}</p>
            {shipment.receiver_name && (
              <p className="mt-1 text-sm font-semibold text-on-background">{shipment.receiver_name}</p>
            )}
            <p className="text-sm leading-relaxed text-zinc-400">{destination}</p>
            <div className="mt-2 flex items-center justify-between border-t border-zinc-800/60 pt-2 text-xs text-zinc-500">
              <span>{buyer ?? '—'}</span>
              {orderDate && <span className="text-zinc-50">{fmtDate(orderDate)}</span>}
              {orderTotal != null && <span className="text-zinc-50">{fmtBrl(orderTotal)}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 p-md">
        <button className="flex w-full items-center justify-center gap-xs rounded-lg bg-zinc-50 py-sm text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-100">
          <Icon name="receipt_long" size={20} />
          Ver pedido vinculado
        </button>
      </div>
    </aside>
  )
}

export function EnviosView({
  shipments,
  totalCount,
  page,
  counts,
  activeCategory,
  period,
  search,
  hasAnyShipments,
}: {
  shipments: ShipmentRow[]
  totalCount: number
  page: number
  counts: Record<Category, number>
  activeCategory: Category | 'all'
  period: Period
  search: string
  hasAnyShipments: boolean
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  function setCategory(cat: Category) {
    pushParams((next) => {
      if (activeCategory === cat) next.delete('status')
      else next.set('status', cat)
    })
  }

  function setSelectCategory(cat: Category | 'all') {
    pushParams((next) => {
      if (cat === 'all') next.delete('status')
      else next.set('status', cat)
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
  const selected = shipments.find((s) => s.id === selectedId) ?? null

  return (
    <>
      <TopBar title="Envios — Shopee" />
      <main className={cn('relative flex flex-1 overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className={cn('mx-auto flex w-full flex-1 flex-col gap-gutter', selected ? 'max-w-[calc(100%-400px)] pr-gutter' : 'max-w-7xl')}>
          <div>
            <h2 className="mb-sm text-h1 font-semibold text-on-background">Envios</h2>
            <p className="text-sm text-zinc-400">Rastreie e gerencie envios da loja Shopee.</p>
          </div>

          <div className="grid grid-cols-2 gap-gutter md:grid-cols-4">
            <SummaryCard label="Em Trânsito" value={counts.in_transit} icon="local_shipping"   category="in_transit" active={activeCategory === 'in_transit'} onClick={() => setCategory('in_transit')} />
            <SummaryCard label="Entregues"   value={counts.delivered}  icon="check_circle"     category="delivered"  active={activeCategory === 'delivered'}  onClick={() => setCategory('delivered')} />
            <SummaryCard label="Problema"    value={counts.problem}    icon="error"            category="problem"    active={activeCategory === 'problem'}    onClick={() => setCategory('problem')} />
            <SummaryCard label="Pendente"    value={counts.pending}    icon="pending_actions"  category="pending"    active={activeCategory === 'pending'}    onClick={() => setCategory('pending')} />
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-md rounded-xl p-md">
            <div className="flex flex-wrap items-center gap-md">
              <div className="relative">
                <Icon name="search" size={20} className="absolute left-sm top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-10 w-64 rounded-lg border border-zinc-800 bg-[#050507] pl-xl pr-md text-sm text-on-background outline-none transition-all focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                  placeholder="Buscar tracking ou pedido..."
                />
              </div>
              <select
                value={activeCategory}
                onChange={(e) => setSelectCategory(e.target.value as Category | 'all')}
                className="h-10 appearance-none rounded-lg border border-zinc-800 bg-[#050507] px-md py-sm pr-xl text-sm text-on-background outline-none transition-all focus:ring-1 focus:ring-tertiary"
              >
                <option value="all">Todos os Status</option>
                <option value="in_transit">Em Trânsito</option>
                <option value="delivered">Entregue</option>
                <option value="problem">Problema</option>
                <option value="pending">Pendente</option>
              </select>
              <div className="flex h-10 rounded-lg border border-zinc-800 bg-[#050507] p-1">
                {(['7d', '30d', '90d'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'rounded px-3 text-xs font-medium transition-colors',
                      period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                    )}
                  >
                    {p === '7d' ? '7d' : p === '30d' ? '30d' : '90d'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-md">
              <span className="text-xs text-zinc-400">{totalCount} envios</span>
            </div>
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 flex flex-1 flex-col overflow-hidden rounded-xl">
            {shipments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-xl text-center">
                <Icon name="local_shipping" className="text-3xl text-zinc-600" />
                <p className="text-sm text-zinc-400">
                  {!hasAnyShipments
                    ? 'Sem envios registrados. Aguardando primeiro pedido com push de tracking da Shopee.'
                    : 'Nenhum envio encontrado com os filtros aplicados.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {['Rastreio', 'Pedido', 'Comprador', 'Destino', 'Status', 'Atualizado', 'Data Pedido'].map((h) => (
                        <th key={h} className="px-lg py-md text-xs font-medium uppercase text-white/50">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s) => {
                      const isActive = selectedId === s.id
                      const cat = categoryOf(s.logistics_status)
                      const isProblem = cat === 'problem'
                      const dest = [s.receiver_city, s.receiver_state].filter(Boolean).join(', ') || '—'
                      const orderDate = s.shopee_orders?.date_created
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={cn(
                            'group cursor-pointer border-b border-zinc-800/60 transition-colors',
                            isProblem ? 'bg-error/10 hover:bg-error/20' : 'hover:bg-white/5',
                            isActive && 'bg-white/5 ring-1 ring-inset ring-tertiary/30',
                          )}
                        >
                          <td className={cn('px-lg py-md font-mono text-xs', isProblem ? 'text-error' : 'text-zinc-50')}>
                            {s.tracking_number ?? <span className="text-zinc-600">—</span>}
                          </td>
                          <td className="px-lg py-md font-mono text-xs text-zinc-400">{s.order_sn}</td>
                          <td className="px-lg py-md font-mono text-xs text-on-background">{s.shopee_orders?.buyer_username ?? '—'}</td>
                          <td className="px-lg py-md text-zinc-400">{dest}</td>
                          <td className="px-lg py-md">
                            <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusClass(s.logistics_status))}>
                              {statusLabel(s.logistics_status)}
                            </span>
                          </td>
                          <td className="px-lg py-md text-xs text-zinc-400">{fmtRelative(s.synced_at)}</td>
                          <td className="px-lg py-md text-xs text-zinc-400">{orderDate ? fmtDate(orderDate) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalCount > 0 && (
              <div className="flex items-center justify-between border-t border-zinc-800 px-lg py-md">
                <span className="text-xs text-zinc-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="px-2 text-xs text-slate-300">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selected && <ShipmentDrawer shipment={selected} onClose={() => setSelectedId(null)} />}
      </main>
    </>
  )
}
