'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d'

export type OrderRow = {
  id: string
  external_id: string
  codigo_marketplace: string | null
  marketplace_origem: string | null
  situacao: number
  situacao_descricao: string | null
  data_hora: string | null
  valor_total: number | string
  valor_frete: number | string | null
  valor_desconto: number | string | null
  pessoa_nome: string | null
  cpf_cnpj: string | null
  uf: string | null
  cidade: string | null
  forma_pagamento_descricao: string | null
  mag_order_items: { count: number }[]
}

type SitTone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

const situacaoMeta: Record<number, { label: string; tone: SitTone }> = {
  1:  { label: 'Aguardando Pagto.',          tone: 'yellow' },
  2:  { label: 'Cancelado Pagto.',           tone: 'red' },
  3:  { label: 'Em Análise Pagto.',          tone: 'yellow' },
  4:  { label: 'Aprovado',                   tone: 'blue' },
  5:  { label: 'Aprovado e Integrado',       tone: 'blue' },
  6:  { label: 'NF Emitida',                 tone: 'blue' },
  7:  { label: 'Transporte',                 tone: 'blue' },
  8:  { label: 'Entregue',                   tone: 'green' },
  9:  { label: 'Fraude',                     tone: 'red' },
  10: { label: 'Chargeback',                 tone: 'red' },
  11: { label: 'Disputa',                    tone: 'red' },
  12: { label: 'Aprovado Análise Pagto.',    tone: 'blue' },
  13: { label: 'Análise Pagto. Interna',     tone: 'yellow' },
  14: { label: 'Cancelado Análise',          tone: 'red' },
  15: { label: 'Aguardando Pagto. Difer.',   tone: 'yellow' },
  16: { label: 'Problema Fluxo Postal',      tone: 'red' },
  17: { label: 'Devolvido Financeiro',       tone: 'red' },
  18: { label: 'Aguard. Atualiz. Dados',     tone: 'yellow' },
  19: { label: 'Aguard. Chegada Produto',    tone: 'yellow' },
  20: { label: 'Devolvido Estoque Dep.1',    tone: 'red' },
  21: { label: 'Devolvido Estoque',          tone: 'red' },
  22: { label: 'Suspenso Temp.',             tone: 'red' },
  23: { label: 'Faturamento Iniciado',       tone: 'blue' },
  24: { label: 'Em Cancelamento',            tone: 'red' },
  25: { label: 'Tratamento Pós-Vendas',      tone: 'yellow' },
  26: { label: 'NF Cancelada',               tone: 'red' },
  27: { label: 'Crédito por Troca',          tone: 'blue' },
  28: { label: 'NF Denegada',                tone: 'red' },
  29: { label: 'Chargeback Pago',            tone: 'red' },
  30: { label: 'Aprovado Parcial',           tone: 'blue' },
  31: { label: 'Em Logística Reversa',       tone: 'yellow' },
}

const toneClasses: Record<SitTone, string> = {
  yellow: 'bg-tertiary/15 text-tertiary border border-tertiary/30',
  blue:   'bg-primary/15 text-primary border border-primary/30',
  green:  'bg-secondary/15 text-secondary border border-secondary/30',
  red:    'bg-error/15 text-error border border-error/30',
  gray:   'bg-outline/20 text-outline border border-outline/30',
}

const allSituacoes = Object.keys(situacaoMeta).map(Number).sort((a, b) => a - b)

