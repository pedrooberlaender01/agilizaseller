'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | 'custom'

export type ShipmentRow = {
  id: string
  order_no: string
  package_no: string | null
  waybill_no: string
  carrier: string | null
  carrier_code: string | null
  waybill_type: number | null
  last_node: string | null
  last_node_name: string | null
  last_update_at: string | null
  product_name: string | null
  item_count: number | null
  order_status: string | null
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

const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; onde: string; difere?: string }> = {
  'Total Envios': {
    title: 'Total Envios',
    oQueE: 'Quantidade de PEDIDOS despachados no período (com pelo menos um pacote rastreado). Conta pedido, não pacote — um pedido pode ter 2+ pacotes.',
    origem: '`shein_shipments` agrupado por pedido, filtrado pela data de criação do pedido (`order_time`).',
    onde: 'Painel Shein → Pedidos → Meus Pedidos → soma das abas de status (Enviado + Entregue + etc), filtro "Data de criação do pedido".',
    difere: 'Validado: 1.377 (nosso) vs 1.378 (painel) na janela 13/06→13/07. Diferença de 1-2 = pedido na borda do dia ou pacote sem tracking ainda.',
  },
  'Aguardando': {
    title: 'Aguardando',
    oQueE: 'Pedidos despachados que ainda NÃO têm nenhum evento de rastreio (transportadora não bipou).',
    origem: 'Pedidos cujos pacotes têm `last_node` vazio no rastreamento.',
    onde: 'Painel Shein → Meus Pedidos → abas "Pendente" / "A coletar".',
    difere: 'Número baixo é normal — assim que a transportadora bipa, sai de Aguardando e vira Em Trânsito.',
  },
  'Em Trânsito': {
    title: 'Em Trânsito',
    oQueE: 'Pedidos despachados com rastreio ativo mas SEM entrega confirmada. Inclui coletado, em transporte, saiu para entrega e última milha.',
    origem: 'Pedidos SEM nenhum pacote entregue, mas com pelo menos um pacote com `last_node` de trânsito (in_transport, tail_accept, out_sending...).',
    onde: 'Painel Shein → Meus Pedidos → abas "Enviado" + "Enviando (SHEIN)".',
    difere: 'Validado: 259 (nosso) vs 258 (painel). Depende do sync de rastreio rodar (WF "Shein - Sync Envios Ativos", horário) — se parar, pedidos já entregues ficam presos aqui.',
  },
  'Entregues': {
    title: 'Entregues',
    oQueE: 'Pedidos com entrega confirmada pela transportadora.',
    origem: 'Pedidos com pelo menos um pacote com `last_node` de entrega (sign_for, signed, delivered, sign_for_others).',
    onde: 'Painel Shein → Meus Pedidos → aba "Entregue".',
    difere: 'Validado: 1.118 (nosso) vs 1.120 (painel) na janela 13/06→13/07. Usamos o rastreio (mais fresco) e NÃO o status do pedido — o `order_status` da Shein atrasa muito (só 75 marcados "entregue" quando o painel já mostrava 1.120).',
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Por que pode diferir do painel</div>
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

function nodeBadge(nodeCode: string | null, nodeName: string | null): { label: string; cls: string } {
  if (!nodeCode) return { label: 'Aguardando', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' }
  const code = nodeCode.toLowerCase()
  if (['sign_for', 'signed', 'delivered', 'sign_for_others'].includes(code)) {
    return { label: nodeName || 'Entregue', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' }
  }
  if (code.includes('return') || code.includes('exception') || code.includes('fail')) {
    return { label: nodeName || 'Exceção', cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/30' }
  }
  if (code.includes('transport') || code.includes('transit')) {
    return { label: nodeName || 'Em trânsito', cls: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' }
  }
  return { label: nodeName || nodeCode, cls: 'bg-zinc-700/30 text-zinc-300 border border-zinc-600/40' }
}

export function EnviosView({
  shipments,
  totalCount,
  page,
  search,
  carrier,
  status,
  carriers,
  stats,
  nickname,
  period,
  customFrom,
  customTo,
}: {
  shipments: ShipmentRow[]
  totalCount: number
  page: number
  search: string
  carrier: string
  status: string
  carriers: string[]
  stats: { total: number; pending: number; transit: number; delivered: number }
  nickname?: string | null
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const [helpKey, setHelpKey] = useState<string | null>(null)

  useEffect(() => {
    if (!showDatePicker) return
    function onDown(e: MouseEvent) {
      if (!datePickerRef.current) return
      if (!datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showDatePicker])

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

  function setCarrier(v: string) {
    pushParams((next) => {
      if (!v) next.delete('carrier')
      else next.set('carrier', v)
    })
  }

  function setStatus(v: string) {
    pushParams((next) => {
      if (!v) next.delete('status')
      else next.set('status', v)
    })
  }

  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      if (p !== 'custom') {
        next.delete('from')
        next.delete('to')
      }
    })
  }

  function applyCustomRange(f: string, t: string) {
    pushParams((next) => {
      next.set('period', 'custom')
      next.set('from', f)
      next.set('to', t)
    })
    setShowDatePicker(false)
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
      <TopBar title="Envios — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Envios</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
              {(['7d', '30d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p === '7d' ? '7 dias' : '30 dias'}
                </button>
              ))}
            </div>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setShowDatePicker((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#050507] px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'custom' ? 'border-zinc-50/40 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                <span className="material-symbols-outlined text-[14px]">event</span>
                {period === 'custom' && customFrom && customTo
                  ? `${fmtDateBRShort(customFrom)} → ${fmtDateBRShort(customTo)}`
                  : 'Personalizado'}
              </button>
              {showDatePicker && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={applyCustomRange}
                  onClose={() => setShowDatePicker(false)}
                  align="right"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Envios" value={stats.total} icon="local_shipping" onHelp={setHelpKey} />
          <StatCard label="Aguardando" value={stats.pending} icon="schedule" tone="yellow" onHelp={setHelpKey} />
          <StatCard label="Em Trânsito" value={stats.transit} icon="route" tone="blue" onHelp={setHelpKey} />
          <StatCard label="Entregues" value={stats.delivered} icon="check_circle" tone="green" onHelp={setHelpKey} />
        </div>

        <div className="mb-lg flex flex-wrap items-center gap-3">
          <div className="relative w-[300px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40"
              placeholder="Buscar order, waybill, package ou produto..."
            />
          </div>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
          >
            <option value="">Todas transportadoras</option>
            {carriers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none focus:border-zinc-50/40"
          >
            <option value="">Todos status</option>
            <option value="pending">Aguardando</option>
            <option value="transit">Em trânsito</option>
            <option value="delivered">Entregues</option>
          </select>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Produto / Pedido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Transportadora</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Waybill</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Última atualização</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum envio encontrado.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => {
                  const badge = nodeBadge(s.last_node, s.last_node_name)
                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/shein/envios/${encodeURIComponent(s.waybill_no)}`)}
                      className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <p className="line-clamp-1 max-w-[320px] text-sm font-medium text-white">
                          {s.product_name || '—'}
                          {(s.item_count ?? 0) > 1 && <span className="ml-1 text-xs text-zinc-500">+{(s.item_count ?? 1) - 1}</span>}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">{s.order_no}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-300">{s.carrier || <span className="text-zinc-500">—</span>}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{s.waybill_no}</td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtRel(s.last_update_at)}</td>
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
