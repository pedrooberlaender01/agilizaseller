'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export type StockRow = {
  id: string
  sku_code: string
  warehouse: string | null
  available_qty: number
  reserved_qty: number
  total_qty: number
  updated_at: string | null
  product_name?: string | null
  spu_name?: string | null
  skc_name?: string | null
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function fmtRel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function EstoqueView({
  stock,
  totalCount,
  page,
  search,
  warehouse,
  baixo,
  warehouses,
}: {
  stock: StockRow[]
  totalCount: number
  page: number
  search: string
  warehouse: string
  baixo: boolean
  warehouses: string[]
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

  function setWarehouse(v: string) {
    pushParams((next) => {
      if (!v) next.delete('warehouse')
      else next.set('warehouse', v)
    })
  }

  function toggleBaixo() {
    pushParams((next) => {
      if (baixo) next.delete('baixo')
      else next.set('baixo', 'true')
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
      <TopBar title="Estoque — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[260px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar SKU..."
              />
            </div>
            {warehouses.length > 0 && (
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
              >
                <option value="">Todos depósitos</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            )}
            <button
              onClick={toggleBaixo}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                baixo
                  ? 'border-error/40 bg-error/10 text-error'
                  : 'border-zinc-800 bg-[#050507] text-slate-400 hover:text-white',
              )}
            >
              <Icon name="warning" size={14} />
              Estoque baixo (≤5)
            </button>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {totalCount} {totalCount === 1 ? 'SKU' : 'SKUs'}
          </span>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Produto</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Depósito</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Disponível</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Reservado</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Atualizado</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum item de estoque encontrado. Sync horário em execução.
                  </td>
                </tr>
              ) : (
                stock.map((s) => {
                  const low = s.available_qty <= 5
                  const productName = (s.product_name || '').trim() || s.skc_name || s.spu_name || '—'
                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/shein/estoque/${encodeURIComponent(s.sku_code)}`)}
                      className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <p className="line-clamp-2 max-w-[340px] text-sm font-medium text-white">{productName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-zinc-500">{s.sku_code}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard?.writeText(s.sku_code).catch(() => undefined)
                            }}
                            className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                            title="Copiar SKU"
                          >
                            <Icon name="content_copy" size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{s.warehouse || '—'}</td>
                      <td className={cn('px-6 py-4 text-right font-medium', low ? 'text-error' : 'text-white')}>
                        {s.available_qty}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-50">{s.reserved_qty}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{s.total_qty}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRel(s.updated_at)}</td>
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