const fmtBrl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtRelDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `Hoje, ${time}`
  if (isYesterday) return `Ontem, ${time}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

function SituacaoMultiselect({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<number>
  onToggle: (s: number) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-white/10 bg-[#050507] px-4 py-2 text-sm text-on-surface outline-none transition-colors hover:border-tertiary',
          open && 'border-tertiary',
        )}
      >
        <span>Situação</span>
        {selected.size > 0 && (
          <span className="rounded bg-tertiary/20 px-1.5 py-0.5 font-mono text-[10px] text-tertiary">
            {selected.size}
          </span>
        )}
        <Icon name={open ? 'expand_less' : 'expand_more'} size={16} className="text-outline" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 max-h-[420px] w-[280px] overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117]/97 p-2 shadow-2xl shadow-black/60 backdrop-blur-md">
          <div className="mb-1 flex items-center justify-between border-b border-white/5 px-2 py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-outline">Filtrar situação</span>
            {selected.size > 0 && (
              <button onClick={onClear} className="text-[10px] text-tertiary hover:underline">
                Limpar
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {allSituacoes.map((s) => {
              const isOn = selected.has(s)
              const meta = situacaoMeta[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggle(s)}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-left text-sm text-on-surface hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded border',
                        isOn ? 'border-tertiary bg-tertiary' : 'border-outline/40',
                      )}
                    >
                      {isOn && <Icon name="check" size={11} className="text-on-tertiary" />}
                    </span>
                    <span className="font-mono text-[10px] text-outline">{s}</span>
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function PedidosView({
  orders,
  totalCount,
  page,
  period,
  situacao,
  marketplace,
  search,
  marketplaces,
}: {
  orders: OrderRow[]
  totalCount: number
  page: number
  period: Period
  situacao: string
  marketplace: string
  search: string
  marketplaces: string[]
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

  const situacaoList = useMemo(
    () => situacao.split(',').map(Number).filter(Number.isFinite),
    [situacao],
  )
  const situacaoSet = useMemo(() => new Set(situacaoList), [situacaoList])

  function toggleSituacao(s: number) {
    pushParams((next) => {
      const cur = new Set(situacaoList)
      if (cur.has(s)) cur.delete(s)
      else cur.add(s)
      if (cur.size === 0) next.delete('situacao')
      else next.set('situacao', Array.from(cur).join(','))
    })
  }

  function clearSituacao() {
    pushParams((next) => next.delete('situacao'))
  }

  function setMarketplace(m: string) {
    pushParams((next) => {
      if (m) next.set('mkt', m)
      else next.delete('mkt')
    })
  }

  function setPeriod(p: Period) {
    pushParams((next) => next.set('period', p))
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
      <TopBar title="Pedidos — Magazord" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-[260px]">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-tertiary focus:ring-1 focus:ring-tertiary"
                placeholder="Buscar código, cliente ou mkt id..."
              />
            </div>
            <SituacaoMultiselect selected={situacaoSet} onToggle={toggleSituacao} onClear={clearSituacao} />
            {marketplaces.length > 0 && (
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-tertiary"
              >
                <option value="">Todos marketplaces</option>
                {marketplaces.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
              {(['7d', '30d', '90d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400">
              {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>
        </div>

        <div className="glass-card overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Código</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Marketplace</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Cliente</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Itens</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Situação</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">UF</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-outline">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const meta = situacaoMeta[o.situacao]
                  const cls = meta ? toneClasses[meta.tone] : toneClasses.gray
                  const label = meta?.label ?? o.situacao_descricao ?? `#${o.situacao}`
                  const itemCount = o.mag_order_items[0]?.count ?? 0
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4 font-mono text-slate-300">{o.external_id}</td>
                      <td className="px-6 py-4 text-xs text-slate-300">{o.marketplace_origem || 'Próprio'}</td>
                      <td className="px-6 py-4 text-xs">{o.pessoa_nome ?? '—'}</td>
                      <td className="px-6 py-4">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</td>
                      <td className="px-6 py-4 font-medium">{fmtBrl(o.valor_total)}</td>
                      <td className="px-6 py-4">
                        <span className={cn('rounded-full px-2 py-1 text-xs font-medium', cls)}>{label}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{o.uf || '—'}</td>
                      <td className="px-6 py-4 text-slate-400">{fmtRelDate(o.data_hora)}</td>
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
              <span className="px-2 text-xs text-slate-300">
                Página {page} de {totalPages}
              </span>
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
