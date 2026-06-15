'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export type ProductRow = {
  product_id: string
  connection_id: string
  spu: string | null
  sku_code: string | null
  product_name: string | null
  image_url: string | null
  price: number | string | null
  cost_price: number | string | null
  packaging_cost: number | string | null
  status: string | null
  cost_updated_at: string | null
  units_sold: number | string | null
  orders_count: number | string | null
  gross_revenue: number | string | null
  total_commission: number | string | null
  total_service: number | string | null
  estimated_income: number | string | null
  total_cost: number | string | null
  real_profit: number | string | null
  real_margin_pct: number | string | null
}

const fmtBrl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function marginTone(pct: number | string | null | undefined): string {
  if (pct === null || pct === undefined) return 'text-zinc-500'
  const n = Number(pct)
  if (!Number.isFinite(n)) return 'text-zinc-500'
  if (n >= 30) return 'text-emerald-300'
  if (n >= 10) return 'text-amber-300'
  return 'text-rose-300'
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function ProdutosView({
  products,
  totalCount,
  page,
  search,
  status,
  statuses,
  costFilter,
  sort,
  stats,
}: {
  products: ProductRow[]
  totalCount: number
  page: number
  search: string
  status: string
  statuses: string[]
  costFilter: string
  sort: string
  stats: { withCost: number; totalProducts: number }
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)

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

  function setStatus(v: string) {
    pushParams((next) => {
      if (!v) next.delete('status')
      else next.set('status', v)
    })
  }

  function setCostFilter(v: string) {
    pushParams((next) => {
      if (!v) next.delete('cost')
      else next.set('cost', v)
    })
  }

  function setSort(v: string) {
    pushParams((next) => {
      if (!v || v === 'recent') next.delete('sort')
      else next.set('sort', v)
    })
  }

  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const coveragePct = stats.totalProducts > 0 ? (stats.withCost / stats.totalProducts) * 100 : 0

  return (
    <>
      <TopBar title="Produtos — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-[260px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar SKU, SPU ou nome..."
              />
            </div>
            {statuses.length > 0 && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
              >
                <option value="">Todos status</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
            >
              <option value="">Todos custos</option>
              <option value="missing">Sem custo</option>
              <option value="set">Com custo</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
            >
              <option value="recent">Custo recente</option>
              <option value="margin_desc">Margem ↓</option>
              <option value="margin_asc">Margem ↑</option>
              <option value="revenue">Receita ↓</option>
            </select>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <span className="font-medium text-slate-300">{totalCount} {totalCount === 1 ? 'produto' : 'produtos'}</span>
            <span className="text-zinc-500">
              Cobertura custo: <span className={cn('font-medium', coveragePct >= 80 ? 'text-emerald-300' : coveragePct >= 40 ? 'text-amber-300' : 'text-rose-300')}>
                {stats.withCost}/{stats.totalProducts} ({fmtPct(coveragePct)})
              </span>
            </span>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Produto</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">SKU</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Preço</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Custo</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Vendidos</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receita</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Lucro real</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Margem</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const hasCost = p.cost_price !== null && p.cost_price !== undefined
                  const profit = Number(p.real_profit ?? 0)
                  return (
                    <tr
                      key={p.product_id}
                      onClick={() => p.sku_code && router.push(`/shein/produtos/${encodeURIComponent(p.sku_code)}`)}
                      className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-white/5 text-zinc-500">
                              <Icon name="image" size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="line-clamp-2 max-w-[280px] text-sm text-slate-200">{p.product_name || '—'}</p>
                            {p.status && (
                              <span className={cn('mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', p.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/40 text-zinc-400')}>
                                {p.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">{p.sku_code || '—'}</td>
                      <td className="px-6 py-4 text-right text-xs text-white">{fmtBrl(p.price)}</td>
                      <td className={cn('px-6 py-4 text-right text-xs', hasCost ? 'text-slate-300' : 'text-zinc-600')}>
                        {hasCost ? fmtBrl(p.cost_price) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-300">
                        {Number(p.units_sold ?? 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-slate-300">{fmtBrl(p.gross_revenue)}</td>
                      <td className={cn(
                        'px-6 py-4 text-right text-xs font-medium',
                        !hasCost ? 'text-zinc-600' : profit >= 0 ? 'text-emerald-300' : 'text-rose-300',
                      )}>
                        {hasCost ? fmtBrl(p.real_profit) : '—'}
                      </td>
                      <td className={cn('px-6 py-4 text-right text-xs font-medium', hasCost ? marginTone(p.real_margin_pct) : 'text-zinc-600')}>
                        {hasCost ? fmtPct(p.real_margin_pct) : '—'}
                      </td>
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
              <span className="px-2 text-xs text-slate-300">Página {page} de {totalPages}</span>
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
    </>
  )
}
