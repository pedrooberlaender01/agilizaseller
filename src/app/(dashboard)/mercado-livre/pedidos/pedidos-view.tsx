'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import {
  exportMercadoLivreOrdersCsv,
  getMercadoLivreOrderDetails,
  type FullMlOrder,
} from '@/app/actions/mercadolivre'
import type { MlOrderItem, MlShipment, OrderMargin } from '@/types'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d'

export type MlOrderRow = {
  id: string
  external_id: string
  status: string
  date_created: string
  total_amount: number | string
  buyer_nickname: string | null
  ml_order_items: { count: number }[]
  order_margins: Pick<OrderMargin, 'gross_profit' | 'margin_pct' | 'cost_missing'>[]
  ml_shipments: Pick<MlShipment, 'status' | 'tracking_number'>[]
}

export type MlPedidosKpis = {
  totalOrders: number
  totalRevenue: number
  avgTicket: number
  cancelled: number
}

const statusMeta: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Pago', cls: 'bg-secondary/10 text-secondary' },
  confirmed: { label: 'Confirmado', cls: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
  payment_required: { label: 'Aguardando pagto.', cls: 'bg-tertiary/10 text-tertiary' },
  in_process: { label: 'Em processo', cls: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
  partially_refunded: { label: 'Reembolso parcial', cls: 'bg-tertiary/10 text-tertiary' },
  cancelled: { label: 'Cancelado', cls: 'bg-error/10 text-error' },
}

const shipMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Aguardando', cls: 'bg-surface-container-highest text-slate-300 border border-white/10' },
  ready_to_ship: { label: 'Preparando', cls: 'bg-white/10 text-slate-300' },
  shipped: { label: 'Em trânsito', cls: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
  in_transit: { label: 'Em trânsito', cls: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
  delivered: { label: 'Entregue', cls: 'bg-secondary/10 text-secondary' },
  not_delivered: { label: 'Não entregue', cls: 'bg-error/10 text-error' },
  cancelled: { label: 'Cancelado', cls: 'bg-surface-container-highest text-slate-400 border border-white/10' },
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

function OrderDrawer({ orderRow, onClose }: { orderRow: MlOrderRow; onClose: () => void }) {
  const [details, setDetails] = useState<FullMlOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetails(null)
    getMercadoLivreOrderDetails(orderRow.id).then((res) => {
      if (!cancelled) {
        setDetails(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [orderRow.id])

  const status = statusMeta[orderRow.status]
  const items: MlOrderItem[] = details?.ml_order_items ?? []
  const margin: OrderMargin | undefined = details?.order_margins?.[0]
  const shipment: MlShipment | undefined = details?.ml_shipments?.[0]
  const subtotal = items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0)
  const ship = shipment ? shipMeta[shipment.status ?? ''] : undefined

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-screen w-[380px] flex-col overflow-y-auto border-l border-white/10 bg-[#0d1117]"
      style={{ boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.1)' }}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#0d1117]/90 p-6 backdrop-blur-md">
        <div className="min-w-0 pr-3">
          <h3 className="truncate font-mono text-base font-semibold text-white">#{orderRow.external_id}</h3>
          <p className="mt-1 text-sm text-slate-400">{fmtRelDate(orderRow.date_created)} · Mercado Livre</p>
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
            <Icon name="progress_activity" className="animate-spin text-[#3b82f6]" size={28} />
            <span className="text-xs text-slate-400">Carregando detalhes…</span>
          </div>
        )}

        {!loading && shipment && (
          <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]/20 text-[#3b82f6]">
              <Icon name="local_shipping" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-[#3b82f6]">
                {ship?.label ?? shipment.status ?? 'Envio'}
              </p>
              {shipment.estimated_delivery_limit && (
                <p className="text-sm text-slate-300">
                  Previsão: {new Date(shipment.estimated_delivery_limit).toLocaleDateString('pt-BR')}
                </p>
              )}
              {shipment.tracking_number && (
                <p className="mt-1 truncate font-mono text-xs text-slate-400">{shipment.tracking_number}</p>
              )}
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</h4>
            <div className="glass-card rounded-lg p-4">
              <p className="font-mono text-sm font-medium text-white">{orderRow.buyer_nickname ?? '—'}</p>
              {shipment?.receiver_city && (
                <p className="mt-2 text-sm text-slate-400">
                  {shipment.receiver_city}
                  {shipment.receiver_state ? `, ${shipment.receiver_state}` : ''}
                  {shipment.receiver_zip ? ` - ${shipment.receiver_zip}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Itens ({items.length})</h4>
            <div className="glass-card divide-y divide-white/10 rounded-lg">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5">
                    <Icon name="inventory_2" className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-white">{it.title}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {it.seller_sku ?? '—'} · Qtd: {it.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-white">{fmtBrl(Number(it.unit_price) * it.quantity)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Resumo Financeiro</h4>
            <div className="flex items-start gap-2 rounded-lg border border-tertiary/30 bg-tertiary/10 p-3 text-xs text-tertiary">
              <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
              <span>Lucro e margem indisponíveis — custos dos produtos ainda não cadastrados.</span>
            </div>
            <div className="glass-card space-y-2 rounded-lg p-4">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Subtotal Itens</span>
                <span>{items.length > 0 ? fmtBrl(subtotal) : fmtBrl(Number(orderRow.total_amount))}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Total do Pedido</span>
                <span>{fmtBrl(Number(orderRow.total_amount))}</span>
              </div>
              <div className="my-2 border-t border-white/10" />
              <div className="flex items-center justify-between pt-1 text-sm text-slate-500">
                <span className="text-base font-semibold text-white">Lucro Líquido</span>
                <span>—</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t border-white/10 bg-[#0d1117] p-6">
        <button className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-white transition-colors hover:bg-white/10">
          Imprimir Etiqueta
        </button>
        <button className="flex-1 rounded-lg bg-[#3b82f6] py-2 text-sm text-white shadow-lg shadow-[#3b82f6]/20 transition-colors hover:bg-[#2563eb]">
          Ver no ML
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
  search,
  customFrom,
  customTo,
  kpis,
}: {
  orders: MlOrderRow[]
  totalCount: number
  page: number
  period: Period
  search: string
  customFrom: string | null
  customTo: string | null
  kpis: MlPedidosKpis
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const isCustom = !!(customFrom && customTo)

  function pushParams(updater: (next: URLSearchParams) => void, resetPage = true) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    if (resetPage) next.delete('page')
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  useEffect(() => {
    if (debouncedSearch === search) return
    pushParams((next) => {
      if (debouncedSearch) next.set('q', debouncedSearch)
      else next.delete('q')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      next.delete('from')
      next.delete('to')
    })
  }

  function applyCustomRange(fromIso: string, toIso: string) {
    setPopoverOpen(false)
    pushParams((next) => {
      next.delete('period')
      next.set('from', fromIso)
      next.set('to', toIso)
    })
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
      const { csv, filename } = await exportMercadoLivreOrdersCsv({
        period,
        statuses: [],
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

  const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
  const fmtNum = (n: number) => n.toLocaleString('pt-BR')
  const cancelPct = kpis.totalOrders > 0 ? (kpis.cancelled / kpis.totalOrders) * 100 : 0

  const kpiCards = useMemo(
    () => [
      { label: 'Pedidos', value: fmtNum(kpis.totalOrders), icon: 'shopping_cart', tone: 'text-on-surface' },
      { label: 'Faturamento Bruto', value: fmtBrlInt(kpis.totalRevenue), icon: 'payments', tone: 'text-secondary' },
      { label: 'Ticket Médio', value: fmtBrlInt(kpis.avgTicket), icon: 'receipt_long', tone: 'text-on-surface' },
      { label: 'Cancelados', value: `${cancelPct.toFixed(1).replace('.', ',')}%`, icon: 'remove_shopping_cart', tone: cancelPct > 5 ? 'text-error' : 'text-on-surface' },
    ],
    [kpis, cancelPct],
  )

  return (
    <>
      <TopBar title="Pedidos — Mercado Livre" />
      <main className={cn('overflow-y-auto p-margin', selected && 'pr-[420px]', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg grid grid-cols-2 md:grid-cols-4 gap-gutter">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-white/10 bg-surface-container/70 p-lg flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">{kpi.label}</span>
                <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
              </div>
              <div className={cn('text-h2 font-semibold', kpi.tone)}>{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[260px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                placeholder="Buscar pedido, comprador..."
              />
            </div>
            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
              {(['7d', '30d', '90d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    !isCustom && period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>

            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex h-[34px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
                  isCustom
                    ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-white'
                    : 'border-white/10 bg-[#050507] text-slate-400 hover:text-white',
                )}
                aria-label="Selecionar intervalo"
              >
                <Icon name="calendar_today" size={15} />
                <span>
                  {isCustom && customFrom && customTo
                    ? `${fmtDateBRShort(customFrom)} – ${fmtDateBRShort(customTo)}`
                    : 'Personalizar'}
                </span>
                <span className={cn('material-symbols-outlined text-[14px] transition-transform', popoverOpen && 'rotate-180')}>expand_more</span>
              </button>
              {popoverOpen && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={applyCustomRange}
                  onClose={() => setPopoverOpen(false)}
                  align="left"
                />
              )}
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
              <span className="hidden sm:inline">{exporting ? 'Exportando…' : 'Exportar CSV'}</span>
            </button>
          </div>
        </div>

        <div className="glass-card overflow-x-auto rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                {['ID DO PEDIDO', 'COMPRADOR', 'ITENS', 'TOTAL', 'LUCRO', 'MARGEM', 'STATUS', 'ENVIO', 'DATA'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isSelected = selectedId === o.id
                  const itemCount = o.ml_order_items?.[0]?.count ?? 0
                  const status = statusMeta[o.status]
                  const ship = o.ml_shipments?.[0]?.status ? shipMeta[o.ml_shipments[0].status as string] : undefined
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      className={cn(
                        'cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5',
                        isSelected && 'bg-white/5 ring-1 ring-inset ring-[#3b82f6]/30',
                      )}
                    >
                      <td className={cn('whitespace-nowrap px-6 py-4 font-mono', isSelected ? 'text-[#3b82f6]' : 'text-slate-300')}>
                        {o.external_id}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{o.buyer_nickname ?? '—'}</td>
                      <td className="whitespace-nowrap px-6 py-4">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium">{fmtBrl(Number(o.total_amount))}</td>
                      <td className="px-6 py-4 text-slate-500">—</td>
                      <td className="px-6 py-4 text-slate-500">—</td>
                      <td className="px-6 py-4">
                        {status && (
                          <span className={cn('whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium', status.cls)}>
                            {status.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {ship ? (
                          <span className={cn('whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium', ship.cls)}>
                            {ship.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-400">{fmtRelDate(o.date_created)}</td>
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
              <span className="px-2 text-xs text-slate-300">
                Página {page} de {totalPages}
              </span>
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

      {selected && <OrderDrawer orderRow={selected} onClose={() => setSelectedId(null)} />}
    </>
  )
}
