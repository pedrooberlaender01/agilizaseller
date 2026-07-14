'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export type ProductRow = {
  id: string
  product_id: string
  title: string | null
  status: string | null
  price: number | string | null
  stock: number | string | null
}

type Tone = 'green' | 'red' | 'gray'
const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red:   'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:  'bg-outline/20 text-zinc-500 border border-outline/30',
}
function statusTone(s: string | null): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v === 'ACTIVATE') return 'green'
  if (v.includes('DELET') || v.includes('DEACTIV') || v.includes('FROZEN')) return 'red'
  return 'gray'
}

const fmtBrl = (n: number | string | null | undefined) =>
  `R$ ${Number(n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
  status,
  search,
  statuses,
}: {
  products: ProductRow[]
  totalCount: number
  page: number
  status: string
  search: string
  statuses: string[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const firstRender = useRef(true)

  function pushParams(updater: (next: URLSearchParams) => void, resetPage = true) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    if (resetPage) next.delete('page')
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    if (debouncedSearch === search) return
    pushParams((next) => {
      if (debouncedSearch) next.set('q', debouncedSearch)
      else next.delete('q')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function setStatus(s: string) {
    pushParams((next) => {
      if (s) next.set('status', s)
      else next.delete('status')
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
      <TopBar title="Produtos — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[280px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar título, product_id..."
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
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Produtos</p>
            <p className="text-sm font-semibold text-white">{totalCount.toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Produto</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Preço</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Estoque</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum produto encontrado. Aguarde sincronização (Sync Produtos a cada 2h).
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4">
                      <p className="line-clamp-2 max-w-[420px] text-sm font-medium text-white">{p.title || '—'}</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">{p.product_id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[statusTone(p.status)])}>
                        {p.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-white">{p.price != null ? fmtBrl(p.price) : '—'}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-300">
                      {p.stock != null ? Number(p.stock).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))
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
