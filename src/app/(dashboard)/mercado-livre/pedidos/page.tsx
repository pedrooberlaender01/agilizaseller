import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

type ShipStatus = 'em-transito' | 'preparando' | 'aguardando' | 'entregue' | 'cancelado'
type PayStatus = 'pago' | 'cancelado'

type Order = {
  id: string
  buyer: string
  items: string
  total: string
  profit: string
  margin: string
  payStatus: PayStatus
  shipStatus: ShipStatus
  date: string
  selected?: boolean
  zebra?: boolean
  loss?: boolean
}

const orders: Order[] = [
  { id: '2000000123456789', buyer: 'TECH_GADGETS_BR', items: '2 itens', total: 'R$ 284,90', profit: 'R$ 71,20', margin: '25,0%', payStatus: 'pago', shipStatus: 'em-transito', date: 'Hoje, 14:30', selected: true },
  { id: '2000000123456790', buyer: 'MARIA_SILVA_99', items: '1 item', total: 'R$ 150,00', profit: 'R$ 45,00', margin: '30,0%', payStatus: 'pago', shipStatus: 'preparando', date: 'Hoje, 12:15' },
  { id: '2000000123456791', buyer: 'GAMER_PRO_STORE', items: '4 itens', total: 'R$ 1.250,00', profit: 'R$ 250,00', margin: '20,0%', payStatus: 'pago', shipStatus: 'aguardando', date: 'Ontem, 18:45', zebra: true },
  { id: '2000000123456792', buyer: 'JOAO_SOUZA_12', items: '1 item', total: 'R$ 89,90', profit: 'R$ 15,00', margin: '16,6%', payStatus: 'pago', shipStatus: 'entregue', date: 'Ontem, 10:20' },
  { id: '2000000123456793', buyer: 'CASA_DECOR_SP', items: '3 itens', total: 'R$ 450,00', profit: 'R$ 112,50', margin: '25,0%', payStatus: 'pago', shipStatus: 'em-transito', date: '02/11/2023', zebra: true },
  { id: '2000000123456794', buyer: 'LUCAS_FERNANDES', items: '1 item', total: 'R$ 120,00', profit: 'R$ -5,00', margin: '-4,1%', payStatus: 'cancelado', shipStatus: 'cancelado', date: '01/11/2023', loss: true },
]

const shipBadge: Record<ShipStatus, { label: string; cls: string }> = {
  'em-transito': { label: 'Em trânsito', cls: 'bg-[#3b82f6]/10 text-[#3b82f6]' },
  preparando: { label: 'Preparando', cls: 'bg-white/10 text-slate-300' },
  aguardando: { label: 'Aguardando', cls: 'bg-surface-container-highest text-slate-300 border border-white/10' },
  entregue: { label: 'Entregue', cls: 'bg-secondary/10 text-secondary' },
  cancelado: { label: 'Cancelado', cls: 'bg-surface-container-highest text-slate-400 border border-white/10' },
}

