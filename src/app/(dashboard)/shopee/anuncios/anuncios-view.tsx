'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { saveProductCost } from '@/app/actions/shopee'
import type { ShopeeItem } from '@/types'

type ItemStatus = 'NORMAL' | 'UNLIST' | 'BANNED' | 'DELETED'
type SortKey = 'bestseller' | 'low-stock' | 'high-price' | 'low-price'
type ViewMode = 'grid' | 'list'

export type CostEntry = {
  cost_unit: number
  packaging_cost: number
  tax_rate: number
}

type EnrichedItem = ShopeeItem & {
  thumb_url: string | null
  permalink: string | null
  cost_unit: number | null
  packaging_cost: number | null
  tax_rate: number | null
}

const SHOPEE_COMMISSION_RATE = 0.20
const VIEW_KEY = 'shopee_anuncios_view'

const statusBadge: Record<ItemStatus, string> = {
  NORMAL: 'bg-secondary/15 text-secondary border border-secondary/30',
  UNLIST: 'bg-outline/20 text-outline border border-outline/30',
  BANNED: 'bg-error/15 text-error border border-error/30',
  DELETED: 'bg-error/30 text-error border border-error/40',
}

const statusLabel: Record<ItemStatus, string> = {
  NORMAL: 'Ativo',
  UNLIST: 'Despublicado',
  BANNED: 'Banido',
  DELETED: 'Deletado',
}

const sortLabels: Record<SortKey, string> = {
  bestseller: 'Mais vendidos',
  'low-stock': 'Menor estoque',
  'high-price': 'Maior preço',
  'low-price': 'Menor preço',
}

const fmtBrl = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function stockTone(stock: number | null): { text: string; tone: string; warn: boolean; pending: boolean } {
  if (stock === null) return { text: 'Estoque pendente', tone: 'text-outline-variant', warn: false, pending: true }
  if (stock === 0) return { text: 'Sem estoque', tone: 'text-error', warn: true, pending: false }
  if (stock < 5) return { text: `${stock} em estoque`, tone: 'text-error', warn: true, pending: false }
  if (stock <= 20) return { text: `${stock} em estoque`, tone: 'text-tertiary', warn: false, pending: false }
  return { text: `${stock} em estoque`, tone: 'text-outline', warn: false, pending: false }
}

function calcMargin(item: EnrichedItem): { profit: number; pct: number } | null {
  if (item.price === null || item.cost_unit === null) return null
  const commission = item.price * SHOPEE_COMMISSION_RATE
  const tax = item.tax_rate ? item.price * (item.tax_rate / 100) : 0
  const packaging = item.packaging_cost ?? 0
  const profit = item.price - commission - tax - item.cost_unit - packaging
  const pct = (profit / item.price) * 100
  return { profit, pct }
}

function pendingSync(item: EnrichedItem): boolean {
  return item.price === null || item.stock === null || item.sold_quantity === null
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function StatusPill({ status }: { status: ItemStatus }) {
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm', statusBadge[status])}>
      {statusLabel[status]}
    </span>
  )
}

