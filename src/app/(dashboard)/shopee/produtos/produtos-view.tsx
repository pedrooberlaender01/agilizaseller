'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export type ProductRow = {
  id: string
  external_id: string
  item_sku: string | null
  title: string
  price: number | string | null
  currency: string | null
  stock: number | null
  sold_quantity: number | null
  item_status: string | null
  image_url: string | null
}

const fmtBrl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtInt = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('pt-BR')

function statusTone(s: string | null): string {
  if (!s) return 'bg-zinc-700/40 text-zinc-400'
  if (s === 'NORMAL') return 'bg-emerald-500/15 text-emerald-300'
  if (s === 'BANNED' || s === 'DELETED') return 'bg-rose-500/15 text-rose-300'
  if (s === 'UNLIST') return 'bg-amber-500/15 text-amber-300'
  return 'bg-zinc-700/40 text-zinc-400'
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
  sort,
  stats,
}: {
  products: ProductRow[]
  totalCount: number
  page: number
  search: string
  status: string
  statuses: string[]
  sort: string
  stats: { totalProducts: number; totalStock: number; totalSold: number }
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

  function setSort(v: string) {
    pushParams((next) => {
      if (!v || v === 'sold_desc') next.delete('sort')
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

  return (
    <>
      <TopBar title="Produtos — Shopee" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Total Produtos</span>
              <Icon name="inventory_2" size={18} className="text-blue-400" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(stats.totalProducts)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Estoque Total</span>
              <Icon name="warehouse" size={18} className="text-emerald-400" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(stats.totalStock)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Vendidos (acumulado)</span>
              <Icon name="trending_up" size={18} className="text-amber-300" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{fmtInt(stats.totalSold)}</p>
          </div>
        </div>

        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-[260px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-zinc-400"
                placeholder="Buscar SKU, nome ou item ID..."
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
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
            >
              <option value="sold_desc">Mais vendidos</option>
              <option value="stock_asc">Estoque ↑</option>
              <option value="stock_desc">Estoque ↓</option>
              <option value="price_desc">Preço ↓</option>
              <option value="price_asc">Preço ↑</option>
              <option value="recent">Sync recente</option>
            </select>
          </div>
          <div className="text-xs text-zinc-400">
            <span className="font-medium text-zinc-200">{totalCount}</span> {totalCount === 1 ? 'produto' : 'produtos'}
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Produto</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">SKU / ID</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Preço</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Estoque</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Vendidos</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-400">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm text-zinc-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const lowStock = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 10
                  const noStock = (p.stock ?? 0) === 0
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-white/5 text-zinc-500">
                              <Icon name="image" size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="line-clamp-2 max-w-[320px] text-sm text-zinc-200">{p.title || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-zinc-300">{p.item_sku || '—'}</span>
                          <span className="font-mono text-[10px] text-zinc-500">{p.external_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-white">{fmtBrl(p.price)}</td>
                      <td className={cn('px-6 py-4 text-right text-xs font-medium', noStock ? 'text-rose-300' : lowStock ? 'text-amber-300' : 'text-zinc-300')}>
                        {fmtInt(p.stock)}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-zinc-300">{fmtInt(p.sold_quantity)}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-block rounded px-1.5 py-0.5 text-[10px] font-medium', statusTone(p.item_status))}>
                          {p.item_status || '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <span className="text-sm text-zinc-400">
              {totalCount === 0
                ? '0 resultados'
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-zinc-300">Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
