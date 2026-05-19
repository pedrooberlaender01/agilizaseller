'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'all'

export type InvoiceRow = {
  id: string
  identificador: string | null
  chave: string | null
  numero: number | null
  serie: number | null
  tipo: number | null
  situacao: number | null
  data_emissao: string | null
  valor: number | string | null
  valor_frete: number | string | null
}

// 0=Entrada, 1=Saída
const tipoLabel: Record<number, string> = {
  0: 'Entrada',
  1: 'Saída',
}

// 3=Autorizada, 4=Cancelada, 5=Denegada, 9=Inutilizada
const situacaoLabel: Record<number, string> = {
  3: 'Autorizada',
  4: 'Cancelada',
  5: 'Denegada',
  9: 'Inutilizada',
}

const situacaoTone: Record<number, 'green' | 'red' | 'amber' | 'gray'> = {
  3: 'green',
  4: 'red',
  5: 'red',
  9: 'gray',
}

const toneClass = {
  green: 'border-secondary/30 bg-secondary/10 text-secondary',
  red: 'border-error/30 bg-error/10 text-error',
  amber: 'border-tertiary/30 bg-tertiary/10 text-tertiary',
  gray: 'border-white/10 bg-white/5 text-slate-400',
  blue: 'border-primary/30 bg-primary/10 text-primary',
}

function fmtBrl(v: number | string | null | undefined): string {
  const n = Number(v ?? 0)
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtChave(chave: string | null): string {
  if (!chave) return '—'
  if (chave.length <= 14) return chave
  return `${chave.slice(0, 4)} ${chave.slice(4, 8)}…${chave.slice(-8)}`
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export function FiscalView({
  invoices,
  totalCount,
  page,
  period,
  tipo,
  situacao,
  search,
  nickname,
}: {
  invoices: InvoiceRow[]
  totalCount: number
  page: number
  period: Period
  tipo: string
  situacao: string
  search: string
  nickname?: string | null
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

  function setPeriod(p: Period) {
    pushParams((next) => next.set('period', p))
  }

  function setTipo(v: string) {
    pushParams((next) => {
      if (!v) next.delete('tipo')
      else next.set('tipo', v)
    })
  }

  function toggleSituacao(code: string) {
    const current = situacao ? situacao.split(',') : []
    const has = current.includes(code)
    const nextList = has ? current.filter((c) => c !== code) : [...current, code]
    pushParams((next) => {
      if (nextList.length === 0) next.delete('situacao')
      else next.set('situacao', nextList.join(','))
    })
  }

  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  const selectedSituacoes = situacao ? situacao.split(',') : []
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Totais visíveis
  const totalValor = invoices.reduce((acc, inv) => acc + Number(inv.valor ?? 0), 0)
  const autorizadasCount = invoices.filter((i) => i.situacao === 3).length

  return (
    <>
      <TopBar title="Fiscal — Magazord" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Notas Fiscais</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
          <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
            {(['7d', '30d', '90d', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">NFs no período</span>
              <Icon name="receipt_long" size={18} className="text-outline" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{totalCount.toLocaleString('pt-BR')}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Autorizadas (página)</span>
              <Icon name="check_circle" size={18} className="text-outline" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-secondary">{autorizadasCount}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Valor (página)</span>
              <Icon name="payments" size={18} className="text-outline" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{fmtBrl(totalValor)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-lg flex flex-wrap items-center gap-3">
          <div className="relative w-[280px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
              placeholder="Buscar chave ou identificador..."
            />
          </div>

          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-tertiary"
          >
            <option value="">Todos tipos</option>
            <option value="1">Saída</option>
            <option value="0">Entrada</option>
          </select>

          <div className="flex flex-wrap items-center gap-2">
            {[3, 4, 5, 9].map((code) => {
              const selected = selectedSituacoes.includes(String(code))
              const tone = situacaoTone[code]
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleSituacao(String(code))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    selected
                      ? toneClass[tone]
                      : 'border-white/10 bg-[#050507] text-slate-400 hover:border-white/20 hover:text-white',
                  )}
                >
                  {situacaoLabel[code]}
                </button>
              )
            })}
          </div>

          <span className="ml-auto text-xs font-medium text-slate-400">
            {totalCount} {totalCount === 1 ? 'NF' : 'NFs'}
          </span>
        </div>

        {/* Tabela */}
        <div className="glass-card overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Número</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Chave</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Tipo</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Situação</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Frete</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Emissão</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="receipt_long" size={32} className="text-outline" />
                      <p className="text-sm text-outline">Nenhuma nota fiscal encontrada</p>
                      <p className="text-xs text-slate-500">
                        O workflow <span className="font-mono">Magazord - Sync NFs</span> roda a cada 4h. Aguarde próxima execução.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((nf) => {
                  const tipoCode = nf.tipo ?? -1
                  const sitCode = nf.situacao ?? -1
                  const sitTone = situacaoTone[sitCode] ?? 'gray'
                  return (
                    <tr key={nf.id} className="border-b border-white/5 transition-colors hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-white">{nf.numero ?? '—'}</div>
                        {nf.serie != null && (
                          <div className="font-mono text-[10px] text-slate-500">série {nf.serie}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400" title={nf.chave ?? ''}>
                        {fmtChave(nf.chave)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                            tipoCode === 1 ? toneClass.blue : tipoCode === 0 ? toneClass.amber : toneClass.gray,
                          )}
                        >
                          {tipoLabel[tipoCode] ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                            toneClass[sitTone],
                          )}
                        >
                          {situacaoLabel[sitCode] ?? `Cod ${sitCode}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-white">{fmtBrl(nf.valor)}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{fmtBrl(nf.valor_frete)}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(nf.data_emissao)}</td>
                    </tr>
                  )
                })
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
