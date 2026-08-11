'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { TopBar } from '@/components/top-bar'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import type { Period } from '@/components/metrics-chart'
import { cn } from '@/lib/utils'

export type AdsDailyRow = {
  date: string
  cost: number
  clicks: number
  prints: number
  gmv: number
}

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const fmtRoas = (n: number) => `${n.toFixed(2).replace('.', ',')}x`
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function AdsView({
  rows,
  faturamento,
  period,
  customFrom,
  customTo,
}: {
  rows: AdsDailyRow[]
  faturamento: number
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLSpanElement>(null)
  const isCustom = !!(customFrom && customTo)

  useEffect(() => {
    if (!popoverOpen) return
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  useEffect(() => {
    if (!openInfo) return
    const onDoc = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setOpenInfo(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openInfo])

  function setPeriod(p: Period) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    sp.delete('from')
    sp.delete('to')
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(fromIso: string, toIso: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('period')
    sp.set('from', fromIso)
    sp.set('to', toIso)
    setPopoverOpen(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const t = useMemo(() => {
    const cost = rows.reduce((a, r) => a + r.cost, 0)
    const gmv = rows.reduce((a, r) => a + r.gmv, 0)
    const clicks = rows.reduce((a, r) => a + r.clicks, 0)
    const prints = rows.reduce((a, r) => a + r.prints, 0)
    const dias = Math.max(rows.length, 1)
    return {
      cost, gmv, clicks, prints, dias,
      roas: cost > 0 ? gmv / cost : 0,
      acos: gmv > 0 ? (cost / gmv) * 100 : 0,
      ctr: prints > 0 ? (clicks / prints) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      pctVendas: faturamento > 0 ? (gmv / faturamento) * 100 : 0,
    }
  }, [rows, faturamento])

  // últimos 2 dias com gasto, pro comparativo (o dia corrente não entra no sync)
  const comAlgo = rows.filter((r) => r.cost > 0 || r.gmv > 0)
  const ultimo = comAlgo[comAlgo.length - 1]
  const penultimo = comAlgo[comAlgo.length - 2]

  function infoTip(label: string, info: ReactNode, alignRight?: boolean) {
    const open = openInfo === label
    return (
      <span ref={open ? infoRef : undefined} className="relative inline-flex normal-case">
        <button
          type="button"
          onClick={() => setOpenInfo(open ? null : label)}
          aria-label={`Sobre ${label}`}
          className="flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[13px]">help</span>
        </button>
        {open && (
          <div
            className={cn(
              'absolute top-full z-50 mt-2 w-[280px] rounded-xl border border-white/10 bg-[#0d1117] p-3 text-left text-[11px] font-normal leading-relaxed tracking-normal text-on-surface-variant shadow-2xl shadow-black/60',
              alignRight ? 'right-0' : 'left-0',
            )}
          >
            {info}
          </div>
        )}
      </span>
    )
  }

  const kpis: { label: string; value: string; icon: string; tone: string; sub?: string; info?: ReactNode }[] = [
    {
      label: 'Investido', value: fmtBrlInt(t.cost), icon: 'payments', tone: 'text-error',
      sub: `média ${fmtBrlInt(t.cost / t.dias)}/dia`,
      info: (
        <>
          Gasto em Product Ads no período, somado dia a dia da API de publicidade do ML.
          <br /><br />
          <span className="font-semibold text-on-background">Onde conferir:</span> Marketing → Publicidade (painel Mercado Ads). Validado ao centavo.
          <br /><br />
          O dia de hoje não entra: a atribuição do ML fecha às 10h e valores de dias recentes ainda se ajustam.
        </>
      ),
    },
    {
      label: 'Vendido via Ads', value: fmtBrlInt(t.gmv), icon: 'shopping_cart', tone: 'text-primary-fixed',
      sub: 'receita atribuída aos anúncios',
      info: <>Receita que o ML atribui aos seus anúncios (venda direta + indireta), no período. É o retorno bruto do investimento em Ads.</>,
    },
    {
      label: 'ROAS', value: t.cost > 0 ? fmtRoas(t.roas) : '—', icon: 'trending_up', tone: 'text-secondary',
      sub: 'vendido ÷ investido',
      info: <>Retorno sobre o investimento: cada R$ 1 em Ads trouxe <span className="text-on-surface">{t.cost > 0 ? fmtRoas(t.roas) : '—'}</span> em vendas. Quanto maior, melhor.</>,
    },
    {
      label: 'ACOS', value: t.gmv > 0 ? fmtPct(t.acos) : '—', icon: 'pie_chart', tone: 'text-tertiary',
      sub: 'investido ÷ vendido',
      info: <>Quanto do que vendeu via Ads foi gasto em Ads. É o inverso do ROAS — quanto <span className="text-on-surface">menor</span>, melhor.</>,
    },
    {
      label: '% Vendas via Ads', value: faturamento > 0 ? fmtPct(t.pctVendas) : '—', icon: 'campaign', tone: 'text-on-surface',
      sub: 'vendido via Ads ÷ faturamento',
      info: (
        <>
          Fatia do <span className="text-on-surface">faturamento total</span> que veio de anúncios pagos. Base: vendas concluídas do período (mesma do Financeiro).
          <br /><br />
          <span className="text-tertiary">Não compare com o % do painel do ML</span> — lá o cálculo é sobre <span className="text-on-surface">só os itens anunciados</span> e em nº de vendas, não em faturamento. São perguntas diferentes; a daqui é &quot;quanto do meu faturamento veio de Ads&quot;.
        </>
      ),
    },
    {
      label: 'Impressões', value: fmtNum(t.prints), icon: 'visibility', tone: 'text-on-surface',
      sub: `${(t.prints / t.dias / 1000).toFixed(1)}k/dia`,
      info: <>Quantas vezes seus anúncios apareceram pra compradores no período.</>,
    },
    {
      label: 'Cliques', value: fmtNum(t.clicks), icon: 'ads_click', tone: 'text-primary-fixed',
      sub: `${fmtNum(t.clicks / t.dias)}/dia`,
      info: <>Cliques nos seus anúncios — as visitas que você pagou pra ter.</>,
    },
    {
      label: 'CTR', value: t.prints > 0 ? fmtPct(t.ctr) : '—', icon: 'percent', tone: 'text-on-surface',
      sub: 'cliques ÷ impressões',
      info: <>Taxa de clique: de cada 100 vezes que o anúncio apareceu, quantas viraram clique. Mede o quanto o anúncio chama atenção.</>,
    },
    {
      label: 'CPC', value: t.clicks > 0 ? `R$ ${fmtBrl(t.cpc)}` : '—', icon: 'sell', tone: 'text-error',
      sub: 'custo por clique',
      info: <>Quanto você paga, em média, por cada clique.</>,
    },
  ]

  const tableRows = useMemo(() => [...rows].reverse().slice(0, 31), [rows])
  const maxCost = Math.max(...rows.map((r) => r.cost), 1)

  return (
    <>
      <TopBar showSearch />
      <div className={cn('p-margin flex flex-col gap-gutter flex-1 overflow-y-auto', pending && 'opacity-70 pointer-events-none transition-opacity')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface flex items-center gap-sm">
              Ads
              <span className="text-outline font-normal">—</span>
              <span className="text-primary-fixed">Mercado Livre</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Product Ads (Mercado Ads). O dia de hoje não entra — a atribuição do ML fecha às 10h.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/10 bg-[#050507] p-1">
              {periods.map((p) => {
                const active = !isCustom && period === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                  isCustom
                    ? 'border-primary/40 bg-primary-container/60 text-on-primary-container'
                    : 'border-white/10 bg-surface-container-high/50 text-on-surface hover:bg-surface-container-high/80',
                )}
              >
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_month</span>
                {isCustom ? `${fmtDateBRShort(customFrom!)} – ${fmtDateBRShort(customTo!)}` : 'Personalizar'}
              </button>
              {popoverOpen && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={applyCustomRange}
                  onClose={() => setPopoverOpen(false)}
                  align="right"
                />
              )}
            </div>
          </div>
        </div>

        {/* Comparativo dos 2 últimos dias com dado */}
        {ultimo && (
          <div className="rounded-xl border border-white/10 bg-surface-container/70 p-lg backdrop-blur-[16px]">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant">
                Último dia com dado · {shortDate(ultimo.date)}
              </div>
              {penultimo && <div className="text-[10px] text-outline">vs {shortDate(penultimo.date)}</div>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Investido', curr: ultimo.cost, prev: penultimo?.cost ?? 0, value: fmtBrlInt(ultimo.cost), tone: 'text-error', invert: true },
                { label: 'Vendido via Ads', curr: ultimo.gmv, prev: penultimo?.gmv ?? 0, value: fmtBrlInt(ultimo.gmv), tone: 'text-primary-fixed', invert: false },
                {
                  label: 'ROAS',
                  curr: ultimo.cost > 0 ? ultimo.gmv / ultimo.cost : 0,
                  prev: penultimo && penultimo.cost > 0 ? penultimo.gmv / penultimo.cost : 0,
                  value: ultimo.cost > 0 ? fmtRoas(ultimo.gmv / ultimo.cost) : '—',
                  tone: 'text-secondary', invert: false,
                },
                { label: 'Cliques', curr: ultimo.clicks, prev: penultimo?.clicks ?? 0, value: fmtNum(ultimo.clicks), tone: 'text-on-surface', invert: false },
              ].map((k) => {
                const pct = k.prev > 0 ? ((k.curr - k.prev) / k.prev) * 100 : 0
                const flat = !penultimo || k.prev === 0 || Math.abs(pct) < 0.05
                const up = pct > 0
                const bom = k.invert ? !up : up
                return (
                  <div key={k.label} className="rounded-lg border border-white/5 bg-surface-container/60 p-md">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant">{k.label}</div>
                    <div className={cn('font-h3 text-h3 mt-1', k.tone)}>{k.value}</div>
                    <div className={cn('mt-0.5 font-mono text-[10px]', flat ? 'text-outline' : bom ? 'text-secondary' : 'text-error')}>
                      {flat ? '· —' : `${up ? '↑' : '↓'} ${Math.abs(pct).toFixed(1).replace('.', ',')}%`}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* KPIs do período */}
        <div className="grid grid-cols-2 gap-gutter md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((kpi, i) => {
            const open = openInfo === kpi.label
            return (
              <div
                key={kpi.label}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border border-white/10 bg-surface-container/70 p-lg backdrop-blur-[16px] transition-colors hover:bg-surface-container/90',
                  open && 'z-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    {kpi.label}
                    {kpi.info ? infoTip(kpi.label, kpi.info, i % 5 >= 3) : null}
                  </span>
                  <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
                </div>
                <div className={cn('font-h2 text-h2', kpi.tone)}>{kpi.value}</div>
                {kpi.sub && <div className="text-[10px] text-on-surface-variant/70">{kpi.sub}</div>}
              </div>
            )
          })}
        </div>

        {/* Série diária */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-surface-container/70 backdrop-blur-[16px]">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-on-surface">Dia a dia</h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">Últimos {tableRows.length} dias com registro.</p>
          </div>
          {tableRows.length === 0 ? (
            <div className="p-xl text-center text-sm text-on-surface-variant">
              Sem dados de Ads no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-highest/40">
                  <tr>
                    <th className="px-lg py-3 text-left text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Data</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Investido</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Vendido</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">ROAS</th>
                    <th className="px-md py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Cliques</th>
                    <th className="px-lg py-3 text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Impressões</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tableRows.map((r) => {
                    const roas = r.cost > 0 ? r.gmv / r.cost : 0
                    const hojeIso = new Date().toISOString().slice(0, 10)
                    const parcial = r.date === hojeIso
                    return (
                      <tr key={r.date} className="relative hover:bg-white/[0.02]">
                        <td className="px-lg py-3 text-on-surface">
                          <span className="relative z-10">
                            {shortDate(r.date)}
                            {parcial && (
                              <span className="ml-1.5 rounded bg-tertiary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-tertiary">
                                parcial
                              </span>
                            )}
                          </span>
                          <span
                            className="absolute inset-y-0 left-0 bg-primary/10"
                            style={{ width: `${(r.cost / maxCost) * 100}%` }}
                          />
                        </td>
                        <td className="px-md py-3 text-right font-mono-sm text-error">{fmtBrl(r.cost)}</td>
                        <td className="px-md py-3 text-right font-mono-sm text-primary-fixed">{fmtBrl(r.gmv)}</td>
                        <td className={cn('px-md py-3 text-right font-mono-sm', roas >= 3 ? 'text-secondary' : 'text-on-surface')}>
                          {r.cost > 0 ? fmtRoas(roas) : '—'}
                        </td>
                        <td className="px-md py-3 text-right font-mono-sm text-on-surface-variant">{fmtNum(r.clicks)}</td>
                        <td className="px-lg py-3 text-right font-mono-sm text-on-surface-variant">{fmtNum(r.prints)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
