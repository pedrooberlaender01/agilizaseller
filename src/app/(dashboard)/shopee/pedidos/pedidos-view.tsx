'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import {
  exportShopeeOrdersCsv,
  getShopeeOrderDetails,
  type FullShopeeOrder,
} from '@/app/actions/shopee'
import type {
  ShopeeOrder,
  ShopeeOrderItem,
  ShopeeOrderMargin,
  ShopeeOrderStatus,
  ShopeeShipment,
} from '@/types'

const SHOPEE_COMMISSION_RATE = 0.20
const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d'

export type OrderRow = ShopeeOrder & {
  shopee_order_items: { count: number }[]
  shopee_order_margins: Pick<ShopeeOrderMargin, 'gross_profit' | 'margin_pct' | 'cost_missing'>[]
  shopee_shipments: Pick<ShopeeShipment, 'logistics_status' | 'tracking_number'>[]
}

const allStatuses: ShopeeOrderStatus[] = [
  'UNPAID',
  'READY_TO_SHIP',
  'PROCESSED',
  'SHIPPED',
  'TO_CONFIRM_RECEIVE',
  'COMPLETED',
  'IN_CANCEL',
  'CANCELLED',
  'INVOICE_PENDING',
]

const statusMeta: Record<ShopeeOrderStatus, { label: string; cls: string; tone: 'yellow' | 'blue' | 'green' | 'gray' | 'red' }> = {
  UNPAID:             { label: 'Aguardando pagto.',  cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',     tone: 'yellow' },
  READY_TO_SHIP:      { label: 'Pronto p/ envio',    cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',         tone: 'blue' },
  PROCESSED:          { label: 'Processado',         cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',         tone: 'blue' },
  SHIPPED:            { label: 'Enviado',            cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',         tone: 'blue' },
  TO_CONFIRM_RECEIVE: { label: 'Confirmar recebim.', cls: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',         tone: 'blue' },
  COMPLETED:          { label: 'Concluído',          cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',   tone: 'green' },
  IN_CANCEL:          { label: 'Em cancelamento',    cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',     tone: 'yellow' },
  CANCELLED:          { label: 'Cancelado',          cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',               tone: 'red' },
  INVOICE_PENDING:    { label: 'NF pendente',        cls: 'bg-outline/20 text-zinc-500 border border-outline/30',         tone: 'gray' },
}

const logisticsLabel: Record<string, string> = {
  LOGISTICS_REQUEST_CREATED: 'Coleta solicitada',
  LOGISTICS_READY: 'Pronto p/ retirada',
  LOGISTICS_PICKUP_DONE: 'Em trânsito',
  LOGISTICS_DELIVERY_DONE: 'Entregue',
  LOGISTICS_INVOICE_PENDING: 'NF pendente',
  LOGISTICS_DELIVERY_FAILED: 'Falha na entrega',
  LOGISTICS_PICKUP_FAILED: 'Falha na coleta',
  LOGISTICS_RETURNING: 'Em devolução',
  LOGISTICS_RETURNED: 'Devolvido',
}

const fmtBrl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtRelDate(iso: string): string {
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

function StatusMultiselect({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<ShopeeOrderStatus>
  onToggle: (s: ShopeeOrderStatus) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#050507] px-4 py-2 text-sm text-zinc-50 outline-none transition-colors hover:border-zinc-50/40',
          open && 'border-zinc-50/40',
        )}
      >
        <span>Status</span>
        {selected.size > 0 && (
          <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-50">
            {selected.size}
          </span>
        )}
        <Icon name={open ? 'expand_less' : 'expand_more'} size={16} className="text-zinc-500" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-[260px] rounded-xl border border-zinc-800 bg-[#0d1117]/97 p-2 shadow-2xl shadow-black/60 backdrop-blur-md">
          <div className="mb-1 flex items-center justify-between border-b border-zinc-800/60 px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Filtrar status</span>
            {selected.size > 0 && (
              <button onClick={onClear} className="text-[10px] text-zinc-50 hover:underline">
                Limpar
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {allStatuses.map((s) => {
              const isOn = selected.has(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggle(s)}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm text-zinc-50 hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded border',
                        isOn ? 'border-zinc-50/40 bg-zinc-50' : 'border-outline/40',
                      )}
                    >
                      {isOn && <Icon name="check" size={11} className="text-zinc-900" />}
                    </span>
                    {statusMeta[s].label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MarginCell({ margin }: { margin: OrderRow['shopee_order_margins'][number] | undefined }) {
  if (!margin || margin.cost_missing) {
    return <span className="rounded-full bg-outline/15 px-2 py-1 text-xs font-medium text-zinc-500">Sem custo</span>
  }
  const pct = margin.margin_pct ?? 0
  const cls =
    pct >= 20
      ? 'bg-secondary/10 text-secondary'
      : pct >= 10
        ? 'bg-zinc-800/60 text-zinc-50'
        : 'bg-error/10 text-error'
  return <span className={cn('rounded-full px-2 py-1 text-xs font-medium', cls)}>{pct.toFixed(1)}%</span>
}

function OrderDrawer({
  orderRow,
  onClose,
}: {
  orderRow: OrderRow
  onClose: () => void
}) {
  const [details, setDetails] = useState<FullShopeeOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetails(null)
    getShopeeOrderDetails(orderRow.id).then((res) => {
      if (!cancelled) {
        setDetails(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [orderRow.id])

  const status = statusMeta[orderRow.status as ShopeeOrderStatus]
  const items: ShopeeOrderItem[] = details?.shopee_order_items ?? []
  const margin: ShopeeOrderMargin | undefined = details?.shopee_order_margins?.[0]
  const shipment: ShopeeShipment | undefined = details?.shopee_shipments?.[0]
  const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)

  const rawAddr = (details?.raw_payload as { recipient_address?: { full_address?: string; name?: string } } | null)
    ?.recipient_address
  const receiverName = rawAddr?.name ?? null
  const receiverAddress = rawAddr?.full_address ?? null

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-screen w-[380px] flex-col overflow-y-auto border-l border-zinc-800 bg-[#0d1117]"
      style={{ boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(250, 204, 60, 0.1)' }}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-zinc-800 bg-[#0d1117]/90 p-6 backdrop-blur-md">
        <div className="min-w-0 pr-3">
          <h3 className="truncate font-mono text-base font-semibold text-white">#{orderRow.external_id}</h3>
          <p className="mt-1 text-sm text-slate-400">{fmtRelDate(orderRow.date_created)} · Shopee</p>
          {status && (
            <span className={cn('mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-medium', status.cls)}>
              {status.label}
            </span>
          )}
        </div>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
          <Icon name="close" />
        </button>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Icon name="progress_activity" className="animate-spin text-zinc-50" size={28} />
            <span className="text-xs text-zinc-500">Carregando detalhes…</span>
          </div>
        )}

        {!loading && shipment && (
          <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-white/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-50">
              <Icon name="local_shipping" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-50">
                {logisticsLabel[shipment.logistics_status] ?? shipment.logistics_status}
              </p>
              {shipment.tracking_number && (
                <p className="mt-1 truncate font-mono text-xs text-slate-400">{shipment.tracking_number}</p>
              )}
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</h4>
            <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-4">
              <p className="font-mono text-sm font-medium text-white">{orderRow.buyer_username ?? '—'}</p>
              {receiverName && <p className="mt-1 text-sm text-slate-300">{receiverName}</p>}
              {receiverAddress && <p className="mt-2 whitespace-pre-line text-sm text-slate-400">{receiverAddress}</p>}
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Itens ({items.length})
            </h4>
            <div className="border border-zinc-800 bg-zinc-900/40 divide-y divide-white/10 rounded-lg">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-zinc-800 bg-white/5">
                    <Icon name="inventory_2" className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-white">{it.title}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {it.model_sku ?? it.seller_sku ?? '—'} · Qtd: {it.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-white">{fmtBrl(it.unit_price * it.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Resumo Financeiro</h4>
            {margin?.cost_missing && (
              <div className="flex items-start gap-2 rounded-lg border border-zinc-50/30 bg-zinc-800/60 p-3 text-xs text-zinc-50">
                <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
                <span>Cálculo aproximado — custo do produto não cadastrado para 1+ SKUs.</span>
              </div>
            )}
            <div className="border border-zinc-800 bg-zinc-900/40 space-y-2 rounded-lg p-4">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Subtotal Itens</span>
                <span>{fmtBrl(subtotal)}</span>
              </div>
              <div className="my-2 border-t border-zinc-800" />
              {margin ? (
                <>
                  <div className="flex justify-between text-sm text-error">
                    <span>Comissão Shopee</span>
                    <span>- {fmtBrl(margin.commission_fee)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-error">
                    <span>Frete (vendedor)</span>
                    <span>- {fmtBrl(margin.shipping_cost_seller)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-error">
                    <span>Custo Produto (CMV)</span>
                    <span>- {fmtBrl(margin.cogs_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-error">
                    <span>Embalagem</span>
                    <span>- {fmtBrl(margin.packaging_total)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-error">
                    <span>Impostos</span>
                    <span>- {fmtBrl(margin.seller_tax_total)}</span>
                  </div>
                  <div className="my-2 border-t border-zinc-800" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-base font-semibold text-white">Lucro Líquido</span>
                    <div className="text-right">
                      <span
                        className={cn(
                          'text-h2 font-semibold',
                          margin.gross_profit >= 0 ? 'text-secondary' : 'text-error',
                        )}
                      >
                        {fmtBrl(margin.gross_profit)}
                      </span>
                      {margin.margin_pct !== null && (
                        <p
                          className={cn(
                            'text-xs font-medium',
                            margin.margin_pct >= 20
                              ? 'text-secondary'
                              : margin.margin_pct >= 10
                                ? 'text-zinc-50'
                                : 'text-error',
                          )}
                        >
                          Margem: {margin.margin_pct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm text-error">
                    <span>Comissão Shopee (~20%)</span>
                    <span>- {fmtBrl(subtotal * SHOPEE_COMMISSION_RATE)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-sm text-zinc-500">
                    <span>Margem indisponível</span>
                    <span>—</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t border-zinc-800 bg-[#0d1117] p-6">
        <button className="flex-1 rounded-lg border border-zinc-800 bg-white/5 py-2 text-sm text-white transition-colors hover:bg-white/10">
          Imprimir Etiqueta
        </button>
        <button className="flex-1 rounded-lg bg-zinc-50 py-2 text-sm font-medium text-zinc-900 shadow-lg shadow-orange-900/20 transition-colors hover:bg-zinc-100">
          Ver na Shopee
        </button>
      </div>
    </aside>
  )
}

export function PedidosView({
  orders,
  totalCount,
  page,
  period,
  statusList,
  search,
}: {
  orders: OrderRow[]
  totalCount: number
  page: number
  period: Period
  statusList: ShopeeOrderStatus[]
  search: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

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

  const statusSet = useMemo(() => new Set(statusList), [statusList])

  function toggleStatus(s: ShopeeOrderStatus) {
    pushParams((next) => {
      const cur = new Set(statusList)
      if (cur.has(s)) cur.delete(s)
      else cur.add(s)
      if (cur.size === 0) next.delete('status')
      else next.set('status', Array.from(cur).join(','))
    })
  }

  function clearStatus() {
    pushParams((next) => next.delete('status'))
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

  async function handleExport() {
    setExporting(true)
    try {
      const { csv, filename } = await exportShopeeOrdersCsv({
        period,
        statuses: statusList,
        search: debouncedSearch,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const selected = orders.find((o) => o.id === selectedId) ?? null

  return (
    <>
      <TopBar title="Pedidos — Shopee" />
      <main className={cn('overflow-y-auto p-margin', selected && 'pr-[420px]', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[260px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar pedido ou comprador..."
              />
            </div>
            <StatusMultiselect selected={statusSet} onToggle={toggleStatus} onClear={clearStatus} />
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
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400">
              {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
            </span>
            <button
              onClick={handleExport}
              disabled={exporting || totalCount === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name={exporting ? 'progress_activity' : 'download'} size={18} className={exporting ? 'animate-spin' : ''} />
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          </div>
        </div>

        {(statusList.length > 0 || search || period !== '30d') && (
          <div className="mb-lg flex flex-wrap gap-2">
            {statusList.map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className="flex items-center gap-2 rounded-full border border-zinc-50/30 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-50"
              >
                {statusMeta[s].label}
                <Icon name="close" size={14} />
              </button>
            ))}
            {search && (
              <button
                onClick={() => setSearchInput('')}
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200"
              >
                Busca: &quot;{search}&quot;
                <Icon name="close" size={14} />
              </button>
            )}
            {period !== '30d' && (
              <button
                onClick={() => setPeriod('30d')}
                className="flex items-center gap-2 rounded-full border border-zinc-800 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200"
              >
                Período: {period === '7d' ? '7 dias' : '90 dias'}
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        )}

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">ID do Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Itens</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Lucro</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Margem</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Envio</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isSelected = selectedId === o.id
                  const margin = o.shopee_order_margins[0]
                  const ship = o.shopee_shipments[0]
                  const profitClass =
                    margin && !margin.cost_missing
                      ? margin.gross_profit >= 0
                        ? 'text-secondary'
                        : 'text-error'
                      : 'text-zinc-500'
                  const itemCount = o.shopee_order_items[0]?.count ?? 0
                  const shipLabel = ship?.logistics_status
                    ? logisticsLabel[ship.logistics_status] ?? ship.logistics_status
                    : '—'
                  const status = statusMeta[o.status as ShopeeOrderStatus]
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      className={cn(
                        'cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5',
                        isSelected && 'bg-white/5 ring-1 ring-inset ring-tertiary/30',
                      )}
                    >
                      <td className={cn('px-6 py-4 font-mono', isSelected ? 'text-zinc-50' : 'text-slate-300')}>
                        {o.external_id}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{o.buyer_username ?? '—'}</td>
                      <td className="px-6 py-4">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</td>
                      <td className="px-6 py-4 font-medium">{fmtBrl(o.total_amount)}</td>
                      <td className={cn('px-6 py-4 font-medium', profitClass)}>
                        {margin && !margin.cost_missing ? fmtBrl(margin.gross_profit) : '—'}
                      </td>
                      <td className="px-6 py-4"><MarginCell margin={margin} /></td>
                      <td className="px-6 py-4">
                        {status && (
                          <span className={cn('rounded-full px-2 py-1 text-xs font-medium', status.cls)}>
                            {status.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">{shipLabel}</td>
                      <td className="px-6 py-4 text-slate-400">{fmtRelDate(o.date_created)}</td>
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
        </div>
      </main>

      {selected && <OrderDrawer orderRow={selected} onClose={() => setSelectedId(null)} />}
    </>
  )
}