function OrderDrawer() {
  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-[380px] flex-col overflow-y-auto border-l border-white/10 bg-[#0d1117]" style={{ boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.1)' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1117]/90 p-6 backdrop-blur-md">
        <div>
          <h3 className="text-base font-semibold text-white">Pedido #2000000123456789</h3>
          <p className="mt-1 text-sm text-slate-400">Hoje, 14:30 • Mercado Livre</p>
        </div>
        <button className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
          <Icon name="close" />
        </button>
      </div>

      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6]/20 text-[#3b82f6]">
            <Icon name="local_shipping" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#3b82f6]">Em trânsito</p>
            <p className="text-sm text-slate-300">Previsão de entrega: Amanhã</p>
            <p className="mt-1 font-mono text-xs text-slate-400">BR123456789ML</p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Comprador</h4>
          <div className="glass-card rounded-lg p-4">
            <p className="text-sm font-medium text-white">TECH_GADGETS_BR</p>
            <p className="text-sm text-slate-300">Carlos Eduardo Silva</p>
            <p className="mt-2 text-sm text-slate-400">
              Rua das Flores, 123 - Apto 45
              <br />
              São Paulo, SP - 01234-567
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Itens (2)</h4>
          <div className="glass-card divide-y divide-white/10 rounded-lg">
            <div className="flex gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded border border-white/10 bg-white/5">
                <Icon name="headphones" className="text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">Fone Bluetooth Pro</p>
                <p className="text-sm text-slate-400">SKU: FBP-001 • Qtd: 1</p>
              </div>
              <p className="text-sm font-medium text-white">R$ 250,00</p>
            </div>
            <div className="flex gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded border border-white/10 bg-white/5">
                <Icon name="cable" className="text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">Cabo USB-C Trançado</p>
                <p className="text-sm text-slate-400">SKU: CAB-002 • Qtd: 1</p>
              </div>
              <p className="text-sm font-medium text-white">R$ 34,90</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Resumo Financeiro</h4>
          <div className="glass-card space-y-2 rounded-lg p-4">
            <div className="flex justify-between text-sm text-slate-300">
              <span>Subtotal Itens</span>
              <span>R$ 284,90</span>
            </div>
            <div className="flex justify-between text-sm text-slate-300">
              <span>Frete Cobrado</span>
              <span>R$ 15,00</span>
            </div>
            <div className="my-2 border-t border-white/10" />
            <div className="flex justify-between text-sm text-error">
              <span>Taxa Mercado Livre (16%)</span>
              <span>- R$ 45,58</span>
            </div>
            <div className="flex justify-between text-sm text-error">
              <span>Custo do Frete</span>
              <span>- R$ 18,00</span>
            </div>
            <div className="flex justify-between text-sm text-error">
              <span>Impostos (DAS)</span>
              <span>- R$ 15,12</span>
            </div>
            <div className="flex justify-between text-sm text-error">
              <span>Custo do Produto (CMV)</span>
              <span>- R$ 150,00</span>
            </div>
            <div className="my-2 border-t border-white/10" />
            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-semibold text-white">Lucro Líquido</span>
              <div className="text-right">
                <span className="text-h2 font-semibold text-secondary">R$ 71,20</span>
                <p className="text-xs font-medium text-secondary">Margem: 25,0%</p>
              </div>
            </div>
          </div>
        </div>
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

export default function PedidosPage() {
  return (
    <>
      <TopBar title="Pedidos — Mercado Livre" />
      <main className="overflow-y-auto p-margin pr-[420px]">
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-[240px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                className="w-full rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                placeholder="Buscar pedido, cliente..."
              />
            </div>
            <select className="relative appearance-none rounded-lg border border-white/10 bg-[#050507] px-4 py-2 pr-8 text-sm text-white outline-none focus:border-[#3b82f6]">
              <option>Status: Todos</option>
              <option>Pago</option>
              <option>Pendente</option>
            </select>
            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
              <button className="rounded px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-white">7 dias</button>
              <button className="rounded bg-white/10 px-3 py-1 text-xs font-medium text-white">30 dias</button>
              <button className="rounded px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-white">90 dias</button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400">1.847 pedidos encontrados</span>
            <button className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/5">
              <Icon name="download" size={18} />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="mb-lg flex gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
            Status: Pago
            <Icon name="close" size={14} className="cursor-pointer hover:text-white" />
          </div>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                {['ID DO PEDIDO', 'COMPRADOR', 'ITENS', 'TOTAL', 'LUCRO', 'MARGEM', 'STATUS', 'ENVIO', 'DATA'].map((h) => (
                  <th key={h} className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.map((o) => {
                const ship = shipBadge[o.shipStatus]
                const rowBg = o.selected ? 'bg-white/5' : o.zebra ? 'bg-white/[0.02]' : ''
                const profitColor = o.loss ? 'text-error' : 'text-secondary'
                return (
                  <tr
                    key={o.id}
                    className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5 ${rowBg}`}
                  >
                    <td className={`px-6 py-4 font-mono ${o.selected ? 'text-[#3b82f6]' : 'text-slate-300'}`}>{o.id}</td>
                    <td className="px-6 py-4">{o.buyer}</td>
                    <td className="px-6 py-4">{o.items}</td>
                    <td className="px-6 py-4 font-medium">{o.total}</td>
                    <td className={`px-6 py-4 font-medium ${profitColor}`}>{o.profit}</td>
                    <td className={`px-6 py-4 ${profitColor}`}>{o.margin}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          o.payStatus === 'pago' ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
                        }`}
                      >
                        {o.payStatus === 'pago' ? 'Pago' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${ship.cls}`}>{ship.label}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{o.date}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            <span className="text-sm text-slate-400">Mostrando 1-6 de 1.847</span>
            <div className="flex items-center gap-2">
              <button className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50">
                Anterior
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded bg-[#3b82f6] text-xs font-medium text-white">
                1
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-slate-300 transition-colors hover:bg-white/5">
                2
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-slate-300 transition-colors hover:bg-white/5">
                3
              </button>
              <span className="text-slate-400">...</span>
              <button className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
                Próximo
              </button>
            </div>
          </div>
        </div>
      </main>

      <OrderDrawer />
    </>
  )
}
