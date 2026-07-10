'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

type EnvPeriod = '7d' | '30d' | 'custom'

export type ShipmentRow = {
  id: string
  external_id: string | null
  status: string | null
  substatus: string | null
  logistic_type: string | null
  tracking_number: string | null
  estimated_delivery_limit: string | null
  delivered_at: string | null
  cost_seller: number | string | null
  receiver_city: string | null
  receiver_state: string | null
  receiver_zip: string | null
  ml_orders: { buyer_nickname: string | null; date_created: string; total_amount: number | string } | null
}

type Bucket = 'transito' | 'entregue' | 'problema' | 'pendente'

const statusBadge: Record<Bucket, string> = {
  transito: 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20',
  entregue: 'bg-secondary/10 text-secondary border border-secondary/20',
  problema: 'bg-error/20 text-error border border-error/30',
  pendente: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
}

const statusLabel: Record<Bucket, string> = {
  transito: 'Em Trânsito',
  entregue: 'Entregue',
  problema: 'Problema',
  pendente: 'Pendente',
}

// Substatus de "shipped" que ainda são PREPARAÇÃO (não estão a caminho do comprador) → Pendente.
const PREP_SUBSTATUS = new Set([
  'in_warehouse', 'ready_to_print', 'ready_to_ship', 'in_packing_list', 'invoice_pending',
  'ready_for_pickup', 'packed', 'printed', 'not_picked_up_at_hub', 'picking_up', 'buffered', 'manufacturing', 'handling',
])

function bucketOf(status: string | null, substatus?: string | null): Bucket {
  if (status === 'delivered') return 'entregue'
  if (status === 'not_delivered' || status === 'cancelled') return 'problema'
  if (status === 'shipped' || status === 'in_transit') {
    return substatus && PREP_SUBSTATUS.has(substatus) ? 'pendente' : 'transito'
  }
  return 'pendente'
}

const logisticLabel: Record<string, string> = {
  fulfillment: 'Full',
  cross_docking: 'Cross Docking',
  self_service: 'Flex',
  drop_off: 'Agência',
  xd_drop_off: 'Agência XD',
}

const fmtBrl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  icon: string
  tone: 'primary' | 'secondary' | 'error' | 'tertiary'
  active?: boolean
  onClick?: () => void
}) {
  const toneText =
    tone === 'primary'
      ? 'text-[#3b82f6]'
      : tone === 'secondary'
        ? 'text-secondary'
        : tone === 'error'
          ? 'text-error'
          : 'text-tertiary'
  const cardBorder = active
    ? 'border-[#3b82f6]/50 bg-[#3b82f6]/10'
    : tone === 'error'
      ? 'border-error/50 hover:bg-white/5'
      : 'hover:bg-white/5'

  return (
    <button
      onClick={onClick}
      className={`glass-card flex flex-col gap-sm rounded-xl p-lg text-left transition-all active:scale-[0.98] ${cardBorder}`}
    >
      <div className={`flex items-center gap-1 ${toneText}`}>
        <Icon name={icon} size={20} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-[36px] font-bold leading-none text-on-background">{value}</span>
    </button>
  )
}

