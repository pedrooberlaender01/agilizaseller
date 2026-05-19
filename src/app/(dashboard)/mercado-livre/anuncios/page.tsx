import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

type Listing = {
  sku: string
  title: string
  status: 'ativo' | 'pausado'
  type?: 'Ouro Pro'
  price: string
  margin?: string
  marginNegative?: boolean
  sales: number
  stock: number
  icon: string
  selected?: boolean
}

const listings: Listing[] = [
  { sku: 'TWS-PRO-BLK-01', title: 'Fone Bluetooth TWS Pro com Cancelamento de Ruído', status: 'ativo', type: 'Ouro Pro', price: 'R$ 189,90', margin: '21,1%', sales: 142, stock: 12, icon: 'headphones', selected: true },
  { sku: 'SMW-M5-BLK', title: 'Smartwatch Fitness Tracker M5 Preto', status: 'ativo', price: 'R$ 95,00', marginNegative: true, sales: 89, stock: 45, icon: 'watch' },
  { sku: 'CBL-USBC-2M', title: 'Cabo USB-C Rápido 2 Metros Nylon Reforçado', status: 'pausado', price: 'R$ 29,90', margin: '35,2%', sales: 412, stock: 0, icon: 'cable' },
  { sku: 'KBD-MEC-RGB', title: 'Teclado Mecânico Gamer Switch Azul RGB', status: 'ativo', price: 'R$ 249,00', margin: '18,5%', sales: 0, stock: 0, icon: 'keyboard' },
  { sku: 'MSE-GMR-10K', title: 'Mouse Gamer 10000 DPI Ergonômico', status: 'ativo', price: 'R$ 129,90', margin: '24,0%', sales: 0, stock: 0, icon: 'mouse' },
  { sku: 'SPK-BT-20W', title: 'Caixa de Som Bluetooth Portátil 20W', status: 'ativo', price: 'R$ 159,00', marginNegative: true, sales: 0, stock: 0, icon: 'speaker' },
]

