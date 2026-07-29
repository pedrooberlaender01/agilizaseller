'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { mapReturnStatus, statusToneClass } from '@/lib/shein-status'

const PAGE_SIZE = 50

export type ReturnRow = {
  id: string
  return_order_no: string
  return_order_status: number | null
  order_no: string | null
  site: string | null
  request_return_time: string | null
  last_update_time: string | null
  goods_title: string | null
  image_url: string | null
  item_count: number | null
  total_estimate_income: number | string | null
  performance_cost: number | string | null
  buyer_name: string | null
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
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `há ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days}d`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function fmtBRL(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; onde: string; difere?: string }> = {
  'Total': {
    title: 'Total de Devoluções',
    oQueE: 'Todas as devoluções/reembolsos abertos pelos clientes, em qualquer status. Histórico completo (não filtra período).',
    origem: 'Tabela `shein_returns` — populada pelo endpoint `/open-api/return-order/list` (WF "Shein - Sync Returns").',
    onde: 'Painel Shein → Pedidos → Devolução e reembolso.',
    difere: 'Cobrimos 2.338 de 2.484 do painel = 94,1%. Os ~146 restantes são after-sales terminais (maioria "Cancelado" + alguns "Aprovar reembolso") que a API de devolução da Shein NÃO retorna por nenhum caminho — testamos os 4 possíveis: list com filtro de cada status, list por data de atualização (queryType=3), e details por número exato da devolução. Nenhum traz esses registros. "Aprovar reembolso" nem existe no dicionário de status da API (é reembolso sem devolução física). É limite da Shein, não do painel — os números que aparecem batem com dados reais, nada foi forçado. Sync roda continuamente.',
  },
  'Solicitadas': {
    title: 'Solicitadas',
    oQueE: 'Devoluções abertas pelo cliente aguardando análise/aprovação. Ainda não despachadas de volta.',
    origem: 'Devoluções com `return_order_status = 2` (Solicitada).',
    onde: 'Painel Shein → Devolução e reembolso → filtro de status "Solicitada".',
  },
  'Em Processo': {
    title: 'Em Processo',
    oQueE: 'Devoluções em estados intermediários: fechada, aguardando o cliente postar, ou em trânsito para o armazém SHEIN.',
    origem: 'Devoluções com `return_order_status` 1 (Fechada), 7 (Aguardando entrega) ou 8 (Trânsito armazém SHEIN).',
    onde: 'Painel Shein → Devolução e reembolso → filtros de status equivalentes.',
    difere: 'Card agrupa 3 status pouco frequentes para que a soma dos cards feche com o Total. Para ver cada um separado, use o filtro de status na lista abaixo.',
  },
  'Recebidas': {
    title: 'Recebidas',
    oQueE: 'Devoluções cujo produto já chegou de volta (recebido ou entregue no armazém).',
    origem: 'Devoluções com `return_order_status` 5 (Recebida) ou 6 (Entregue).',
    onde: 'Painel Shein → Devolução e reembolso → filtro "Recebida".',
  },
  'Concluídas': {
    title: 'Concluídas',
    oQueE: 'Devoluções finalizadas — processo encerrado e reembolso resolvido.',
    origem: 'Devoluções com `return_order_status = 9` (Concluída).',
    onde: 'Painel Shein → Devolução e reembolso → filtro "Concluída".',
  },
  'Canceladas': {
    title: 'Canceladas',
    oQueE: 'Devoluções canceladas — o cliente desistiu ou a solicitação foi recusada.',
    origem: 'Devoluções com `return_order_status = 3` (Cancelada).',
    onde: 'Painel Shein → Devolução e reembolso → filtro "Cancelada".',
    difere: 'Aparece 0 aqui, mas o painel tem canceladas — a API da Shein não devolve esses registros com o status 3 marcado (o filtro por status 3 na API vem vazio). As canceladas que conseguimos puxar entram classificadas com outro status (recebida/fechada). É limitação da API de devolução da Shein, ver detalhe no card "Total".',
  },
}

function InfoModal({ infoKey, onClose }: { infoKey: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!infoKey) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [infoKey, onClose])

  if (!infoKey) return null
  const info = KPI_INFO[infoKey]
  if (!info) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-2xl border border-zinc-700 shadow-2xl"
        style={{ background: 'rgba(22,27,34,0.97)' }}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">help</span>
            {info.title}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">O que é</div>
            <p className="text-sm leading-relaxed text-zinc-300">{info.oQueE}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">De onde vem o dado</div>
            <p className="text-sm leading-relaxed text-zinc-400">{info.origem}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Onde conferir no painel Shein</div>
            <p className="text-sm leading-relaxed text-zinc-400">{info.onde}</p>
          </div>
          {info.difere && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Observação</div>
              <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{info.difere}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HelpButton({ label, onOpen }: { label: string; onOpen: (key: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(label) }}
      className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors"
      aria-label={`Explicação: ${label}`}
    >
      <span className="material-symbols-outlined text-[14px]">help</span>
    </button>
  )
}

function StatCard({ label, value, icon, tone, onHelp }: { label: string; value: number; icon: string; tone?: 'default' | 'green' | 'yellow' | 'blue' | 'red'; onHelp?: (key: string) => void }) {
  const toneCls = tone === 'green' ? 'text-emerald-300' : tone === 'yellow' ? 'text-amber-300' : tone === 'blue' ? 'text-blue-300' : tone === 'red' ? 'text-rose-300' : 'text-white'
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
          {onHelp && <HelpButton label={label} onOpen={onHelp} />}
        </div>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

const STATUS_FILTER_OPTIONS = [
  { value: '1', label: 'Fechada' },
  { value: '2', label: 'Solicitada' },
  { value: '3', label: 'Cancelada' },
  { value: '5', label: 'Recebida' },
  { value: '6', label: 'Entregue' },
  { value: '7', label: 'Aguardando entrega' },
  { value: '8', label: 'Trânsito armazém SHEIN' },
  { value: '9', label: 'Concluída' },
]

export function DevolucoesView({
  returns,
  totalCount,
  page,
  search,
  status,
  site,
  sites,
  stats,
  nickname,
}: {
  returns: ReturnRow[]
  totalCount: number
  page: number
  search: string
  status: string
  site: string
  sites: string[]
  stats: { total: number; solicitadas: number; recebidas: number; concluidas: number; canceladas: number; emProcesso: number }
  nickname?: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const [helpKey, setHelpKey] = useState<string | null>(null)
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

  function setSite(v: string) {
    pushParams((next) => {
      if (!v) next.delete('site')
      else next.set('site', v)
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
      <TopBar title="Devoluções — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Devoluções</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={stats.total} icon="keyboard_return" onHelp={setHelpKey} />
          <StatCard label="Solicitadas" value={stats.solicitadas} icon="hourglass_top" tone="yellow" onHelp={setHelpKey} />
          <StatCard label="Em Processo" value={stats.emProcesso} icon="local_shipping" tone="blue" onHelp={setHelpKey} />
          <StatCard label="Recebidas" value={stats.recebidas} icon="inbox" tone="blue" onHelp={setHelpKey} />
          <StatCard label="Concluídas" value={stats.concluidas} icon="check_circle" tone="green" onHelp={setHelpKey} />
          <StatCard label="Canceladas" value={stats.canceladas} icon="cancel" tone="red" onHelp={setHelpKey} />
        </div>

        <div className="mb-lg flex flex-wrap items-center gap-3">
          <div className="relative w-[300px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40"
              placeholder="Buscar return, pedido ou produto..."
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
          >
            <option value="">Todos status</option>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
          >
            <option value="">Todos sites</option>
            {sites.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Produto / Devolução</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Líquido estimado</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Solicitada</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhuma devolução encontrada.
                  </td>
                </tr>
              ) : (
                returns.map((r) => {
                  const badge = mapReturnStatus(r.return_order_status)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/shein/devolucoes/${encodeURIComponent(r.return_order_no)}`)}
                      className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {r.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">—</div>
                          )}
                          <div>
                            <p className="line-clamp-1 max-w-[300px] text-sm font-medium text-white">
                              {r.goods_title || '—'}
                              {(r.item_count ?? 0) > 1 && <span className="ml-1 text-xs text-zinc-500">+{(r.item_count ?? 1) - 1}</span>}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-zinc-500">{r.return_order_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{r.order_no || '—'}</td>
                      <td className="px-6 py-4 text-xs text-slate-300">{fmtBRL(r.total_estimate_income)}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', statusToneClass(badge.tone))}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRel(r.request_return_time)}</td>
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
      <InfoModal infoKey={helpKey} onClose={() => setHelpKey(null)} />
    </>
  )
}
