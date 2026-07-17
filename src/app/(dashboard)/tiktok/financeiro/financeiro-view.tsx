'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { cn } from '@/lib/utils'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'

const PAGE_SIZE = 50
type Period = '7d' | '30d' | '90d' | 'custom'

export type StatementRow = {
  statement_id: string | null
  settlement_amount: number | string | null
  fee: number | string | null
  revenue: number | string | null
  currency: string | null
  statement_time: string | null
  raw: { payment_status?: string | null } | null
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

type Tone = 'green' | 'yellow' | 'red' | 'gray'
const toneClasses: Record<Tone, string> = {
  green:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  red:    'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:   'bg-outline/20 text-zinc-500 border border-outline/30',
}
function payTone(s: string | null | undefined): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v === 'PAID') return 'green'
  if (v === 'FAILED') return 'red'
  if (v === 'PROCESSING') return 'yellow'
  return 'gray'
}

function KpiCard({ label, value, tone, soon }: { label: string; value: string; tone?: 'white' | 'green' | 'red'; soon?: boolean }) {
  const color = tone === 'green' ? 'text-secondary' : tone === 'red' ? 'text-error' : 'text-white'
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
        {soon && (
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-200">
            Em breve
          </span>
        )}
      </div>
      <p className={cn('mt-1 text-xl font-semibold', soon ? 'text-zinc-600' : color)}>{value}</p>
    </div>
  )
}

export function FinanceiroView({
  kpi,
  statements,
  totalCount,
  page,
  period,
  customFrom,
  customTo,
}: {
  kpi: { statements: number; repasse: number; taxas: number; receita: number }
  statements: StatementRow[]
  totalCount: number
  page: number
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const datePickerRef = useRef<HTMLDivElement>(null)

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
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }
  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      if (p !== 'custom') { next.delete('from'); next.delete('to') }
    })
  }
  function applyCustomRange(f: string, t: string) {
    pushParams((next) => { next.set('period', 'custom'); next.set('from', f); next.set('to', t) })
    setShowDatePicker(false)
  }
  function setPage(n: number) {
    pushParams((next) => { if (n <= 1) next.delete('page'); else next.set('page', String(n)) }, false)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <TopBar title="Financeiro — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn('rounded px-3 py-1 text-xs font-medium transition-colors', period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#050507] px-3 py-1.5 text-xs font-medium transition-colors', period === 'custom' ? 'border-zinc-50/40 text-white' : 'text-slate-400 hover:text-white')}
            >
              <span className="material-symbols-outlined text-[14px]">event</span>
              {period === 'custom' && customFrom && customTo ? `${fmtDateBRShort(customFrom)} → ${fmtDateBRShort(customTo)}` : 'Personalizado'}
            </button>
            {showDatePicker && (
              <DateRangePopover from={customFrom} to={customTo} onApply={applyCustomRange} onClose={() => setShowDatePicker(false)} align="right" />
            )}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard label="Repasse (líquido)" value={fmtBrl(kpi.repasse)} tone="green" />
          <KpiCard label="Receita bruta" value={fmtBrl(kpi.receita)} />
          <KpiCard label="Taxas TikTok" value={fmtBrl(kpi.taxas)} tone="red" />
          <KpiCard label="Comissão afiliados" value="—" soon />
          <KpiCard label="Ads" value="—" soon />
          <KpiCard label="Statements" value={kpi.statements.toLocaleString('pt-BR')} />
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Statement</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pagamento</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receita</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Taxas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Repasse</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {statements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum statement no período. Sync Statements roda a cada 6h.
                  </td>
                </tr>
              ) : (
                statements.map((s) => (
                  <tr key={s.statement_id} className="border-b border-zinc-800/60 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-[11px] text-zinc-400">{s.statement_id}</td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', toneClasses[payTone(s.raw?.payment_status)])}>
                        {s.raw?.payment_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-white">{fmtBrl(s.revenue, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtBrl(s.fee, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-right font-medium text-secondary">{fmtBrl(s.settlement_amount, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(s.statement_time)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
            <span className="text-sm text-slate-400">
              {totalCount === 0 ? '0 resultados' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} de ${totalCount}`}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <span className="px-2 text-xs text-slate-300">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Próximo</button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
