'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { MarketplaceLogo, marketplaceLabel } from '@/components/marketplace-logo'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import type { CanalFilter, CanalSlug, UnifiedMetrics, DespesaKey, ShopeeExtras, SheinExtras, DeltaPair } from '@/lib/marketplace-metrics'
import type { Period } from '@/lib/marketplace-metrics'

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtBrl2 = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtNum = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const fmtShortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type Trend = 'up' | 'down' | 'flat'

function deltaPct(curr: number, prev: number): { delta: string; trend: Trend } {
  if (prev === 0) return { delta: '—', trend: 'flat' }
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return { delta: '0,0%', trend: 'flat' }
  return {
    delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`,
    trend: pct >= 0 ? 'up' : 'down',
  }
}

function KpiCard({
  label,
  value,
  pair,
  icon,
  iconClass = 'text-zinc-500',
  valueClass = 'text-white',
  invert = false,
  sub,
  unavailable = false,
}: {
  label: string
  value: string
  pair?: DeltaPair
  icon: string
  iconClass?: string
  valueClass?: string
  invert?: boolean
  sub?: string
  unavailable?: boolean
}) {
  const d = pair ? deltaPct(pair.cur, pair.prev) : null
  const trendCls =
    d?.trend === 'flat' || !d
      ? 'text-zinc-500'
      : (invert ? d.trend === 'down' : d.trend === 'up')
        ? 'text-emerald-300'
        : 'text-rose-300'
  const trendIcon =
    !d || d.trend === 'flat' ? 'trending_flat' : d.trend === 'up' ? 'arrow_drop_up' : 'arrow_drop_down'
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</span>
        <span className={cn('material-symbols-outlined text-[18px]', iconClass)}>{icon}</span>
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', unavailable ? 'text-zinc-600' : valueClass)}>
        {unavailable ? '—' : value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {!unavailable && d && (
          <span className={cn('inline-flex items-center text-xs font-medium', trendCls)}>
            <span className="material-symbols-outlined text-[16px]">{trendIcon}</span>
            {d.delta}
          </span>
        )}
        {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
      </div>
    </div>
  )
}

const CANAL_OPTIONS: CanalSlug[] = ['shopee', 'shein']

function MarketplaceSelect({ current }: { current: CanalFilter }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function changeCanal(canal: CanalFilter) {
    const next = new URLSearchParams(sp.toString())
    if (canal === 'all') next.delete('canal')
    else next.set('canal', canal)
    setOpen(false)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  const isAll = current === 'all'
  const currentLabel = isAll ? 'Todos marketplaces' : marketplaceLabel(current)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-[36px] items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors',
          !isAll
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-white/10 bg-[#050507] text-slate-300 hover:border-primary/30 hover:text-white',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isAll ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-zinc-400">
            <Icon name="apps" size={12} />
          </span>
        ) : (
          <MarketplaceLogo name={current} size={20} />
        )}
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <Icon
          name="expand_more"
          size={14}
          className={cn('text-zinc-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]/97 shadow-2xl shadow-black/70 backdrop-blur-xl"
        >
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Filtrar por marketplace
            </p>
          </div>
          <div className="max-h-[340px] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => changeCanal('all')}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                isAll ? 'bg-primary/10 text-primary' : 'text-slate-200 hover:bg-white/5',
              )}
            >
              <span className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                isAll ? 'bg-primary/15 text-primary' : 'bg-white/5 text-zinc-400',
              )}>
                <Icon name="apps" size={14} />
              </span>
              <span className="flex-1 font-medium">Todos marketplaces</span>
              {isAll && <Icon name="check" size={14} className="text-primary" />}
            </button>

            <div className="my-1 h-px bg-white/5" />

            {CANAL_OPTIONS.map((opt) => {
              const active = current === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => changeCanal(opt)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-slate-200 hover:bg-white/5',
                  )}
                >
                  <MarketplaceLogo name={opt} size={28} />
                  <span className="flex-1">{marketplaceLabel(opt)}</span>
                  {active && <Icon name="check" size={14} className="text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PeriodSwitcher({ period, isCustom }: { period: Period; isCustom: boolean }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()

  function setPeriod(p: Period) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', p)
    next.delete('from')
    next.delete('to')
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  return (
    <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
      {periods.map((p) => (
        <button
          key={p.key}
          onClick={() => setPeriod(p.key)}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            !isCustom && period === p.key ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function ShopeeExtrasCard({ extras }: { extras: ShopeeExtras }) {
  return (
    <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2">
      <KpiCard
        label="Lucro Bruto Macro"
        value={fmtBrl(extras.lucroBrutoMacro.cur)}
        pair={extras.lucroBrutoMacro}
        icon="account_balance_wallet"
        iconClass="text-emerald-400"
        valueClass="text-emerald-300"
        sub="Faturamento − Taxa − Comissão − Ads"
      />
      <KpiCard
        label="Margem Macro"
        value={fmtPct(extras.margemMacro.cur)}
        pair={extras.margemMacro}
        icon="percent"
        iconClass="text-zinc-500"
        valueClass={extras.margemMacro.cur >= 20 ? 'text-emerald-300' : extras.margemMacro.cur >= 10 ? 'text-amber-300' : 'text-rose-300'}
        sub="Lucro Bruto / Faturamento"
      />
    </div>
  )
}

function SheinExtrasCard({ extras }: { extras: SheinExtras }) {
  const marginTone = extras.margemRealPct >= 30 ? 'text-emerald-300' : extras.margemRealPct >= 10 ? 'text-amber-300' : 'text-rose-300'
  const covTone = extras.cobertaPct >= 80 ? 'text-emerald-300' : extras.cobertaPct >= 40 ? 'text-amber-300' : 'text-rose-300'
  return (
    <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Lucro Real"
        value={fmtBrl(extras.lucroReal)}
        icon="account_balance_wallet"
        iconClass="text-emerald-400"
        valueClass={extras.lucroReal >= 0 ? 'text-emerald-300' : 'text-rose-300'}
        sub="SKUs c/ custo preenchido"
      />
      <KpiCard
        label="Margem Real"
        value={fmtPct(extras.margemRealPct)}
        icon="percent"
        valueClass={marginTone}
        sub="Lucro / Receita coberta"
      />
      <KpiCard
        label="Custo Total"
        value={fmtBrl(extras.custoTotal)}
        icon="paid"
        iconClass="text-rose-300"
        valueClass="text-rose-300"
        sub={`${fmtNum(extras.unidadesCobertas)} unid. c/ custo`}
      />
      <KpiCard
        label="Cobertura Custo"
        value={fmtPct(extras.cobertaPct)}
        icon="data_check"
        valueClass={covTone}
        sub={`${fmtNum(extras.unidadesSemCusto)} unid. sem custo`}
      />
    </div>
  )
}

export function MetricasView({
  metrics,
  canal,
  period,
  customFrom,
  customTo,
}: {
  metrics: UnifiedMetrics
  canal: CanalFilter
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const isCustom = !!(customFrom && customTo)
  const router = useRouter()
  const sp = useSearchParams()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!popoverOpen) return
    function onClick(e: MouseEvent) {
      if (!popoverRef.current?.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [popoverOpen])

  function onCustomApply(from: string, to: string) {
    const next = new URLSearchParams(sp.toString())
    next.delete('period')
    next.set('from', from)
    next.set('to', to)
    setPopoverOpen(false)
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const taxaCancel = metrics.pedidos.cur > 0 ? (metrics.cancelamentos.cur / metrics.pedidos.cur) * 100 : 0
  const prevTaxaCancel = metrics.pedidos.prev > 0 ? (metrics.cancelamentos.prev / metrics.pedidos.prev) * 100 : 0

  const vendasKpis = [
    { label: 'Faturamento', value: fmtBrl(metrics.faturamento.cur), pair: metrics.faturamento, icon: 'payments', iconClass: 'text-emerald-400', valueClass: 'text-white' },
    { label: 'Pedidos', value: fmtNum(metrics.pedidos.cur), pair: metrics.pedidos, icon: 'shopping_cart', iconClass: 'text-blue-400', valueClass: 'text-white' },
    { label: 'Ticket Médio', value: fmtBrl(metrics.ticketMedio.cur), pair: metrics.ticketMedio, icon: 'trending_up', iconClass: 'text-zinc-400', valueClass: 'text-white' },
    {
      label: 'Cancelamentos',
      value: fmtPct(taxaCancel),
      pair: { cur: taxaCancel, prev: prevTaxaCancel },
      invert: true,
      icon: 'remove_shopping_cart',
      iconClass: 'text-rose-400',
      valueClass: 'text-white',
      sub: `${fmtNum(metrics.cancelamentos.cur)} de ${fmtNum(metrics.pedidos.cur + metrics.cancelamentos.cur)}`,
    },
  ]

  const taxaLabel = canal === 'shopee' ? 'Taxa Shopee' : canal === 'shein' ? 'Taxa Shein' : 'Taxas'
  const taxaIcon = canal === 'shein' ? 'receipt_long' : 'local_shipping'
  const despesasMeta: { key: DespesaKey; label: string; icon: string; sub?: string }[] = [
    { key: 'ads', label: 'Ads', icon: 'campaign' },
    { key: 'afiliados', label: 'Comissão Afiliados', icon: 'group', sub: canal !== 'shein' ? 'AMS API — aguardando aprovação app' : undefined },
    { key: 'taxa', label: taxaLabel, icon: taxaIcon },
    { key: 'comissao', label: 'Comissão', icon: 'percent' },
    { key: 'antecipacoes', label: 'Antecipações', icon: 'flash_on' },
  ]

  const totalDespesas =
    (metrics.despesas.ads?.cur ?? 0) +
    (metrics.despesas.afiliados?.cur ?? 0) +
    (metrics.despesas.taxa?.cur ?? 0) +
    (metrics.despesas.comissao?.cur ?? 0) +
    (metrics.despesas.antecipacoes?.cur ?? 0)
  const prevTotalDespesas =
    (metrics.despesas.ads?.prev ?? 0) +
    (metrics.despesas.afiliados?.prev ?? 0) +
    (metrics.despesas.taxa?.prev ?? 0) +
    (metrics.despesas.comissao?.prev ?? 0) +
    (metrics.despesas.antecipacoes?.prev ?? 0)

  return (
    <>
      <TopBar title="Métricas" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h2 font-semibold text-white">Visão geral</h2>
            {metrics.nickname && <p className="mt-1 text-xs text-zinc-400">Conexão: {metrics.nickname}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MarketplaceSelect current={canal} />
            <PeriodSwitcher period={period} isCustom={isCustom} />
            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex h-[36px] items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors',
                  isCustom
                    ? 'border-zinc-50 bg-zinc-50 text-zinc-900'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-50',
                )}
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>
                  {isCustom && customFrom && customTo
                    ? `${fmtDateBRShort(customFrom)} – ${fmtDateBRShort(customTo)}`
                    : 'Personalizar'}
                </span>
                <span className={cn('material-symbols-outlined text-[14px]', popoverOpen && 'rotate-180')}>expand_more</span>
              </button>
              {popoverOpen && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={onCustomApply}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <section className="mb-lg">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Vendas</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {vendasKpis.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>
        </section>

        <section className="mb-lg">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Despesas</h3>
            <span className="text-xs text-zinc-400">
              Total: <span className="font-semibold text-rose-300">{fmtBrl(totalDespesas)}</span>
              {prevTotalDespesas > 0 && (
                <span className="ml-2 text-zinc-500">
                  ({deltaPct(totalDespesas, prevTotalDespesas).delta})
                </span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {despesasMeta.map((m) => {
              const p = metrics.despesas[m.key]
              return (
                <KpiCard
                  key={m.key}
                  label={m.label}
                  value={p ? fmtBrl(p.cur) : '—'}
                  pair={p}
                  unavailable={!p}
                  invert
                  icon={m.icon}
                  iconClass="text-rose-400"
                  valueClass="text-rose-300"
                  sub={m.sub}
                />
              )
            })}
          </div>
        </section>

        {metrics.extras?.type === 'shopee' && <ShopeeExtrasCard extras={metrics.extras} />}
        {metrics.extras?.type === 'shein' && <SheinExtrasCard extras={metrics.extras} />}

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Diário</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {metrics.daily.length === 0 ? 'Sem dados no período.' : `${metrics.daily.length} dias`}
            </p>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Data</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Pedidos</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Cancel.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Faturamento</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-400">Líquido</th>
                </tr>
              </thead>
              <tbody className="text-sm text-zinc-200">
                {metrics.daily.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      Sem dados no período. Aguarde próxima execução do cron.
                    </td>
                  </tr>
                ) : (
                  [...metrics.daily].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                    <tr key={r.date} className="border-b border-zinc-800/60 hover:bg-white/5">
                      <td className="px-6 py-3 font-mono text-xs text-zinc-300">{fmtShortDate(r.date)}</td>
                      <td className="px-6 py-3 text-right">{fmtNum(r.pedidos)}</td>
                      <td className="px-6 py-3 text-right text-rose-300">{fmtNum(r.cancelamentos)}</td>
                      <td className="px-6 py-3 text-right font-medium">{fmtBrl(r.faturamento)}</td>
                      <td className="px-6 py-3 text-right text-emerald-300">{fmtBrl2(r.liquido)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  )
}
