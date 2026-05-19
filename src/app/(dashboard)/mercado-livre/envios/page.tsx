'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

type ShipStatus = 'em-transito' | 'entregue' | 'problema' | 'pendente'

type Shipment = {
  tracking: string
  buyer: string
  destination: string
  status: ShipStatus
  deadline: string
  cost: string
  delayed?: boolean
  errored?: boolean
}

const shipments: Shipment[] = [
  { tracking: 'BR987654321ML', buyer: 'Maria Silva', destination: 'São Paulo, SP', status: 'em-transito', deadline: '12/10/2023', cost: 'R$ 24,50' },
  { tracking: 'BR123456789ML', buyer: 'João Souza', destination: 'Rio de Janeiro, RJ', status: 'entregue', deadline: '10/10/2023', cost: 'R$ 18,90' },
  { tracking: 'BR555555555ML', buyer: 'Ana Costa', destination: 'Belo Horizonte, MG', status: 'problema', deadline: 'Atrasado', cost: 'R$ 32,00', errored: true, delayed: true },
  { tracking: 'BR777777777ML', buyer: 'Carlos Lima', destination: 'Curitiba, PR', status: 'pendente', deadline: '15/10/2023', cost: 'R$ 15,00' },
]

const statusBadge: Record<ShipStatus, string> = {
  'em-transito': 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20',
  entregue: 'bg-secondary/10 text-secondary border border-secondary/20',
  problema: 'bg-error/20 text-error border border-error/30',
  pendente: 'bg-tertiary/10 text-tertiary border border-tertiary/20',
}

const statusLabel: Record<ShipStatus, string> = {
  'em-transito': 'Em Trânsito',
  entregue: 'Entregue',
  problema: 'Problema',
  pendente: 'Pendente',
}

type SummaryProps = {
  label: string
  value: number
  icon: string
  tone: 'primary' | 'secondary' | 'error' | 'tertiary'
  active?: boolean
}

function SummaryCard({ label, value, icon, tone, active }: SummaryProps) {
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

function ShipmentDrawer({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
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
            <span className="text-lg font-mono tracking-widest text-primary">{shipment.tracking}</span>
            <button
              type="button"
              aria-label="Copiar rastreio"
              onClick={() => navigator.clipboard?.writeText(shipment.tracking)}
              className="p-1 text-outline transition-colors hover:text-white"
            >
              <Icon name="content_copy" size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-md">
          <span className="text-xs font-medium uppercase text-on-surface-variant">Progresso</span>
          <div className="relative pl-sm">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-white/10" />
            {[
              { color: 'bg-[#3b82f6]', title: 'Em trânsito para filial', meta: 'São Paulo, SP • 09/10/2023 14:30', emphasis: true },
              { color: 'bg-secondary', title: 'Objeto postado', meta: 'Rio de Janeiro, RJ • 08/10/2023 10:15' },
              { color: 'bg-white/20', title: 'Etiqueta gerada', meta: '07/10/2023 16:45', muted: true },
              { color: 'bg-white/20', title: 'Aguardando postagem', meta: '--', muted: true },
            ].map((step, i) => (
              <div key={i} className="relative mb-lg flex gap-md">
                <div className={`z-10 mt-1.5 h-2 w-2 rounded-full ${step.color} ring-4 ring-[#0d1117]`} />
                <div>
                  <p
                    className={`text-sm ${step.emphasis ? 'font-semibold text-on-background' : step.muted ? 'text-on-surface-variant' : 'text-on-background'}`}
                  >
                    {step.title}
                  </p>
                  <p className={`text-xs ${step.muted ? 'text-white/30' : 'text-on-surface-variant'}`}>
                    {step.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-xs">
          <span className="text-xs font-medium uppercase text-on-surface-variant">Destino</span>
          <div className="rounded-lg border border-white/5 bg-white/5 p-md">
            <p className="mb-1 text-sm font-semibold text-on-background">{shipment.buyer}</p>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {shipment.destination}
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

export default function EnviosPage() {
  const [selected, setSelected] = useState<Shipment | null>(shipments[1] ?? null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <TopBar title="Envios" />
      <main className="relative flex flex-1 overflow-y-auto p-margin">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-gutter pr-gutter">
          <div>
            <h2 className="mb-sm text-h1 font-semibold text-on-background">Envios</h2>
            <p className="text-sm text-on-surface-variant">Gerencie e rastreie seus envios ativos.</p>
          </div>

          <div className="grid grid-cols-2 gap-gutter md:grid-cols-4">
            <SummaryCard label="Em Trânsito" value={847} icon="local_shipping" tone="primary" active />
            <SummaryCard label="Entregues" value={612} icon="check_circle" tone="secondary" />
            <SummaryCard label="Problema" value={23} icon="error" tone="error" />
            <SummaryCard label="Pendente" value={365} icon="pending_actions" tone="tertiary" />
          </div>

          <div className="glass-card flex items-center justify-between rounded-xl p-md">
            <div className="flex items-center gap-md">
              <div className="relative">
                <Icon name="search" size={20} className="absolute left-sm top-1/2 -translate-y-1/2 text-outline" />
                <input
                  className="h-10 w-64 rounded-lg border border-white/10 bg-[#050507] pl-xl pr-md text-sm text-on-background outline-none transition-all focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                  placeholder="Buscar rastreio..."
                />
              </div>
              <select className="relative h-10 appearance-none rounded-lg border border-white/10 bg-[#050507] px-md py-sm pr-xl text-sm text-on-background outline-none transition-all focus:ring-1 focus:ring-[#3b82f6]">
                <option>Todos os Status</option>
                <option>Em Trânsito</option>
                <option>Entregues</option>
              </select>
              <select className="h-10 appearance-none rounded-lg border border-white/10 bg-[#050507] px-md py-sm pr-xl text-sm text-on-background outline-none transition-all focus:ring-1 focus:ring-[#3b82f6]">
                <option>Últimos 30 dias</option>
                <option>Últimos 7 dias</option>
              </select>
            </div>
            <button className="flex h-10 items-center gap-xs rounded-lg border border-white/10 bg-transparent px-md py-sm text-xs font-medium text-on-background transition-all hover:bg-white/5">
              <Icon name="download" size={18} />
              Exportar CSV
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
                        className={`px-lg py-md text-xs font-medium uppercase text-white/50 ${i === 5 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => {
                    const isActive = selected?.tracking === s.tracking
                    return (
                      <tr
                        key={s.tracking}
                        onClick={() => setSelected(s)}
                        className={`group cursor-pointer border-b border-white/5 transition-colors ${
                          s.errored ? 'bg-error/10 hover:bg-error/20' : 'hover:bg-white/5'
                        } ${isActive ? 'bg-white/5 ring-1 ring-inset ring-[#3b82f6]/30' : ''}`}
                      >
                        <td className={`px-lg py-md font-mono text-xs ${s.errored ? 'text-error' : 'text-primary'}`}>
                          {s.tracking}
                        </td>
                        <td className="px-lg py-md text-on-background">{s.buyer}</td>
                        <td className="px-lg py-md text-on-surface-variant">{s.destination}</td>
                        <td className="px-lg py-md">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadge[s.status]}`}>
                            {statusLabel[s.status]}
                          </span>
                        </td>
                        <td className={`px-lg py-md ${s.delayed ? 'text-error' : 'text-on-surface-variant'}`}>
                          {s.deadline}
                        </td>
                        <td className="px-lg py-md text-right text-on-background">{s.cost}</td>
                      </tr>
                    )
                  })}
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
