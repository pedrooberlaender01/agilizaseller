'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export type ProductRow = {
  id: string
  codigo: string
  nome: string
  marca: number | null
  modelo: string | null
  tipo: number | null
  ativo: boolean | null
  peso: number | string | null
  ncm: string | null
  unidade_medida: string | null
  updated_at: string | null
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
  ativo,
}: {
  products: ProductRow[]
  totalCount: number
  page: number
  search: string
  ativo: boolean | null
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

  function setAtivo(v: 'all' | 'true' | 'false') {
    pushParams((next) => {
      if (v === 'all') next.delete('ativo')
      else next.set('ativo', v)
    })
  }

  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const ativoValue: 'all' | 'true' | 'false' = ativo === null ? 'all' : ativo ? 'true' : 'false'

  return (
    <>
      <TopBar title="Produtos — Magazord" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[280px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar código ou nome..."
              />
            </div>
            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
              {(['all', 'true', 'false'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setAtivo(v)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    ativoValue === v ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {v === 'all' ? 'Todos' : v === 'true' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {totalCount} {totalCount === 1 ? 'produto' : 'produtos'}
          </span>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Código</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Nome</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Modelo</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">NCM</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Peso</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Unid.</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Ativo</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-outline">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{p.codigo}</td>
                    <td className="px-6 py-4">{p.nome}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{p.modelo || '—'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{p.ncm || '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{p.peso ?? '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{p.unidade_medida || '—'}</td>
                    <td className="px-6 py-4">
                      {p.ativo ? (
                        <span className="rounded-full bg-secondary/15 px-2 py-1 text-xs font-medium text-secondary">Ativo</span>
                      ) : p.ativo === false ? (
                        <span className="rounded-full bg-error/15 px-2 py-1 text-xs font-medium text-error">Inativo</span>
                      ) : (
                        <span className="text-xs text-outline">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
            <span className="text-sm text-slate-400">
              {totalCount === 0
                ? '0 resultados'
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="px-2 text-xs text-slate-300">Página {page} de {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
