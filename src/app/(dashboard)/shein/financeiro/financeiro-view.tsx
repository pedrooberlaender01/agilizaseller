'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'all' | 'mes' | 'custom'

export type SettlementRow = {
  id: string
  settlement_id: string | null
  order_no: string | null
  gross_amount: number | string | null
  amount?: number | string | null
  fee: number | string | null
  commission: number | string | null
  service_charge: number | string | null
  estimated_income: number | string | null
  net_amount: number | string | null
  currency: string | null
  settlement_date: string | null
  created_at: string | null
}

const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
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

const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; onde: string; difere?: string }> = {
  'Bruto': {
    title: 'Bruto',
    oQueE: 'Soma do valor bruto dos settlements (liquidações) no período — o total antes de descontar comissão e taxas.',
    origem: '`sum(shein_settlements.gross_amount)` das liquidações com data no período.',
    onde: 'Painel Shein → Finanças → Minha renda → Registro de liquidação → abrir um lote → coluna de preço bruto.',
    difere: 'Só conta o que já foi LIQUIDADO (settlement gerado). Pedido vendido mas ainda não liquidado não entra — usar Extrato só pra dinheiro já processado.',
  },
  'Comissão Shein': {
    title: 'Comissão Shein',
    oQueE: 'Total de comissão da Shein cobrada nas liquidações do período (~18-20% por item).',
    origem: '`sum(shein_settlements.commission)`.',
    onde: 'Painel Shein → Registro de liquidação → detalhe do lote → coluna Comissão.',
    difere: 'Validado por lote: ex. lote 22/06 comissão -5.760,80 bate ao centavo com o export do painel.',
  },
  'Service charge': {
    title: 'Service charge',
    oQueE: 'Taxa de intermediação de frete / operação (fulfillment) cobrada pela Shein nas liquidações.',
    origem: '`sum(shein_settlements.service_charge)`.',
    onde: 'Painel Shein → Registro de liquidação → detalhe do lote → "Taxa de intermediação de frete".',
    difere: 'Validado por lote (ex. 22/06 = -2.414,00 exato).',
  },
  'Taxa total': {
    title: 'Taxa total',
    oQueE: 'Comissão + Service charge das liquidações. Percentual = taxa ÷ bruto.',
    origem: 'Calculado: soma de `fee` dos settlements.',
    onde: 'Não existe direto no painel — é a soma das duas taxas do detalhe do lote.',
  },
  'Receita líquida est.': {
    title: 'Receita líquida est.',
    oQueE: 'Valor líquido REAL que caiu na conta nas liquidações do período (o dinheiro efetivamente recebido).',
    origem: '`sum(shein_settlements.net_amount)` = `estimateIncomeMoneyTotal` das liquidações.',
    onde: 'Painel Shein → Registro de liquidação → "Valor liquidado" dos lotes.',
    difere: 'Validado 100%: 7 lotes recentes batem ao centavo com o painel (ex. 01/06 = 84.914,48). Só cobre o que já foi liquidado (settlements começam 18/03; lotes anteriores parciais).',
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-2xl border border-zinc-700 shadow-2xl" style={{ background: 'rgba(22,27,34,0.97)' }}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">help</span>
            {info.title}
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white transition-colors" aria-label="Fechar">
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Detalhe / validação</div>
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
    <button onClick={(e) => { e.stopPropagation(); onOpen(label) }} className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors" aria-label={`Explicação: ${label}`}>
      <span className="material-symbols-outlined text-[14px]">help</span>
    </button>
  )
}

function StatCard({ label, value, icon, tone = 'default', helpKey, onHelp }: { label: string; value: string; icon: string; tone?: 'default' | 'green' | 'red' | 'blue'; helpKey?: string; onHelp?: (key: string) => void }) {
  const toneCls = {
    default: 'text-white',
    green: 'text-secondary',
    red: 'text-error',
    blue: 'text-blue-400',
  }[tone]
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
          {onHelp && helpKey && <HelpButton label={helpKey} onOpen={onHelp} />}
        </div>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value}</p>
    </div>
  )
}

export function FinanceiroView({
  rows,
  totalCount,
  periodTotals,
  page,
  period,
  customFrom,
  customTo,
  search,
  nickname,
}: {
  rows: SettlementRow[]
  totalCount: number
  periodTotals: { gross: number; fee: number; commission: number; service: number; estimated: number; net: number }
  page: number
  period: Period
  customFrom: string | null
  customTo: string | null
  search: string
  nickname?: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounced(searchInput, 300)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [helpKey, setHelpKey] = useState<string | null>(null)
  const datePickerRef = useRef<HTMLDivElement | null>(null)

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

  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      if (p !== 'custom') {
        next.delete('from')
        next.delete('to')
      }
    })
  }

  function applyCustomRange(from: string, to: string) {
    pushParams((next) => {
      next.set('period', 'custom')
      next.set('from', from)
      next.set('to', to)
    })
    setShowDatePicker(false)
  }

  function setPage(n: number) {
    pushParams((next) => {
      if (n <= 1) next.delete('page')
      else next.set('page', String(n))
    }, false)
  }

  // Totais do PERÍODO inteiro (RPC agregada), não só página atual.
  const totals = periodTotals
  const taxaPct = totals.gross > 0 ? (totals.fee / totals.gross) * 100 : 0

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <TopBar title="Financeiro — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Liquidações</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
            <div className="mt-3 inline-flex gap-2 rounded-lg border border-zinc-800 bg-[#050507] p-1 text-xs">
              <span className="rounded bg-white/10 px-3 py-1 font-medium text-white">Extrato</span>
              <Link
                href="/shein/financeiro/saques"
                className="rounded px-3 py-1 font-medium text-slate-400 transition-colors hover:text-white"
              >
                Saques
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
              {(['7d', '30d', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p === 'all' ? 'Tudo' : p === '7d' ? '7 dias' : '30 dias'}
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

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Bruto" value={fmtBrl(totals.gross)} icon="payments" tone="blue" helpKey="Bruto" onHelp={setHelpKey} />
          <StatCard label="Comissão Shein" value={fmtBrl(totals.commission)} icon="percent" tone="red" helpKey="Comissão Shein" onHelp={setHelpKey} />
          <StatCard label="Service charge" value={fmtBrl(totals.service)} icon="local_shipping" tone="red" helpKey="Service charge" onHelp={setHelpKey} />
          <StatCard label={`Taxa total (${taxaPct.toFixed(1)}%)`} value={fmtBrl(totals.fee)} icon="receipt" tone="red" helpKey="Taxa total" onHelp={setHelpKey} />
          <StatCard label="Receita líquida est." value={fmtBrl(totals.estimated)} icon="account_balance_wallet" tone="green" helpKey="Receita líquida est." onHelp={setHelpKey} />
        </div>

        <div className="mb-lg flex flex-wrap items-center gap-4">
          <div className="relative w-[280px]">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 focus:ring-1 focus:ring-tertiary"
              placeholder="Buscar settlement_id ou order_no..."
            />
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Settlement ID</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Bruto</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Comissão</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Service</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido est.</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Sem liquidações no período. Aguarde sync de settlements.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-800/60 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-xs text-white">{s.settlement_id || '—'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{s.order_no || '—'}</td>
                    <td className="px-6 py-4 text-right">{fmtBrl(s.gross_amount ?? s.amount, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtBrl(s.commission, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtBrl(s.service_charge, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right font-medium text-secondary">{fmtBrl(s.estimated_income, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(s.settlement_date)}</td>
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
      <InfoModal infoKey={helpKey} onClose={() => setHelpKey(null)} />
    </>
  )
}
