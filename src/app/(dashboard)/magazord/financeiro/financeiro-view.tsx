'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'custom'

export type Resumo = {
  gerado?: number | string
  recebido?: number | string
  pendente_baixa?: number | string
  a_pagar_gerado?: number | string
  pago?: number | string
  a_pagar_aberto?: number | string
  titulos_gerados?: number | string
  titulos_pendentes?: number | string
}

export type FormaRow = { forma: string; total: number | string; titulos: number | string }

export type ContaReceber = {
  titulo_id: number
  numero: string | null
  pessoa_nome: string | null
  pedido_codigo: string | null
  valor_original: number | string | null
  valor_liquidado: number | string | null
  saldo: number | string | null
  data_vencimento: string | null
  data_geracao: string | null
  situacao_descricao: string | null
  forma_recebimento_nome: string | null
  parcela: string | null
}

export type ContaPagar = {
  titulo_id: number
  numero: string | null
  pessoa_nome: string | null
  valor_original: number | string | null
  valor_liquidado: number | string | null
  saldo: number | string | null
  data_vencimento: string | null
  data_geracao: string | null
  situacao_descricao: string | null
}

const n = (v: number | string | null | undefined) => Number(v ?? 0)
const fmtBrl = (v: number | string | null | undefined) =>
  `R$ ${n(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = (v: number | string | null | undefined) => n(v).toLocaleString('pt-BR')
const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// ── Explicação de cada card (?) ──
const FIN_INFO: Record<string, { title: string; oQueE: string; origem: string }> = {
  'Gerado': {
    title: 'Gerado',
    oQueE: 'Valor dos títulos a receber gerados no período — as vendas que entraram no financeiro do ERP.',
    origem: 'Soma do valor original dos títulos do Contas a Receber com data de geração no período.',
  },
  'Recebido': {
    title: 'Recebido (baixado)',
    oQueE: 'Valor efetivamente conciliado/baixado no ERP no período (títulos Liquidados ou Compensados).',
    origem: 'Soma do valor liquidado dos títulos com movimento de baixa dentro do período. Atenção: no ERP do Lucas a baixa costuma atrasar, então esse número tende a ser menor que o gerado — não é dinheiro que faltou, é conciliação pendente.',
  },
  'Pendente de Baixa': {
    title: 'Pendente de Baixa',
    oQueE: 'Títulos gerados no período que ainda estão em aberto no ERP (não baixados). NÃO é dívida de cliente — o cliente já pagou via marketplace/gateway; é backlog de conciliação do Magazord.',
    origem: 'Soma do saldo em aberto dos títulos gerados no período. A maioria fica "Aberto Total" com vencimento no próprio dia da venda.',
  },
  '% Baixa': {
    title: '% de Baixa',
    oQueE: 'Percentual do que foi gerado que já foi baixado/conciliado no período.',
    origem: 'Cálculo: Recebido ÷ Gerado. Mede o ritmo de conciliação do financeiro, não vendas perdidas.',
  },
  'A Pagar': {
    title: 'A Pagar',
    oQueE: 'Títulos do Contas a Pagar gerados no período ainda em aberto.',
    origem: 'Soma do saldo em aberto dos títulos de Contas a Pagar gerados no período. No Lucas parecem ser reembolsos/estornos a clientes — confirmar com a operação.',
  },
  'Pago': {
    title: 'Pago',
    oQueE: 'Contas a Pagar baixadas no período.',
    origem: 'Soma do valor liquidado dos títulos de Contas a Pagar com baixa no período.',
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
  const info = FIN_INFO[infoKey]
  if (!info) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-2xl border border-zinc-700 shadow-2xl" style={{ background: 'rgba(22,27,34,0.97)' }}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-50">
            <Icon name="help" size={18} className="text-primary" />
            {info.title}
          </h3>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">O que é</div>
            <p className="text-sm leading-relaxed text-zinc-300">{info.oQueE}</p>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">De onde vem o dado</div>
            <p className="text-sm leading-relaxed text-zinc-400">{info.origem}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, tone = 'default', sub, onInfo }: {
  label: string
  value: string
  icon: string
  tone?: 'default' | 'green' | 'red' | 'blue' | 'amber'
  sub?: string | null
  onInfo?: (label: string) => void
}) {
  const toneCls = {
    default: 'text-white',
    green: 'text-secondary',
    red: 'text-error',
    blue: 'text-primary',
    amber: 'text-amber-300',
  }[tone]
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
          {onInfo && FIN_INFO[label] && (
            <button
              type="button"
              onClick={() => onInfo(label)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
              aria-label={`Explicação: ${label}`}
            >
              <Icon name="help" size={14} />
            </button>
          )}
        </span>
        <Icon name={icon} size={18} className="text-outline" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

export function FinanceiroView({
  period,
  from,
  to,
  resumo,
  formas,
  receber,
  pagar,
  nickname,
}: {
  period: Period
  from: string | null
  to: string | null
  resumo: Resumo
  formas: FormaRow[]
  receber: ContaReceber[]
  pagar: ContaPagar[]
  nickname?: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState<'overview' | 'receber' | 'pagar' | 'formas'>('overview')
  const [infoKey, setInfoKey] = useState<string | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dateOpen) return
    function onDoc(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [dateOpen])

  function setPeriod(p: Period) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', p)
    if (p !== 'custom') {
      next.delete('from')
      next.delete('to')
    }
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }

  function applyCustom(fromIso: string, toIso: string) {
    setDateOpen(false)
    const next = new URLSearchParams(sp.toString())
    next.set('period', 'custom')
    next.set('from', fromIso)
    next.set('to', toIso)
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }

  const customLabel = period === 'custom' && from && to ? `${fmtDateBRShort(from)} – ${fmtDateBRShort(to)}` : 'Personalizar'

  const gerado = n(resumo.gerado)
  const recebido = n(resumo.recebido)
  const pctBaixa = gerado > 0 ? (recebido / gerado) * 100 : 0

  const cards = [
    { label: 'Gerado', value: fmtBrl(resumo.gerado), icon: 'receipt_long', tone: 'green' as const, sub: `${fmtInt(resumo.titulos_gerados)} títulos no período` },
    { label: 'Recebido', value: fmtBrl(resumo.recebido), icon: 'trending_up', tone: 'green' as const, sub: 'baixado/conciliado no período' },
    { label: 'Pendente de Baixa', value: fmtBrl(resumo.pendente_baixa), icon: 'hourglass_empty', tone: 'amber' as const, sub: `${fmtInt(resumo.titulos_pendentes)} títulos — backlog ERP, não é dívida` },
    { label: '% Baixa', value: `${pctBaixa.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, icon: 'percent', tone: 'default' as const, sub: 'Recebido ÷ Gerado' },
    { label: 'A Pagar', value: fmtBrl(resumo.a_pagar_aberto), icon: 'call_made', tone: 'red' as const, sub: 'em aberto, gerado no período' },
    { label: 'Pago', value: fmtBrl(resumo.pago), icon: 'trending_down', tone: 'red' as const, sub: 'baixado no período' },
  ]

  const formaMax = Math.max(1, ...formas.map((f) => n(f.total)))

  return (
    <>
      <TopBar title="Financeiro — Magazord" />
      <InfoModal infoKey={infoKey} onClose={() => setInfoKey(null)} />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Financeiro</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
              {(['7d', '30d', '90d'] as const).map((p) => (
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
            <div ref={dateRef} className="relative">
              <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'custom'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-white/10 bg-[#050507] text-slate-400 hover:border-primary/30 hover:text-white',
                )}
              >
                <Icon name="event" size={14} />
                <span className={cn(period === 'custom' && 'font-mono tracking-tight')}>{customLabel}</span>
                <Icon name={dateOpen ? 'expand_less' : 'expand_more'} size={14} className="text-outline" />
              </button>
              {dateOpen && <DateRangePopover from={from} to={to} onApply={applyCustom} onClose={() => setDateOpen(false)} />}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-lg flex items-center gap-1 border-b border-zinc-800">
          {[
            { key: 'overview' as const, label: 'Visão Geral', icon: 'dashboard' },
            { key: 'receber' as const, label: 'Contas a Receber', icon: 'call_received' },
            { key: 'pagar' as const, label: 'Contas a Pagar', icon: 'call_made' },
            { key: 'formas' as const, label: 'Formas de Recebimento', icon: 'payments' },
          ].map((t) => {
            const active = view === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  active ? 'border-primary text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-200',
                )}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </button>
            )
          })}
        </div>

        {view === 'overview' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} sub={c.sub} onInfo={setInfoKey} />
            ))}
          </div>
        )}

        {view === 'receber' && (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Título</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Cliente</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Saldo</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Vencimento</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Situação</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Forma</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {receber.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-outline">Sem títulos a receber sincronizados.</td></tr>
                ) : (
                  receber.map((r) => (
                    <tr key={r.titulo_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{r.numero}</td>
                      <td className="px-5 py-3 text-xs">{r.pessoa_nome ?? '—'}</td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400">{r.pedido_codigo ?? '—'}</td>
                      <td className="px-5 py-3 text-right">{fmtBrl(r.valor_original)}</td>
                      <td className={cn('px-5 py-3 text-right font-medium', n(r.saldo) > 0 ? 'text-amber-300' : 'text-secondary')}>{fmtBrl(r.saldo)}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">{fmtDate(r.data_vencimento)}</td>
                      <td className="px-5 py-3 text-xs text-slate-300">{r.situacao_descricao ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">{r.forma_recebimento_nome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {view === 'pagar' && (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Título</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Fornecedor</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Valor</th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Saldo</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Vencimento</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-400">Situação</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {pagar.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-outline">Sem títulos a pagar sincronizados.</td></tr>
                ) : (
                  pagar.map((r) => (
                    <tr key={r.titulo_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{r.numero}</td>
                      <td className="px-5 py-3 text-xs">{r.pessoa_nome ?? '—'}</td>
                      <td className="px-5 py-3 text-right">{fmtBrl(r.valor_original)}</td>
                      <td className={cn('px-5 py-3 text-right font-medium', n(r.saldo) > 0 ? 'text-error' : 'text-secondary')}>{fmtBrl(r.saldo)}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">{fmtDate(r.data_vencimento)}</td>
                      <td className="px-5 py-3 text-xs text-slate-300">{r.situacao_descricao ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {view === 'formas' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h3 className="mb-1 text-sm font-semibold text-white">Recebido por forma — no período</h3>
            <p className="mb-5 text-xs text-slate-400">Valor liquidado dos títulos a receber, agrupado por forma de recebimento.</p>
            {formas.length === 0 ? (
              <p className="py-8 text-center text-sm text-outline">Sem recebimentos no período.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {formas.map((f) => {
                  const pct = (n(f.total) / formaMax) * 100
                  return (
                    <div key={f.forma}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-200">{f.forma} <span className="text-slate-500">· {fmtInt(f.titulos)} títulos</span></span>
                        <span className="font-medium text-secondary">{fmtBrl(f.total)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-secondary/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
