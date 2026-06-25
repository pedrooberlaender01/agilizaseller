'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

export type MlItemRow = {
  id: string
  external_id: string
  seller_sku: string | null
  title: string | null
  category_id: string | null
  price: number | string
  available_quantity: number | null
  sold_quantity: number | null
  listing_type_id: string | null
  status: string
  permalink: string | null
  thumbnail: string | null
}

type SortKey = 'bestseller' | 'low-stock' | 'high-price' | 'low-price'

const listingTypeLabel: Record<string, string> = {
  gold_pro: 'Ouro Pro',
  gold_premium: 'Ouro Premium',
  gold_special: 'Clássico',
  gold: 'Ouro',
  silver: 'Prata',
  bronze: 'Bronze',
  free: 'Grátis',
}

const sortLabels: Record<SortKey, string> = {
  bestseller: 'Mais vendidos',
  'low-stock': 'Menor estoque',
  'high-price': 'Maior preço',
  'low-price': 'Menor preço',
}

const fmtBrl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function ItemThumb({ url, large = false }: { url: string | null; large?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />
  }
  return (
    <div className={cn('flex h-full w-full items-center justify-center', large && 'relative')}>
      {large && <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#3b82f6]/10 to-transparent" />}
      <Icon name="inventory_2" className={cn(large ? 'text-6xl' : 'text-4xl', 'text-outline-variant opacity-50')} />
    </div>
  )
}

function ListingCard({ item, selected, onClick }: { item: MlItemRow; selected: boolean; onClick: () => void }) {
  const isActive = item.status === 'active'
  const typeLabel = item.listing_type_id ? listingTypeLabel[item.listing_type_id] ?? null : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'glass-card group relative flex cursor-pointer flex-col gap-md overflow-hidden rounded-xl p-md text-left transition-transform duration-300 hover:-translate-y-1',
        selected ? 'border-[#3b82f6]/50' : 'hover:border-white/20',
      )}
    >
      {selected ? <div className="pointer-events-none absolute inset-0 bg-[#3b82f6]/5" /> : null}

      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-surface-container-highest">
        <ItemThumb url={item.thumbnail} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {isActive ? (
            <span className="rounded border border-secondary/30 bg-secondary-container/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary backdrop-blur-sm">
              Ativo
            </span>
          ) : (
            <span className="rounded border border-outline/30 bg-surface-container-highest px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-outline backdrop-blur-sm">
              Pausado
            </span>
          )}
          {typeLabel ? (
            <span className="rounded border border-tertiary/30 bg-tertiary-container/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-tertiary backdrop-blur-sm">
              {typeLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3
          className={cn(
            'line-clamp-2 text-base font-semibold transition-colors',
            isActive ? 'text-on-surface group-hover:text-[#3b82f6]' : 'text-outline',
          )}
        >
          {item.title}
        </h3>
        <span className="text-xs text-outline-variant">SKU: {item.seller_sku ?? '—'}</span>
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-white/5 pt-2">
        <div className="flex flex-col">
          <span className="text-xs text-outline">Preço Venda</span>
          <span className="text-h2 font-semibold text-on-surface">{fmtBrl(Number(item.price))}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-outline">Margem</span>
          <span className="flex items-center gap-1 text-sm font-medium text-error">
            <Icon name="warning" size={14} /> Sem custo
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5">
        <div className="flex items-center gap-1 text-outline">
          <Icon name="shopping_bag" size={14} />
          <span className="text-[11px]">{item.sold_quantity ?? 0} vendas</span>
        </div>
        <div className={cn('flex items-center gap-1', item.available_quantity === 0 ? 'text-error' : 'text-outline')}>
          <Icon name="inventory_2" size={14} />
          <span className="text-[11px]">{item.available_quantity ?? 0} em estoque</span>
        </div>
      </div>
    </button>
  )
}

function CostDrawer({ item, onClose }: { item: MlItemRow; onClose: () => void }) {
  const typeLabel = item.listing_type_id ? listingTypeLabel[item.listing_type_id] ?? item.listing_type_id : '—'
  return (
    <aside className="glass-card sticky top-[72px] hidden h-[calc(100vh-128px)] w-[380px] shrink-0 flex-col overflow-y-auto rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 md:flex">
      <div className="flex items-start justify-between border-b border-white/10 bg-surface-container-highest/30 p-lg">
        <div className="flex flex-col gap-1 pr-4">
          <span className="text-xs text-outline-variant">{item.seller_sku ?? item.external_id}</span>
          <h2 className="line-clamp-3 text-h2 font-semibold leading-tight text-on-surface">{item.title}</h2>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full bg-black/20 p-1 text-outline transition-colors hover:text-white">
          <Icon name="close" />
        </button>
      </div>

      <div className="flex flex-col gap-lg p-lg">
        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-surface-container-highest">
          <ItemThumb url={item.thumbnail} large />
          {!item.thumbnail && (
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-outline backdrop-blur">
              Sem imagem
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Preço de Venda</span>
            <span className="text-base font-semibold text-[#3b82f6]">{fmtBrl(Number(item.price))}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Tipo de Anúncio</span>
            <span className="text-sm text-on-surface">{typeLabel}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Categoria</span>
            <span className="font-mono text-xs text-on-surface">{item.category_id ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Performance</span>
            <div className="flex gap-4 text-sm text-on-surface">
              <span><span className="mr-1 text-outline">V:</span>{item.sold_quantity ?? 0}</span>
              <span><span className="mr-1 text-outline">E:</span>{item.available_quantity ?? 0}</span>
            </div>
          </div>
          {item.permalink && (
            <a
              href={item.permalink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-on-surface transition-colors hover:bg-white/10"
            >
              <Icon name="open_in_new" size={14} />
              Abrir no Mercado Livre
            </a>
          )}
        </div>

        <div className="flex flex-col gap-sm rounded-xl border border-white/5 bg-surface-container-highest/40 p-md">
          <div className="flex items-start gap-2 text-sm text-tertiary">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <span className="text-xs text-on-surface-variant">
              Cálculo de custo e margem indisponível. Cadastre o custo do produto para liberar o lucro líquido por anúncio.
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-2">
            <span className="text-base font-semibold text-on-surface">Lucro Líquido</span>
            <span className="text-base font-semibold text-on-surface-variant">—</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function AnunciosView({ items }: { items: MlItemRow[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [sort, setSort] = useState<SortKey>('bestseller')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let arr = items.filter((it) => {
      const matchesTerm =
        !term ||
        (it.title?.toLowerCase().includes(term) ?? false) ||
        (it.seller_sku?.toLowerCase().includes(term) ?? false)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && it.status === 'active') ||
        (statusFilter === 'paused' && it.status !== 'active')
      return matchesTerm && matchesStatus
    })

    arr = [...arr].sort((a, b) => {
      switch (sort) {
        case 'bestseller': return (b.sold_quantity ?? 0) - (a.sold_quantity ?? 0)
        case 'low-stock': return (a.available_quantity ?? 0) - (b.available_quantity ?? 0)
        case 'high-price': return Number(b.price) - Number(a.price)
        case 'low-price': return Number(a.price) - Number(b.price)
      }
    })
    return arr
  }, [items, search, statusFilter, sort])

  const selected = items.find((i) => i.id === selectedId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface-container py-2 pl-9 pr-3 text-sm text-on-surface placeholder-outline-variant outline-none transition-all focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                  placeholder="Buscar por título ou SKU"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'paused')}
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-[#3b82f6]"
              >
                <option value="all">Status: Todos</option>
                <option value="active">Ativos</option>
                <option value="paused">Pausados</option>
              </select>
            </div>

            <div className="flex items-center gap-md">
              <span className="hidden text-sm text-on-surface-variant xl:inline-block">
                {filtered.length} {filtered.length === 1 ? 'anúncio' : 'anúncios'}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-[#3b82f6]"
              >
                {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                  <option key={k} value={k}>{sortLabels[k]}</option>
                ))}
              </select>
              <button className="flex items-center gap-2 rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-medium text-white shadow-lg shadow-blue-900/20 transition-colors hover:bg-[#2563eb]">
                <Icon name="add_circle" size={14} />
                <span className="hidden sm:inline">Cadastrar custos em massa</span>
                <span className="sm:hidden">Custos</span>
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card flex flex-col items-center gap-2 rounded-xl p-xl text-center">
              <Icon name="search_off" className="text-3xl text-outline-variant" />
              <p className="text-sm text-on-surface-variant">Nenhum anúncio encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onClick={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {selected && <CostDrawer item={selected} onClose={() => setSelectedId(null)} />}
      </main>
    </>
  )
}