function ShipmentDrawer({ shipment, onClose }: { shipment: ShipmentRow; onClose: () => void }) {
  const bucket = bucketOf(shipment.status, shipment.substatus)
  const tracking = shipment.tracking_number ?? '—'
  return (
    <aside className="absolute bottom-margin right-margin top-margin z-20 flex h-[calc(100vh-56px-80px)] w-[360px] flex-col overflow-hidden rounded-xl border-l border-white/10 bg-[#0d1117]/80 backdrop-blur-[20px]">
      <div className="flex items-center justify-between border-b border-white/10 p-lg">
        <h3 className="text-base font-semibold text-on-background">Detalhes do Envio</h3>
        <button
          type="button"
          aria-label="Fechar detalhes"
          onClick={onClose}
          className="rounded-md p-1 text-outline transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-xl overflow-y-auto p-lg">
        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium uppercase text-on-surface-variant">Código de Rastreio</span>
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#050507] p-sm">
            <span className="text-lg font-mono tracking-widest text-primary">{tracking}</span>
            {shipment.tracking_number && (
              <button
                type="button"
                aria-label="Copiar rastreio"
                onClick={() => navigator.clipboard?.writeText(shipment.tracking_number!)}
                className="p-1 text-outline transition-colors hover:text-white"
              >
                <Icon name="content_copy" size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-md">
          <span className="text-xs font-medium uppercase text-on-surface-variant">Status</span>
          <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-md">
            <span className={cn('rounded-full px-2 py-1 text-xs font-medium', statusBadge[bucket])}>
              {statusLabel[bucket]}
            </span>
            {shipment.logistic_type && (
              <span className="text-xs text-on-surface-variant">
                {logisticLabel[shipment.logistic_type] ?? shipment.logistic_type}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-md text-sm">
            <div>
              <span className="text-xs text-on-surface-variant">Prazo de Entrega</span>
              <p className="text-on-background">{fmtDate(shipment.estimated_delivery_limit)}</p>
            </div>
            <div>
              <span className="text-xs text-on-surface-variant">Entregue em</span>
              <p className="text-on-background">{fmtDate(shipment.delivered_at)}</p>
            </div>
            <div>
              <span className="text-xs text-on-surface-variant">Custo (vendedor)</span>
              <p className="text-on-background">
                {shipment.cost_seller != null ? fmtBrl(Number(shipment.cost_seller)) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-xs">
          <span className="text-xs font-medium uppercase text-on-surface-variant">Destino</span>
          <div className="rounded-lg border border-white/5 bg-white/5 p-md">
            <p className="mb-1 text-sm font-semibold text-on-background">
              {shipment.ml_orders?.buyer_nickname ?? '—'}
            </p>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {shipment.receiver_city ?? '—'}
              {shipment.receiver_state ? `, ${shipment.receiver_state}` : ''}
              {shipment.receiver_zip ? ` - ${shipment.receiver_zip}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 p-md">
        <button className="flex w-full items-center justify-center gap-xs rounded-lg bg-primary-container py-sm text-base font-semibold text-on-primary-container transition-colors hover:bg-primary-container/90">
          <Icon name="receipt_long" size={20} />
          Ver pedido vinculado
        </button>
      </div>
    </aside>
  )
}

type Counts = { transito: number; entregue: number; problema: number; pendente: number }

export function EnviosView({
  shipments,
  counts,
  countsFull,
  period,
  customFrom,
  customTo,
}: {
  shipments: ShipmentRow[]
  counts: Counts
  countsFull: Counts
  period: EnvPeriod
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<ShipmentRow | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Bucket>('all')
  const [fullOnly, setFullOnly] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const isCustom = period === 'custom'

  useEffect(() => {
    if (!infoOpen) return
    function onDoc(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [infoOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  function setPeriod(p: '7d' | '30d') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('period', p)
    params.delete('from')
    params.delete('to')
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }))
  }

  function applyCustomRange(fromIso: string, toIso: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('period')
    params.set('from', fromIso)
    params.set('to', toIso)
    setPopoverOpen(false)
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }))
  }

  // Clica card: toggla o filtro (bucket + Full/geral) que alimenta a lista.
  function pick(b: Bucket, full: boolean) {
    const isActive = fullOnly === full && filter === b
    setFullOnly(full)
    setFilter(isActive ? 'all' : b)
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return shipments.filter((s) => {
      const matchesTerm =
        !term ||
        (s.tracking_number?.toLowerCase().includes(term) ?? false) ||
        (s.ml_orders?.buyer_nickname?.toLowerCase().includes(term) ?? false) ||
        (s.receiver_city?.toLowerCase().includes(term) ?? false)
      const matchesFilter = filter === 'all' || bucketOf(s.status, s.substatus) === filter
      const matchesFull = !fullOnly || s.logistic_type === 'fulfillment'
      return matchesTerm && matchesFilter && matchesFull
    })
  }, [shipments, search, filter, fullOnly])

  return (
    <>
      <TopBar title="Envios" />
      <main className={cn('relative flex flex-1 overflow-y-auto p-margin', pending && 'opacity-70')}>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-gutter pr-gutter">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="mb-sm flex items-center gap-2 text-h1 font-semibold text-on-background">
                Envios — Mercado Livre
                <span ref={infoRef} className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => setInfoOpen((v) => !v)}
                    aria-label="Sobre estes números"
                    className="flex items-center text-on-surface-variant transition-colors hover:text-on-background"
                  >
                    <Icon name="help" size={18} />
                  </button>
                  {infoOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-white/10 bg-[#0d1117] p-4 text-left shadow-2xl shadow-black/60">
                      <p className="mb-2 text-sm font-semibold text-on-background">De onde vêm estes números</p>
                      <p className="text-xs leading-relaxed text-on-surface-variant">
                        Sincronizamos cada envio das suas vendas direto do Mercado Livre e classificamos pela <span className="text-on-background">situação atual do envio</span> (a preparar, a caminho, entregue ou com problema), filtrando pela <span className="text-on-background">data da venda</span>.
                        <br /><br />
                        <span className="font-semibold text-on-background">Por que pode não bater com o painel do ML:</span>
                        <br />
                        • O painel do ML mostra a <span className="text-on-background">fila de agora</span> (o que falta despachar e o que está a caminho neste momento), não todas as vendas do período por situação — a maioria das vendas do período já foi entregue e não aparece naqueles contadores.
                        <br />
                        • O que bate é o <span className="text-on-background">total de envios</span> do período.
                        <br />
                        • Os envios <span className="text-[#facc3c]">Full</span> não têm contagem por situação no painel do ML (lá o Full mostra só o abastecimento do estoque), então esses cards não têm um número equivalente pra comparar.
                      </p>
                    </div>
                  )}
                </span>
              </h2>
              <p className="text-sm text-on-surface-variant">Envios por data da venda. O total bate com o ML; a situação por status é a foto atual de cada venda.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-white/10 bg-[#050507] p-1">
                {(['7d', '30d'] as const).map((p) => {
                  const active = !isCustom && period === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={cn(
                        'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                        active ? 'bg-[#3b82f6] text-white' : 'text-on-surface-variant hover:text-on-background',
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
              <div ref={popoverRef} className="relative">
                <button
                  type="button"
                  onClick={() => setPopoverOpen((v) => !v)}
                  className={cn(
                    'flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                    isCustom ? 'border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-white/10 bg-[#050507] text-on-surface-variant hover:text-on-background',
                  )}
                >
                  <Icon name="calendar_today" size={16} />
                  <span>{isCustom && customFrom && customTo ? `${fmtDateBRShort(customFrom)} – ${fmtDateBRShort(customTo)}` : 'Personalizar'}</span>
                </button>
                {popoverOpen && (
                  <DateRangePopover from={customFrom} to={customTo} onApply={applyCustomRange} onClose={() => setPopoverOpen(false)} />
                )}
              </div>
            </div>
          </div>

          {/* Todos os envios */}
          <div className="flex flex-col gap-md">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Todos os envios</span>
            <div className="grid grid-cols-2 gap-gutter md:grid-cols-4">
              <SummaryCard label="Em Trânsito" value={counts.transito} icon="local_shipping" tone="primary" active={!fullOnly && filter === 'transito'} onClick={() => pick('transito', false)} />
              <SummaryCard label="Entregues" value={counts.entregue} icon="check_circle" tone="secondary" active={!fullOnly && filter === 'entregue'} onClick={() => pick('entregue', false)} />
              <SummaryCard label="Problema" value={counts.problema} icon="error" tone="error" active={!fullOnly && filter === 'problema'} onClick={() => pick('problema', false)} />
              <SummaryCard label="Pendente" value={counts.pendente} icon="pending_actions" tone="tertiary" active={!fullOnly && filter === 'pendente'} onClick={() => pick('pendente', false)} />
            </div>
          </div>

          {/* ML Full */}
          <div className="flex flex-col gap-md rounded-2xl border border-[#facc3c]/20 bg-[#facc3c]/[0.04] p-md">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#facc3c]/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#facc3c]">
                <Icon name="warehouse" size={14} /> ML Full
              </span>
              <span className="text-xs text-on-surface-variant">
                Envios do estoque Full (fulfillment) — {(countsFull.transito + countsFull.entregue + countsFull.problema + countsFull.pendente).toLocaleString('pt-BR')} no período
              </span>
            </div>
            <div className="grid grid-cols-2 gap-gutter md:grid-cols-4">
              <SummaryCard label="Em Trânsito" value={countsFull.transito} icon="local_shipping" tone="primary" active={fullOnly && filter === 'transito'} onClick={() => pick('transito', true)} />
              <SummaryCard label="Entregues" value={countsFull.entregue} icon="check_circle" tone="secondary" active={fullOnly && filter === 'entregue'} onClick={() => pick('entregue', true)} />
              <SummaryCard label="Problema" value={countsFull.problema} icon="error" tone="error" active={fullOnly && filter === 'problema'} onClick={() => pick('problema', true)} />
              <SummaryCard label="Pendente" value={countsFull.pendente} icon="pending_actions" tone="tertiary" active={fullOnly && filter === 'pendente'} onClick={() => pick('pendente', true)} />
            </div>
          </div>

          <div className="glass-card flex flex-wrap items-center justify-between gap-md rounded-xl p-md">
            <div className="flex flex-wrap items-center gap-md">
              <div className="relative">
                <Icon name="search" size={20} className="absolute left-sm top-1/2 -translate-y-1/2 text-outline" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-64 rounded-lg border border-white/10 bg-[#050507] pl-xl pr-md text-sm text-on-background outline-none transition-all focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                  placeholder="Buscar rastreio, comprador..."
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | Bucket)}
                className="h-10 appearance-none rounded-lg border border-white/10 bg-[#050507] px-md py-sm pr-xl text-sm text-on-background outline-none transition-all focus:ring-1 focus:ring-[#3b82f6]"
              >
                <option value="all">Todos os Status</option>
                <option value="transito">Em Trânsito</option>
                <option value="entregue">Entregues</option>
                <option value="problema">Problema</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
            <button className="flex h-10 items-center gap-xs rounded-lg border border-white/10 bg-transparent px-md py-sm text-xs font-medium text-on-background transition-all hover:bg-white/5">
              <Icon name="download" size={18} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>

          <div className="glass-card flex flex-1 flex-col overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Rastreio', 'Comprador', 'Destino', 'Status', 'Prazo Entrega', 'Custo'].map((h, i) => (
                      <th
                        key={h}
                        className={`whitespace-nowrap px-lg py-md text-xs font-medium uppercase text-white/50 ${i === 5 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-lg py-12 text-center text-sm text-on-surface-variant">
                        Nenhum envio encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => {
                      const isActive = selected?.id === s.id
                      const bucket = bucketOf(s.status)
                      const errored = bucket === 'problema'
                      return (
                        <tr
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`group cursor-pointer border-b border-white/5 transition-colors ${
                            errored ? 'bg-error/10 hover:bg-error/20' : 'hover:bg-white/5'
                          } ${isActive ? 'bg-white/5 ring-1 ring-inset ring-[#3b82f6]/30' : ''}`}
                        >
                          <td className={`whitespace-nowrap px-lg py-md font-mono text-xs ${errored ? 'text-error' : 'text-primary'}`}>
                            {s.tracking_number ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-lg py-md text-on-background">{s.ml_orders?.buyer_nickname ?? '—'}</td>
                          <td className="whitespace-nowrap px-lg py-md text-on-surface-variant">
                            {s.receiver_city ?? '—'}
                            {s.receiver_state ? `, ${s.receiver_state}` : ''}
                          </td>
                          <td className="px-lg py-md">
                            <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusBadge[bucket]}`}>
                              {statusLabel[bucket]}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-lg py-md text-on-surface-variant">{fmtDate(s.estimated_delivery_limit)}</td>
                          <td className="whitespace-nowrap px-lg py-md text-right text-on-background">
                            {s.cost_seller != null ? fmtBrl(Number(s.cost_seller)) : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {selected && <ShipmentDrawer shipment={selected} onClose={() => setSelected(null)} />}
      </main>
    </>
  )
}
