'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { getMagInvoiceDetail, type MagInvoiceDetail } from '@/app/actions/magazord'

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

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = invoices.find((inv) => inv.id === selectedId) ?? null
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">NFs no período</span>
              <Icon name="receipt_long" size={18} className="text-outline" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-white">{totalCount.toLocaleString('pt-BR')}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Autorizadas (página)</span>
              <Icon name="check_circle" size={18} className="text-outline" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-secondary">{autorizadasCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
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
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
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
                  const isSelected = selectedId === nf.id
                  return (
                    <tr
                      key={nf.id}
                      onClick={() => setSelectedId(nf.id)}
                      className={cn(
                        'cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5',
                        isSelected && 'bg-white/5 ring-1 ring-inset ring-tertiary/30',
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className={cn('font-mono text-sm', isSelected ? 'text-tertiary' : 'text-white')}>{nf.numero ?? '—'}</div>
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

      {selected && (
        <InvoiceDrawer
          invoiceId={selected.id}
          fallback={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  )
}

function InvoiceDrawer({
  invoiceId,
  fallback,
  onClose,
}: {
  invoiceId: string
  fallback: InvoiceRow
  onClose: () => void
}) {
  const [details, setDetails] = useState<MagInvoiceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [xmlOpen, setXmlOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetails(null)
    setXmlOpen(false)
    getMagInvoiceDetail(invoiceId).then((res) => {
      if (!cancelled) {
        setDetails(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  function copyChave() {
    if (!fallback.chave) return
    navigator.clipboard.writeText(fallback.chave).catch(() => {})
  }

  function downloadXml() {
    const xml = details?.xml
    if (!xml) return
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `NFe-${fallback.numero ?? fallback.identificador ?? 'sem-numero'}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const raw = details?.raw_payload ?? null
  const itens = raw?.itens ?? []
  const order = details?.mag_orders ?? null
  const sitM = fallback.situacao !== null ? situacaoLabel[fallback.situacao] : null
  const sitTone = fallback.situacao !== null ? situacaoTone[fallback.situacao] : 'gray'
  const tipoM = fallback.tipo !== null ? tipoLabel[fallback.tipo] : null

  return (
    <aside
      className="fixed right-0 top-0 z-40 flex h-screen w-[420px] flex-col overflow-y-auto border-l border-white/10 bg-[#0d1117]"
      style={{ boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(250, 204, 60, 0.1)' }}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#0d1117]/90 p-6 backdrop-blur-md">
        <div className="min-w-0 pr-3">
          <h3 className="font-mono text-base font-semibold text-white">NF {fallback.numero ?? '—'}</h3>
          <p className="mt-1 text-xs text-slate-400">
            Série {fallback.serie ?? '—'} · {fallback.data_emissao ? new Date(fallback.data_emissao).toLocaleString('pt-BR') : '—'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sitM && (
              <span className={cn('rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wider', toneClass[sitTone])}>
                {sitM}
              </span>
            )}
            {tipoM && (
              <span className={cn('rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wider', toneClass.blue)}>
                {tipoM}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="flex-1 space-y-6 p-6">
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Chave de Acesso</h4>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <code className="break-all text-[11px] text-slate-300">{fallback.chave ?? '—'}</code>
            <button
              onClick={copyChave}
              disabled={!fallback.chave}
              className="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              title="Copiar chave"
            >
              <Icon name="content_copy" size={14} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Icon name="progress_activity" className="animate-spin text-tertiary" size={24} />
            <span className="text-xs text-outline">Carregando detalhes…</span>
          </div>
        )}

        {!loading && order && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Pedido vinculado</h4>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="font-mono text-sm text-white">#{order.external_id}</p>
              {order.pessoa_nome && <p className="mt-1 text-sm text-slate-300">{order.pessoa_nome}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {order.marketplace_origem || 'Próprio'}
                {(order.uf || order.cidade) && ` · ${[order.cidade, order.uf].filter(Boolean).join(' / ')}`}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Total pedido: {fmtBrl(order.valor_total)}
              </p>
            </div>
          </div>
        )}

        {!loading && raw?.descricaoSituacao && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Situação SEFAZ</h4>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-slate-200">
              {raw.descricaoSituacao}
              {raw.dataAtualizacao && (
                <p className="mt-1 text-xs text-slate-500">
                  Atualizada em {new Date(raw.dataAtualizacao).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && itens.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Itens ({itens.length})
            </h4>
            <div className="divide-y divide-white/10 rounded-lg border border-zinc-800 bg-zinc-900/40">
              {itens.map((it, i) => (
                <div key={it.id ?? i} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-white">{it.descricao}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                        {it.codigo} · Qtd {Number(it.quantidade)} × {fmtBrl(it.valorUnitario)}
                        {it.deposito ? ` · Dep ${it.deposito}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium text-white">{fmtBrl(it.valorTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Resumo Financeiro</h4>
            <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
              <div className="flex justify-between text-slate-300">
                <span>Valor Produtos</span>
                <span>{fmtBrl(fallback.valor)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Frete (itens)</span>
                <span>{fmtBrl(fallback.valor_frete)}</span>
              </div>
              <div className="my-2 border-t border-white/10" />
              <div className="flex items-center justify-between pt-1">
                <span className="text-base font-semibold text-white">Total NF</span>
                <span className="text-xl font-semibold text-secondary">{fmtBrl(fallback.valor)}</span>
              </div>
            </div>
          </div>
        )}

        {!loading && raw?.titulos && raw.titulos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400">Títulos</h4>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
              {raw.titulos.map((t) => (
                <code key={t} className="mr-2 inline-block text-xs text-slate-300">{t}</code>
              ))}
            </div>
          </div>
        )}

        {!loading && details?.xml && (
          <div className="space-y-2">
            <button
              onClick={() => setXmlOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <Icon name="code" size={14} />
                XML ({Math.round((details.xml.length / 1024) * 10) / 10} KB)
              </span>
              <Icon name={xmlOpen ? 'expand_less' : 'expand_more'} size={16} />
            </button>
            {xmlOpen && (
              <pre className="max-h-[300px] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[10px] leading-relaxed text-slate-400">
                {details.xml}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-white/10 bg-[#0d1117] p-6">
        <div className="flex gap-2">
          <a
            href={`/api/magazord/invoice/${invoiceId}/danfe`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-tertiary py-2 text-sm font-medium text-on-tertiary transition-colors hover:bg-tertiary/90"
          >
            <Icon name="picture_as_pdf" size={16} />
            DANFE
          </a>
          <a
            href={`/api/magazord/invoice/${invoiceId}/danfe?variant=simplificada`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-tertiary/40 bg-tertiary/10 py-2 text-sm font-medium text-tertiary transition-colors hover:bg-tertiary/20"
          >
            <Icon name="receipt" size={16} />
            Simplificada
          </a>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/magazord/invoice/${invoiceId}/danfe?variant=etiqueta`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            <Icon name="local_shipping" size={16} />
            Etiqueta
          </a>
          <button
            onClick={downloadXml}
            disabled={loading || !details?.xml}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="code" size={16} />
            XML
          </button>
        </div>
      </div>
    </aside>
  )
}