function ListingCard({ item }: { item: Listing }) {
  return (
    <div
      className={
        'glass-card group relative flex cursor-pointer flex-col gap-md overflow-hidden rounded-xl p-md transition-transform duration-300 hover:-translate-y-1 ' +
        (item.selected ? 'border-[#3b82f6]/50' : 'hover:border-white/20')
      }
    >
      {item.selected ? <div className="pointer-events-none absolute inset-0 bg-[#3b82f6]/5" /> : null}

      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-surface-container-highest">
        <Icon name={item.icon} className="text-4xl text-outline-variant opacity-50" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {item.status === 'ativo' ? (
            <span className="rounded border border-secondary/30 bg-secondary-container/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary backdrop-blur-sm">
              Ativo
            </span>
          ) : (
            <span className="rounded border border-outline/30 bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-outline backdrop-blur-sm">
              Pausado
            </span>
          )}
          {item.type ? (
            <span className="rounded border border-tertiary/30 bg-tertiary-container/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-tertiary backdrop-blur-sm">
              {item.type}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3
          className={
            'line-clamp-2 text-base font-semibold transition-colors ' +
            (item.status === 'pausado' ? 'text-outline' : 'text-on-surface group-hover:text-[#3b82f6]')
          }
        >
          {item.title}
        </h3>
        <span className="text-xs text-outline-variant">SKU: {item.sku}</span>
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-white/5 pt-2">
        <div className="flex flex-col">
          <span className="text-xs text-outline">Preço Venda</span>
          <span className="text-h2 font-semibold text-on-surface">{item.price}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-outline">Margem</span>
          {item.marginNegative ? (
            <span className="flex items-center gap-1 text-sm font-medium text-error">
              <Icon name="warning" size={14} /> Sem custo
            </span>
          ) : (
            <span className="text-sm font-medium text-secondary">{item.margin}</span>
          )}
        </div>
      </div>

      {item.sales > 0 ? (
        <div className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5">
          <div className="flex items-center gap-1 text-outline">
            <Icon name="shopping_bag" size={14} />
            <span className="text-[11px]">{item.sales} vendas</span>
          </div>
          <div className={'flex items-center gap-1 ' + (item.stock === 0 ? 'text-error' : 'text-outline')}>
            <Icon name="inventory_2" size={14} />
            <span className="text-[11px]">{item.stock} em estoque</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CostDrawer() {
  return (
    <aside className="glass-card sticky top-[72px] hidden h-[calc(100vh-128px)] w-[380px] shrink-0 flex-col overflow-y-auto rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 md:flex">
      <div className="flex items-start justify-between border-b border-white/10 bg-surface-container-highest/30 p-lg">
        <div className="flex flex-col gap-1 pr-4">
          <span className="text-xs text-outline-variant">TWS-PRO-BLK-01</span>
          <h2 className="text-h2 font-semibold leading-tight text-on-surface">Fone Bluetooth TWS Pro</h2>
        </div>
        <button className="rounded-full bg-black/20 p-1 text-outline transition-colors hover:text-white">
          <Icon name="close" />
        </button>
      </div>

      <div className="flex flex-col gap-lg p-lg">
        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-surface-container-highest">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#3b82f6]/10 to-transparent" />
          <Icon name="headphones" className="text-6xl text-outline-variant opacity-30" />
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-outline backdrop-blur">
            No Image
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Preço de Venda</span>
            <span className="text-base font-semibold text-[#3b82f6]">R$ 189,90</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Categoria</span>
            <span className="text-sm text-on-surface">Eletrônicos &gt; Áudio</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Performance</span>
            <div className="flex gap-4 text-sm text-on-surface">
              <span><span className="mr-1 text-outline">V:</span>142</span>
              <span><span className="mr-1 text-outline">E:</span>12</span>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/10 bg-[#050507] p-md">
          <div className="absolute left-0 top-0 h-full w-1 bg-[#3b82f6]" />
          <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            <Icon name="edit_document" className="text-[18px] text-[#3b82f6]" />
            Composição de Custo
          </h3>
          <div className="grid grid-cols-2 gap-md">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-outline">Custo Unitário (R$)</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-right text-sm text-on-surface outline-none transition-colors focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                defaultValue="85,00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-outline">Embalagem (R$)</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-right text-sm text-on-surface outline-none transition-colors focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                defaultValue="2,50"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-outline">Imposto / Simples (%)</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-right text-sm text-on-surface outline-none transition-colors focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                defaultValue="6,5"
              />
            </div>
          </div>
          <button className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/10">
            Salvar custo
          </button>
        </div>

        <div className="flex flex-col gap-sm rounded-xl border border-white/5 bg-surface-container-highest/40 p-md">
          <div className="flex items-center justify-between text-sm">
            <span className="text-outline">Taxa Marketplace (16%)</span>
            <span className="font-mono text-error-container">- R$ 30,38</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-outline">Custo Fixo Venda</span>
            <span className="font-mono text-error-container">- R$ 6,00</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
            <span className="text-outline">Impostos (6,5%)</span>
            <span className="font-mono text-error-container">- R$ 12,34</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-base font-semibold text-on-surface">Lucro Líquido</span>
            <div className="flex flex-col items-end">
              <span className="text-base font-semibold text-secondary">R$ 40,08</span>
              <span className="mt-1 rounded bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
                Margem: 21,1%
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function AnunciosPage() {
  return (
    <>
      <TopBar title="Anúncios — Mercado Livre" />
      <main className="flex items-start gap-gutter p-margin">
        <div className="flex min-w-0 flex-1 flex-col gap-lg">
          <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-white/5 bg-surface-container/40 p-md backdrop-blur-sm">
            <div className="flex min-w-[300px] flex-1 flex-wrap items-center gap-sm">
              <div className="relative min-w-[220px] max-w-md flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline" />
                <input
                  className="w-full rounded-lg border border-white/10 bg-surface-container py-2 pl-9 pr-3 text-sm text-on-surface placeholder-outline-variant outline-none transition-all focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                  placeholder="Buscar por título ou SKU"
                />
              </div>
              <select className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-[#3b82f6]">
                <option>Status: Todos</option>
                <option>Ativos</option>
                <option>Pausados</option>
              </select>
              <select className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-[#3b82f6]">
                <option>Tipo: Todos</option>
                <option>Clássico</option>
                <option>Premium</option>
              </select>
            </div>

            <div className="flex items-center gap-md">
              <span className="hidden text-sm text-on-surface-variant xl:inline-block">32 anúncios</span>
              <div className="flex items-center rounded-lg border border-white/10 bg-surface-container p-1">
                <button className="flex items-center justify-center rounded bg-white/10 p-1 text-[#3b82f6] shadow-sm">
                  <Icon name="grid_view" filled size={14} />
                </button>
                <button className="flex items-center justify-center rounded p-1 text-outline transition-colors hover:text-on-surface">
                  <Icon name="view_list" size={14} />
                </button>
              </div>
              <select className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-[#3b82f6]">
                <option>Mais vendidos</option>
                <option>Maior estoque</option>
                <option>Menor estoque</option>
              </select>
              <button className="flex items-center gap-2 rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-[#2563eb]">
                <Icon name="add_circle" size={14} />
                Cadastrar custos em massa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) => (
              <ListingCard key={item.sku} item={item} />
            ))}
          </div>
        </div>

        <CostDrawer />
      </main>
    </>
  )
}