function ItemThumb({ url, large = false }: { url: string | null; large?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-full w-full object-cover" />
  }
  return (
    <div className={cn('flex h-full w-full items-center justify-center', large && 'relative')}>
      {large && <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-tertiary/10 to-transparent" />}
      <Icon name="inventory_2" className={cn(large ? 'text-6xl' : 'text-4xl', 'text-outline-variant opacity-40')} />
    </div>
  )
}

function ListingCard({ item, selected, onClick }: { item: EnrichedItem; selected: boolean; onClick: () => void }) {
  const margin = calcMargin(item)
  const stock = stockTone(item.stock)
  const pending = pendingSync(item)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'glass-card group relative flex flex-col gap-md overflow-hidden rounded-xl p-md text-left transition-transform duration-300 hover:-translate-y-1',
        selected ? 'border-tertiary/50' : 'hover:border-white/20',
      )}
    >
      {selected ? <div className="pointer-events-none absolute inset-0 bg-tertiary/5" /> : null}

      <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-surface-container-highest">
        <ItemThumb url={item.thumb_url} />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <StatusPill status={(item.item_status as ItemStatus) ?? 'NORMAL'} />
          {item.has_model && (
            <span className="rounded border border-primary/30 bg-primary-container/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary backdrop-blur-sm">
              Variações
            </span>
          )}
        </div>
        {pending && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded border border-tertiary/30 bg-black/60 px-1.5 py-0.5 text-[10px] text-tertiary backdrop-blur-sm">
            <Icon name="sync_problem" size={11} />
            Sync pendente
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3
          className={cn(
            'line-clamp-2 text-base font-semibold leading-snug transition-colors',
            item.item_status === 'NORMAL' ? 'text-on-surface group-hover:text-tertiary' : 'text-outline',
          )}
        >
          {item.title}
        </h3>
        <span className="font-mono text-[11px] text-outline-variant">SKU: {item.item_sku ?? '—'}</span>
      </div>

      <div className="mt-auto flex items-end justify-between border-t border-white/5 pt-2">
        <div className="flex flex-col">
          <span className="text-xs text-outline">Preço</span>
          <span className="text-h2 font-semibold text-on-surface">
            {item.price !== null ? fmtBrl(item.price) : <span className="text-outline-variant">—</span>}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-outline">Margem est.</span>
          {margin ? (
            <span
              className={cn(
                'text-sm font-medium',
                margin.pct >= 20 ? 'text-secondary' : margin.pct >= 5 ? 'text-tertiary' : 'text-error',
              )}
            >
              {margin.pct.toFixed(1)}%
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-medium text-error">
              <Icon name="warning" size={14} /> Sem custo
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded bg-black/20 px-2 py-1.5">
        <div className="flex items-center gap-1 text-outline">
          <Icon name="shopping_bag" size={14} />
          <span className="text-[11px]">{item.sold_quantity ?? '—'} vendas</span>
        </div>
        <div className={cn('flex items-center gap-1', stock.tone)}>
          <Icon name="inventory_2" size={14} />
          <span className="text-[11px]">{stock.text}</span>
        </div>
      </div>
    </button>
  )
}

function ListingRow({ item, selected, onClick }: { item: EnrichedItem; selected: boolean; onClick: () => void }) {
  const margin = calcMargin(item)
  const stock = stockTone(item.stock)
  const pending = pendingSync(item)

  return (
    <tr
      onClick={onClick}
      className={cn(
        'group cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5',
        selected && 'bg-white/5 ring-1 ring-inset ring-tertiary/30',
      )}
    >
      <td className="px-md py-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-white/5 bg-surface-container-highest">
          <ItemThumb url={item.thumb_url} />
        </div>
      </td>
      <td className="px-md py-3">
        <div className="flex flex-col">
          <span className="line-clamp-1 max-w-[320px] text-sm font-medium text-on-surface">{item.title}</span>
          <span className="font-mono text-[11px] text-outline-variant">{item.item_sku ?? '—'}</span>
        </div>
      </td>
      <td className="px-md py-3">
        <StatusPill status={(item.item_status as ItemStatus) ?? 'NORMAL'} />
      </td>
      <td className="px-md py-3 text-right font-mono-sm text-on-surface">
        {item.price !== null ? fmtBrl(item.price) : <span className="text-outline-variant">—</span>}
      </td>
      <td className={cn('px-md py-3 text-right font-mono-sm', stock.tone)}>{stock.text}</td>
      <td className="px-md py-3 text-right text-on-surface-variant">{item.sold_quantity ?? '—'}</td>
      <td className="px-md py-3 text-right">
        {margin ? (
          <span
            className={cn(
              'text-sm font-medium',
              margin.pct >= 20 ? 'text-secondary' : margin.pct >= 5 ? 'text-tertiary' : 'text-error',
            )}
          >
            {margin.pct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-error">—</span>
        )}
      </td>
      <td className="px-md py-3">
        {pending && (
          <span title="Dados de preço/estoque pendentes de sync completo" className="flex items-center gap-1 text-tertiary">
            <Icon name="sync_problem" size={14} />
          </span>
        )}
      </td>
    </tr>
  )
}

function CostDrawer({ item, onClose }: { item: EnrichedItem; onClose: () => void }) {
  const [costUnit, setCostUnit] = useState(item.cost_unit?.toString().replace('.', ',') ?? '')
  const [packaging, setPackaging] = useState(item.packaging_cost?.toString().replace('.', ',') ?? '')
  const [taxRate, setTaxRate] = useState(item.tax_rate?.toString().replace('.', ',') ?? '6,5')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    setCostUnit(item.cost_unit?.toString().replace('.', ',') ?? '')
    setPackaging(item.packaging_cost?.toString().replace('.', ',') ?? '')
    setTaxRate(item.tax_rate?.toString().replace('.', ',') ?? '6,5')
    setSaveStatus('idle')
    setErrorMsg(null)
  }, [item])

  const parsed = {
    cost: parseFloat(costUnit.replace(',', '.')) || 0,
    pack: parseFloat(packaging.replace(',', '.')) || 0,
    tax: parseFloat(taxRate.replace(',', '.')) || 0,
  }
  const price = item.price ?? 0
  const commission = price * SHOPEE_COMMISSION_RATE
  const taxAmount = price * (parsed.tax / 100)
  const profit = price - commission - taxAmount - parsed.cost - parsed.pack
  const marginPct = price > 0 ? (profit / price) * 100 : 0

  function handleSave() {
    if (!item.item_sku) {
      setSaveStatus('err')
      setErrorMsg('Item sem SKU — cadastre SKU no Shopee Seller Center.')
      return
    }
    setSaveStatus('saving')
    setErrorMsg(null)
    startTransition(async () => {
      const res = await saveProductCost(item.item_sku!, parsed.cost, parsed.pack, parsed.tax)
      if (res?.ok) {
        setSaveStatus('ok')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('err')
        setErrorMsg(res?.error ?? 'Falha ao salvar')
      }
    })
  }

  return (
    <aside className="glass-card sticky top-[72px] hidden h-[calc(100vh-128px)] w-[380px] shrink-0 flex-col overflow-y-auto rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 md:flex">
      <div className="flex items-start justify-between border-b border-white/10 bg-surface-container-highest/30 p-lg">
        <div className="flex flex-col gap-1 pr-4">
          <span className="font-mono text-xs text-outline-variant">{item.item_sku ?? item.external_id}</span>
          <h2 className="line-clamp-3 text-h2 font-semibold leading-tight text-on-surface">{item.title}</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full bg-black/20 p-1 text-outline transition-colors hover:text-white"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex flex-col gap-lg p-lg">
        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-surface-container-highest">
          <ItemThumb url={item.thumb_url} large />
          {!item.thumb_url && (
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-outline backdrop-blur">
              Sem imagem
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Preço de Venda</span>
            <span className="text-base font-semibold text-tertiary">
              {item.price !== null ? fmtBrl(item.price) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Status</span>
            <StatusPill status={(item.item_status as ItemStatus) ?? 'NORMAL'} />
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Categoria</span>
            <span className="font-mono text-xs text-on-surface">{item.category_id ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 py-2">
            <span className="text-sm text-outline">Performance</span>
            <div className="flex gap-4 text-sm text-on-surface">
              <span><span className="mr-1 text-outline">V:</span>{item.sold_quantity ?? '—'}</span>
              <span><span className="mr-1 text-outline">E:</span>{item.stock ?? '—'}</span>
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
              Abrir na Shopee
            </a>
          )}
        </div>

        <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl border border-white/10 bg-[#050507] p-md">
          <div className="absolute left-0 top-0 h-full w-1 bg-tertiary" />
          <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface">
            <Icon name="edit_document" className="text-[18px] text-tertiary" />
            Composição de Custo
          </h3>
          <div className="grid grid-cols-2 gap-md">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-outline">Custo Unitário (R$)</label>
              <input
                value={costUnit}
                onChange={(e) => setCostUnit(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-right text-sm text-on-surface outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                placeholder="0,00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-outline">Embalagem (R$)</label>
              <input
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-right text-sm text-on-surface outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                placeholder="0,00"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-outline">Imposto / Simples (%)</label>
              <input
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface-container px-3 py-2 text-right text-sm text-on-surface outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                placeholder="6,5"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving' || !item.item_sku}
            className={cn(
              'mt-2 w-full rounded-lg border py-2.5 text-xs font-medium transition-colors',
              saveStatus === 'ok'
                ? 'border-secondary/40 bg-secondary/15 text-secondary'
                : saveStatus === 'err'
                  ? 'border-error/40 bg-error/15 text-error'
                  : 'border-white/10 bg-white/5 text-white hover:bg-white/10',
              saveStatus === 'saving' && 'opacity-60',
              !item.item_sku && 'cursor-not-allowed opacity-40',
            )}
          >
            {saveStatus === 'saving' && 'Salvando…'}
            {saveStatus === 'ok' && '✓ Custo salvo'}
            {saveStatus === 'err' && (errorMsg ?? 'Erro')}
            {saveStatus === 'idle' && (item.item_sku ? 'Salvar custo' : 'SKU ausente — não é possível salvar')}
          </button>
        </div>

        <div className="flex flex-col gap-sm rounded-xl border border-white/5 bg-surface-container-highest/40 p-md">
          <div className="flex items-center justify-between text-sm">
            <span className="text-outline">Comissão Shopee (20%)</span>
            <span className="font-mono text-error-container">- {fmtBrl(commission)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-outline">Custo Produto</span>
            <span className="font-mono text-error-container">- {fmtBrl(parsed.cost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-outline">Embalagem</span>
            <span className="font-mono text-error-container">- {fmtBrl(parsed.pack)}</span>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
            <span className="text-outline">Impostos ({parsed.tax.toFixed(1)}%)</span>
            <span className="font-mono text-error-container">- {fmtBrl(taxAmount)}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-base font-semibold text-on-surface">Lucro Estimado</span>
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  'text-base font-semibold',
                  marginPct >= 20 ? 'text-secondary' : marginPct >= 5 ? 'text-tertiary' : 'text-error',
                )}
              >
                {fmtBrl(profit)}
              </span>
              <span
                className={cn(
                  'mt-1 rounded px-2 py-0.5 text-xs font-medium',
                  marginPct >= 20
                    ? 'bg-secondary/10 text-secondary'
                    : marginPct >= 5
                      ? 'bg-tertiary/10 text-tertiary'
                      : 'bg-error/10 text-error',
                )}
              >
                Margem: {marginPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function AnunciosView({
  items,
  costsBySku,
  shopExternalId,
}: {
  items: ShopeeItem[]
  costsBySku: Record<string, CostEntry>
  shopExternalId: string | null
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)
  const [statusFilter, setStatusFilter] = useState<'all' | ItemStatus>('all')
  const [sort, setSort] = useState<SortKey>('bestseller')
  const [view, setView] = useState<ViewMode>('grid')
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY)
    if (stored === 'grid' || stored === 'list') setView(stored)
  }, [])

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  const enriched = useMemo<EnrichedItem[]>(() => {
    return items.map((it) => {
      const raw = it.raw_payload as { image?: { image_url_list?: string[] } } | null
      const thumb = raw?.image?.image_url_list?.[0] ?? null
      const cost = it.item_sku ? costsBySku[it.item_sku] : undefined
      return {
        ...it,
        thumb_url: thumb,
        permalink: shopExternalId && it.external_id
          ? `https://shopee.com.br/product/${shopExternalId}/${it.external_id}`
          : null,
        cost_unit: cost?.cost_unit ?? null,
        packaging_cost: cost?.packaging_cost ?? null,
        tax_rate: cost?.tax_rate ?? null,
      }
    })
  }, [items, costsBySku, shopExternalId])

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    let arr = enriched.filter((it) => {
      const matchesTerm =
        !term ||
        it.title.toLowerCase().includes(term) ||
        (it.item_sku?.toLowerCase().includes(term) ?? false)
      const matchesStatus = statusFilter === 'all' || it.item_status === statusFilter
      return matchesTerm && matchesStatus
    })

    const nullLast = (a: number | null, b: number | null, dir: 'asc' | 'desc') => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return dir === 'asc' ? a - b : b - a
    }

    arr = [...arr].sort((a, b) => {
      switch (sort) {
        case 'bestseller': return nullLast(a.sold_quantity, b.sold_quantity, 'desc')
        case 'low-stock': return nullLast(a.stock, b.stock, 'asc')
        case 'high-price': return nullLast(a.price, b.price, 'desc')
        case 'low-price': return nullLast(a.price, b.price, 'asc')
      }
    })
    return arr
  }, [enriched, debouncedSearch, statusFilter, sort])

  const selected = enriched.find((i) => i.id === selectedId) ?? null

  return (
    <>
      <TopBar title="Anúncios — Shopee" />
      <main className="flex items-start gap-gutter p-margin">
        <div className="flex min-w-0 flex-1 flex-col gap-lg">
          <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-white/5 bg-surface-container/40 p-md backdrop-blur-sm">
            <div className="flex min-w-[300px] flex-1 flex-wrap items-center gap-sm">
              <div className="relative min-w-[220px] max-w-md flex-1">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-surface-container py-2 pl-9 pr-3 text-sm text-on-surface placeholder-outline-variant outline-none transition-all focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                  placeholder="Buscar por título ou SKU"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | ItemStatus)}
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-tertiary"
              >
                <option value="all">Status: Todos</option>
                <option value="NORMAL">Ativo</option>
                <option value="UNLIST">Despublicado</option>
                <option value="BANNED">Banido</option>
                <option value="DELETED">Deletado</option>
              </select>
            </div>

            <div className="flex items-center gap-md">
              <span className="hidden text-sm text-on-surface-variant xl:inline-block">
                {filtered.length} {filtered.length === 1 ? 'anúncio' : 'anúncios'}
              </span>
              <div className="flex items-center rounded-lg border border-white/10 bg-surface-container p-1">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Visualizar em grade"
                  className={cn(
                    'flex items-center justify-center rounded p-1 transition-colors',
                    view === 'grid' ? 'bg-white/10 text-tertiary shadow-sm' : 'text-outline hover:text-on-surface',
                  )}
                >
                  <Icon name="grid_view" filled={view === 'grid'} size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-label="Visualizar em lista"
                  className={cn(
                    'flex items-center justify-center rounded p-1 transition-colors',
                    view === 'list' ? 'bg-white/10 text-tertiary shadow-sm' : 'text-outline hover:text-on-surface',
                  )}
                >
                  <Icon name="view_list" filled={view === 'list'} size={14} />
                </button>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="cursor-pointer appearance-none rounded-lg border border-white/10 bg-surface-container px-3 py-2 pr-8 text-sm text-on-surface outline-none focus:border-tertiary"
              >
                {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                  <option key={k} value={k}>{sortLabels[k]}</option>
                ))}
              </select>
              <button className="flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-xs font-medium text-on-tertiary shadow-lg shadow-orange-900/20 transition-colors hover:bg-tertiary/90">
                <Icon name="add_circle" size={14} />
                Cadastrar custos em massa
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card flex flex-col items-center gap-2 rounded-xl p-xl text-center">
              <Icon name="search_off" className="text-3xl text-outline-variant" />
              <p className="text-sm text-on-surface-variant">Nenhum anúncio encontrado.</p>
            </div>
          ) : view === 'grid' ? (
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
          ) : (
            <div className="glass-card overflow-hidden rounded-xl">
              <table className="w-full text-left">
                <thead className="bg-surface-container-high/30">
                  <tr className="border-b border-white/10">
                    <th className="px-md py-3 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Img</th>
                    <th className="px-md py-3 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Anúncio</th>
                    <th className="px-md py-3 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Status</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Preço</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Estoque</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Vendas</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Margem</th>
                    <th className="px-md py-3 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <ListingRow
                      key={item.id}
                      item={item}
                      selected={item.id === selectedId}
                      onClick={() => setSelectedId(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && <CostDrawer item={selected} onClose={() => setSelectedId(null)} />}
      </main>
    </>
  )
}
