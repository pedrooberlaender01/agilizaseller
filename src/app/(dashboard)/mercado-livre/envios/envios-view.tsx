'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

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

function bucketOf(status: string | null): Bucket {
  switch (status) {
    case 'delivered':
      return 'entregue'
    case 'shipped':
    case 'in_transit':
      return 'transito'
    case 'not_delivered':
    case 'cancelled':
      return 'problema'
    default:
      return 'pendente'
  }
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
  const bucket = bucketOf(shipment.status)
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

export function EnviosView({ shipments }: { shipments: ShipmentRow[] }) {
  const [selected, setSelected] = useState<ShipmentRow | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Bucket>('all')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const counts = useMemo(() => {
    const c = { transito: 0, entregue: 0, problema: 0, pendente: 0 }
    for (const s of shipments) c[bucketOf(s.status)] += 1
    return c
  }, [shipments])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return shipments.filter((s) => {
      const matchesTerm =
        !term ||
        (s.tracking_number?.toLowerCase().includes(term) ?? false) ||
        (s.ml_orders?.buyer_nickname?.toLowerCase().includes(term) ?? false) ||
        (s.receiver_city?.toLowerCase().includes(term) ?? false)
      const matchesFilter = filter === 'all' || bucketOf(s.status) === filter
      return matchesTerm && matchesFilter
    })
  }, [shipments, search, filter])

  return (
    <>
      <TopBar title="Envios" />
      <main className="relative flex flex-1 overflow-y-auto p-margin">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-gutter pr-gutter">
          <div>
            <h2 className="mb-sm text-h1 font-semibold text-on-background">Envios — Mercado Livre</h2>
            <p className="text-sm text-on-surface-variant">Gerencie e rastreie seus envios ativos.</p>
          </div>

          <div className="grid grid-cols-2 gap-gutter md:grid-cols-4">
            <SummaryCard label="Em Trânsito" value={counts.transito} icon="local_shipping" tone="primary" active={filter === 'transito'} onClick={() => setFilter(filter === 'transito' ? 'all' : 'transito')} />
            <SummaryCard label="Entregues" value={counts.entregue} icon="check_circle" tone="secondary" active={filter === 'entregue'} onClick={() => setFilter(filter === 'entregue' ? 'all' : 'entregue')} />
            <SummaryCard label="Problema" value={counts.problema} icon="error" tone="error" active={filter === 'problema'} onClick={() => setFilter(filter === 'problema' ? 'all' : 'problema')} />
            <SummaryCard label="Pendente" value={counts.pendente} icon="pending_actions" tone="tertiary" active={filter === 'pendente'} onClick={() => setFilter(filter === 'pendente' ? 'all' : 'pendente')} />
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
