'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import type {
  ShopeeAdsBalance,
  ShopeeAdsCampaign,
  ShopeeAdsCampaignDailyPerformance,
  ShopeeDailyMetric,
  ShopeeItem,
} from '@/types'
import type { Period } from '@/components/metrics-chart'

export type AdsPeriod = Period | 'custom'

const periods: { key: AdsPeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const fmtRoas = (n: number) => `${n.toFixed(2).replace('.', ',')}x`
const fmtShortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const lucroReal = (r: ShopeeDailyMetric): number => {
  const net = r.net_revenue_cents ? Number(r.net_revenue_cents) / 100 : 0
  return net > 0 ? net : Number(r.gross_profit) || 0
}

type CampaignAgg = {
  campaign_id: string
  campaign_name: string | null
  item_title: string | null
  item_thumb: string | null
  ad_type: string
  status: string
  daily_budget: number | null
  impressions: number
  clicks: number
  expense: number
  broad_gmv: number
  broad_orders: number
  ctr: number
  cpc: number
  roas: number
  acos: number
}

function aggregateCampaigns(
  campaigns: ShopeeAdsCampaign[],
  perf: ShopeeAdsCampaignDailyPerformance[],
  items: ShopeeItem[],
): CampaignAgg[] {
  const campMeta = new Map(campaigns.map((c) => [c.campaign_id, c]))
  const itemByExtId = new Map(items.map((i) => [i.external_id, i]))
  const grouped = new Map<string, CampaignAgg>()

  for (const p of perf) {
    const key = p.campaign_id
    const meta = campMeta.get(key)
    if (!grouped.has(key)) {
      const itemKey = meta?.item_id != null ? String(meta.item_id) : ''
      const linkedItem = itemKey ? itemByExtId.get(itemKey) : undefined
      const rawItem = linkedItem?.raw_payload as { image?: { image_url_list?: string[] } } | null
      const thumb = rawItem?.image?.image_url_list?.[0] ?? null
      grouped.set(key, {
        campaign_id: key,
        campaign_name: meta?.campaign_name || null,
        item_title: linkedItem?.title || null,
        item_thumb: thumb,
        ad_type: meta?.ad_type || '—',
        status: meta?.campaign_status || '—',
        daily_budget: meta?.daily_budget_cents != null ? meta.daily_budget_cents / 100 : null,
        impressions: 0,
        clicks: 0,
        expense: 0,
        broad_gmv: 0,
        broad_orders: 0,
        ctr: 0,
        cpc: 0,
        roas: 0,
        acos: 0,
      })
    }
    const agg = grouped.get(key)!
    agg.impressions += Number(p.impressions) || 0
    agg.clicks += Number(p.clicks) || 0
    agg.expense += (Number(p.expense_cents) || 0) / 100
    agg.broad_gmv += (Number(p.broad_gmv_cents) || 0) / 100
    agg.broad_orders += Number(p.broad_order_count) || 0
  }

  const list = Array.from(grouped.values())
  for (const a of list) {
    a.ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0
    a.cpc = a.clicks > 0 ? a.expense / a.clicks : 0
    a.roas = a.expense > 0 ? a.broad_gmv / a.expense : 0
    a.acos = a.broad_gmv > 0 ? (a.expense / a.broad_gmv) * 100 : 0
  }
  list.sort((a, b) => b.expense - a.expense)
  return list
}

type DailyPoint = {
  date: string
  spend: number
  adsGmv: number
  grossRevenue: number
  netReal: number
  orders: number
  impressions: number
  clicks: number
}

function buildDailySeries(perf: ShopeeAdsCampaignDailyPerformance[], daily: ShopeeDailyMetric[]): DailyPoint[] {
  const adsByDate = new Map<string, { spend: number; gmv: number; orders: number; imp: number; clicks: number }>()
  for (const p of perf) {
    const k = p.date
    if (!adsByDate.has(k)) adsByDate.set(k, { spend: 0, gmv: 0, orders: 0, imp: 0, clicks: 0 })
    const e = adsByDate.get(k)!
    e.spend += (Number(p.expense_cents) || 0) / 100
    e.gmv += (Number(p.broad_gmv_cents) || 0) / 100
    e.orders += Number(p.broad_order_count) || 0
    e.imp += Number(p.impressions) || 0
    e.clicks += Number(p.clicks) || 0
  }
  const allDates = new Set<string>([...Array.from(adsByDate.keys()), ...daily.map((d) => d.date)])
  const sorted = Array.from(allDates).sort()
  return sorted.map((date) => {
    const a = adsByDate.get(date) || { spend: 0, gmv: 0, orders: 0, imp: 0, clicks: 0 }
    const d = daily.find((x) => x.date === date)
    return {
      date,
      spend: a.spend,
      adsGmv: a.gmv,
      grossRevenue: d ? Number(d.gross_revenue) || 0 : 0,
      netReal: d ? lucroReal(d) : 0,
      orders: a.orders,
      impressions: a.imp,
      clicks: a.clicks,
    }
  })
}

function yesterdayIsoBR(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function AdsSection({
  balance,
  campaigns,
  performance,
  daily,
  items,
  period,
  customFrom,
  customTo,
}: {
  balance: ShopeeAdsBalance | null
  campaigns: ShopeeAdsCampaign[]
  performance: ShopeeAdsCampaignDailyPerformance[]
  daily: ShopeeDailyMetric[]
  items: ShopeeItem[]
  period: AdsPeriod
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
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

  function setPeriod(p: AdsPeriod) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    if (p !== 'custom') {
      sp.delete('from')
      sp.delete('to')
    }
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', 'custom')
    sp.set('from', from)
    sp.set('to', to)
    setShowDatePicker(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  // Particiona: all_cpc = total agregado autoritário (bate painel oficial), manual = per-campanha pra drilldown
  const allCpcRows = useMemo(
    () => performance.filter(p => p.ad_type === 'all_cpc'),
    [performance],
  )
  const manualRows = useMemo(
    () => performance.filter(p => p.ad_type === 'manual' || !p.ad_type),
    [performance],
  )
  const hasAllCpc = allCpcRows.length > 0

  const aggregatedCampaigns = useMemo(
    () => aggregateCampaigns(campaigns, manualRows, items),
    [campaigns, manualRows, items],
  )

  // Série diária: usa all_cpc quando disponível (autoritário), senão manual
  const series = useMemo(
    () => buildDailySeries(hasAllCpc ? allCpcRows : manualRows, daily),
    [hasAllCpc, allCpcRows, manualRows, daily],
  )

  const yesterdayIso = yesterdayIsoBR()
  const yesterday = series.find((s) => s.date === yesterdayIso)
  const dayBefore = (() => {
    const d = new Date(yesterdayIso)
    d.setDate(d.getDate() - 1)
    return series.find((s) => s.date === d.toISOString().slice(0, 10))
  })()

  const totalSpend = series.reduce((a, x) => a + x.spend, 0)
  const totalAdsGmv = series.reduce((a, x) => a + x.adsGmv, 0)
  const totalGross = series.reduce((a, x) => a + x.grossRevenue, 0)
  const totalNet = series.reduce((a, x) => a + x.netReal, 0)
  // Totais autoritativos vêm de all_cpc (bate painel oficial). Drilldown campanhas só usa manual.
  const totalImpressions = series.reduce((a, x) => a + x.impressions, 0)
  const totalClicks = series.reduce((a, x) => a + x.clicks, 0)
  const totalOrders = series.reduce((a, x) => a + x.orders, 0)
  const roasGlobal = totalSpend > 0 ? totalAdsGmv / totalSpend : 0
  const acosGlobal = totalAdsGmv > 0 ? (totalSpend / totalAdsGmv) * 100 : 0
  const pctVendasAds = totalGross > 0 ? (totalAdsGmv / totalGross) * 100 : 0
  const ctrGlobal = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  // Funil + conversão (card #57): visitantes/cliques/CTR/conversão/CPDC
  const visitantes = totalClicks // Shopee considera "visitantes" os cliques únicos pra produto
  const conversaoBroad = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0
  const cpdcCents = allCpcRows.reduce((a, r) => a + (Number(r.cost_per_conversion_cents) || 0) * (Number(r.broad_order_count) || 0), 0)
  const totalConversoes = allCpcRows.reduce((a, r) => a + (Number(r.broad_order_count) || 0), 0)
  const cpdcMedio = totalConversoes > 0 ? cpdcCents / totalConversoes / 100 : 0
  const conversaoDirect = (() => {
    const dirOrders = allCpcRows.reduce((a, r) => a + (Number(r.direct_order_count) || 0), 0)
    return totalClicks > 0 ? (dirOrders / totalClicks) * 100 : 0
  })()

  const saldoAds = balance ? balance.total_balance_cents / 100 : 0

  const selectedAgg = selectedCampaign ? aggregatedCampaigns.find((c) => c.campaign_id === selectedCampaign) : null
  const selectedDaily = useMemo(() => {
    if (!selectedCampaign) return [] as Array<{
      date: string
      spend: number
      gmv: number
      orders: number
      impressions: number
      clicks: number
      ctr: number
      cpc: number
      roas: number
      acos: number
    }>
    const rows = performance.filter((p) => p.campaign_id === selectedCampaign)
    return rows
      .map((p) => {
        const spend = (Number(p.expense_cents) || 0) / 100
        const gmv = (Number(p.broad_gmv_cents) || 0) / 100
        const imp = Number(p.impressions) || 0
        const clk = Number(p.clicks) || 0
        return {
          date: p.date,
          spend,
          gmv,
          orders: Number(p.broad_order_count) || 0,
          impressions: imp,
          clicks: clk,
          ctr: imp > 0 ? (clk / imp) * 100 : 0,
          cpc: clk > 0 ? spend / clk : 0,
          roas: spend > 0 ? gmv / spend : 0,
          acos: gmv > 0 ? (spend / gmv) * 100 : 0,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [selectedCampaign, performance])

  function deltaPct(curr: number, prev: number): { label: string; tone: 'up' | 'down' | 'flat' } {
    if (prev === 0) return { label: '—', tone: 'flat' }
    const pct = ((curr - prev) / prev) * 100
    if (Math.abs(pct) < 0.05) return { label: '0,0%', tone: 'flat' }
    return {
      label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`,
      tone: pct >= 0 ? 'up' : 'down',
    }
  }

  return (
    <div
      className={cn('flex flex-col gap-gutter', pending && 'opacity-70 pointer-events-none transition-opacity')}
      style={showDatePicker ? { paddingBottom: '560px' } : undefined}
    >
      {/* Filtros período */}
      <div className="flex justify-end gap-3 items-center flex-wrap">
        <div className="flex items-center rounded-lg p-1 border border-zinc-800 bg-zinc-900/60">
          {periods.map((p) => {
            const active = period === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors',
                  active ? 'bg-zinc-50 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-50',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div ref={datePickerRef} className="relative z-30">
          <button
            type="button"
            onClick={() => setShowDatePicker(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              period === 'custom'
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-50',
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

      {/* Hero "Ontem" — atende sonho João */}
      {yesterday && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.05) 50%, rgba(248,113,113,0.04))',
            border: '1px solid #27272a',
            borderRadius: '14px',
            padding: '20px 24px',
          }}
        >
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">today</span>
                Resumo de Ontem
              </div>
              <div className="text-h3 font-h3 text-zinc-50 mt-1">
                {new Date(yesterday.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                })}
              </div>
            </div>
            {dayBefore && (
              <div className="text-[10px] text-zinc-500">
                vs anteontem ({fmtShortDate(dayBefore.date)})
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { label: 'Investido', value: fmtBrlInt(yesterday.spend), curr: yesterday.spend, prev: dayBefore?.spend ?? 0, tone: 'text-error', invert: true },
              { label: 'Vendido (GMV Ads)', value: fmtBrlInt(yesterday.adsGmv), curr: yesterday.adsGmv, prev: dayBefore?.adsGmv ?? 0, tone: 'text-primary' },
              { label: 'Pedidos Ads', value: fmtNum(yesterday.orders), curr: yesterday.orders, prev: dayBefore?.orders ?? 0, tone: 'text-zinc-50' },
              {
                label: 'ROAS',
                value: yesterday.spend > 0 ? fmtRoas(yesterday.adsGmv / yesterday.spend) : '—',
                curr: yesterday.spend > 0 ? yesterday.adsGmv / yesterday.spend : 0,
                prev: (dayBefore && dayBefore.spend > 0) ? dayBefore.adsGmv / dayBefore.spend : 0,
                tone: 'text-secondary',
              },
              {
                label: '% sobre Bruto',
                value: yesterday.grossRevenue > 0 ? fmtPct((yesterday.adsGmv / yesterday.grossRevenue) * 100) : '—',
                curr: yesterday.grossRevenue > 0 ? (yesterday.adsGmv / yesterday.grossRevenue) * 100 : 0,
                prev: (dayBefore && dayBefore.grossRevenue > 0) ? (dayBefore.adsGmv / dayBefore.grossRevenue) * 100 : 0,
                tone: 'text-tertiary',
              },
            ].map((kpi) => {
              const d = deltaPct(kpi.curr, kpi.prev)
              const upGood = !kpi.invert
              const deltaColor =
                d.tone === 'flat' ? 'text-zinc-500'
                : (d.tone === 'up' && upGood) || (d.tone === 'down' && !upGood) ? 'text-emerald-400'
                : 'text-red-400'
              return (
                <div
                  key={kpi.label}
                  style={{
                    background: 'rgba(24,24,27,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">{kpi.label}</div>
                  <div className={cn('font-h2 text-h2 mt-1', kpi.tone)}>{kpi.value}</div>
                  {dayBefore && (
                    <div className={cn('text-[10px] font-mono mt-0.5', deltaColor)}>
                      {d.tone === 'up' ? '↑' : d.tone === 'down' ? '↓' : '·'} {d.label}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* KPIs período — financeiros + funil/conversão (12 cards em 2 linhas) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
        {[
          { label: 'Saldo Conta Ads', value: fmtBrlInt(saldoAds), icon: 'account_balance_wallet', tone: 'text-zinc-50', sub: undefined as string | undefined },
          { label: 'Gasto Período', value: fmtBrlInt(totalSpend), icon: 'payments', tone: 'text-error', sub: `média ${fmtBrlInt(totalSpend / Math.max(series.length, 1))}/dia` },
          { label: 'GMV Via Ads', value: fmtBrlInt(totalAdsGmv), icon: 'shopping_cart', tone: 'text-primary', sub: `${fmtNum(totalOrders)} pedidos` },
          { label: 'ROAS Global', value: fmtRoas(roasGlobal), icon: 'trending_up', tone: 'text-secondary', sub: 'GMV ÷ investido' },
          { label: 'ACOS Global', value: fmtPct(acosGlobal), icon: 'pie_chart', tone: 'text-tertiary', sub: 'custo ÷ vendas' },
          { label: '% Vendas via Ads', value: fmtPct(pctVendasAds), icon: 'campaign', tone: 'text-primary-fixed', sub: 'do bruto total' },
          { label: 'Impressões', value: fmtNum(totalImpressions), icon: 'visibility', tone: 'text-zinc-50', sub: `${(totalImpressions / Math.max(series.length, 1) / 1000).toFixed(1)}k/dia` },
          { label: 'Visitantes (Cliques)', value: fmtNum(totalClicks), icon: 'group', tone: 'text-blue-400', sub: `${fmtNum(totalClicks / Math.max(series.length, 1))}/dia` },
          { label: 'CTR', value: fmtPct(ctrGlobal), icon: 'ads_click', tone: 'text-tertiary', sub: 'cliques ÷ impressões' },
          { label: 'Conversão Ampla', value: fmtPct(conversaoBroad), icon: 'percent', tone: conversaoBroad >= 3 ? 'text-secondary' : 'text-zinc-50', sub: `${fmtNum(totalOrders)} pedidos broad` },
          { label: 'Conversão Direta', value: fmtPct(conversaoDirect), icon: 'check_circle', tone: 'text-zinc-50', sub: 'click → pedido direto' },
          { label: 'Custo / Conversão', value: cpdcMedio > 0 ? `R$ ${fmtBrl(cpdcMedio)}` : '—', icon: 'sell', tone: 'text-error', sub: 'CPDC médio' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 hover:bg-zinc-900/70 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
              <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
            </div>
            <div className={cn('font-h2 text-h2', kpi.tone)}>{kpi.value}</div>
            {kpi.sub && <div className="text-[10px] text-zinc-500 font-mono leading-tight">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* Comparativo Bruto vs Líquido vs Ads */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-1">
          <span className="text-label-md text-zinc-400 uppercase tracking-wider">Faturamento Bruto</span>
          <span className="font-h2 text-h2 text-zinc-50">{fmtBrlInt(totalGross)}</span>
          <span className="text-xs text-zinc-500">Total vendido (com e sem Ads)</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-1">
          <span className="text-label-md text-zinc-400 uppercase tracking-wider">GMV via Ads</span>
          <span className="font-h2 text-h2 text-primary">{fmtBrlInt(totalAdsGmv)}</span>
          <span className="text-xs text-zinc-500">{fmtPct(pctVendasAds)} do bruto · {fmtNum(totalOrders)} pedidos</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-1">
          <span className="text-label-md text-zinc-400 uppercase tracking-wider">Gasto em Ads</span>
          <span className="font-h2 text-h2 text-error">{fmtBrlInt(totalSpend)}</span>
          <span className="text-xs text-zinc-500">CTR {fmtPct(ctrGlobal)} · {fmtNum(totalClicks)} clicks</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-1">
          <span className="text-label-md text-zinc-400 uppercase tracking-wider">Lucro Líquido (escrow)</span>
          <span className="font-h2 text-h2 text-secondary">{fmtBrlInt(totalNet)}</span>
          <span className="text-xs text-zinc-500">{totalGross > 0 ? fmtPct((totalNet / totalGross) * 100) : '—'} margem real</span>
        </div>
      </div>

      {/* Gráfico evolução */}
      <DailyAdsChart series={series} />

      {/* Tabela campanhas (só manual ads — Auto + GMV Max + Keyword vêm agregados em "all_cpc") */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
        <div className="p-lg border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-h3 text-h3 text-zinc-50">Campanhas Manuais ({aggregatedCampaigns.length})</h3>
            {hasAllCpc && (
              <p className="text-[10px] text-zinc-500 mt-1">
                KPIs/gráfico acima usam <span className="text-zinc-300 font-mono">all_cpc</span> agregado (bate painel oficial Shopee).
                Tabela aqui mostra só Product Ads manuais — drilldown por item.
              </p>
            )}
          </div>
          <span className="text-xs text-zinc-500">Click na linha pra abrir drilldown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
            <thead className="bg-zinc-900/60">
              <tr>
                <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Campanha</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Tipo</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Budget Diário</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Impressões</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Clicks</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">CTR</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Gasto</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">GMV Broad</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">ROAS</th>
                <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">ACOS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aggregatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-zinc-500 py-8">Sem performance no período</td>
                </tr>
              ) : (
                aggregatedCampaigns.slice(0, 100).map((c) => {
                  const statusLower = (c.status || '').toLowerCase()
                  const statusBadge =
                    statusLower === 'ongoing' || statusLower === 'active'
                      ? 'bg-secondary/15 text-secondary border border-secondary/30'
                      : statusLower === 'paused'
                      ? 'bg-tertiary/15 text-tertiary border border-tertiary/30'
                      : statusLower === 'scheduled'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-zinc-700/30 text-zinc-400 border border-zinc-700/40'
                  return (
                    <tr
                      key={c.campaign_id}
                      onClick={() => setSelectedCampaign(c.campaign_id)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="px-lg py-3 max-w-[320px]">
                        <div className="flex items-center gap-2">
                          {c.item_thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.item_thumb} alt="" className="w-9 h-9 rounded object-cover border border-zinc-800 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-zinc-600 text-[18px]">campaign</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-zinc-50 truncate text-xs" title={c.item_title || c.campaign_name || `Campanha ${c.campaign_id}`}>
                              {c.item_title || c.campaign_name || `Campanha ${c.campaign_id}`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(c.campaign_id)
                              }}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono cursor-pointer flex items-center gap-1 text-left w-fit"
                              title="Copiar ID da campanha"
                            >
                              <span>ID {c.campaign_id}</span>
                              <span className="material-symbols-outlined text-[10px]">content_copy</span>
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-md py-3">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase', statusBadge)}>
                          {c.status === '—' ? 'sem dados' : c.status}
                        </span>
                      </td>
                      <td className="px-md py-3 text-zinc-400 text-xs">{c.ad_type}</td>
                      <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">
                        {c.daily_budget != null ? `R$ ${fmtBrl(c.daily_budget)}` : '—'}
                      </td>
                      <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtNum(c.impressions)}</td>
                      <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtNum(c.clicks)}</td>
                      <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtPct(c.ctr)}</td>
                      <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtNum(c.broad_orders)}</td>
                      <td className="px-md py-3 text-error text-right font-mono-sm">R$ {fmtBrl(c.expense)}</td>
                      <td className="px-md py-3 text-primary text-right font-mono-sm">R$ {fmtBrl(c.broad_gmv)}</td>
                      <td className={cn('px-md py-3 text-right font-mono-sm font-semibold', c.roas >= 5 ? 'text-secondary' : c.roas >= 2 ? 'text-zinc-50' : 'text-error')}>
                        {fmtRoas(c.roas)}
                      </td>
                      <td className="px-lg py-3 text-zinc-400 text-right font-mono-sm">{fmtPct(c.acos)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {aggregatedCampaigns.length > 100 && (
          <div className="p-3 border-t border-white/10 text-center text-xs text-zinc-500">
            Mostrando top 100 de {aggregatedCampaigns.length} campanhas
          </div>
        )}
      </div>

      {/* Drilldown modal */}
      {selectedAgg && (
        <CampaignDrilldown
          campaign={selectedAgg}
          dailyRows={selectedDaily}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  )
}

function DailyAdsChart({ series }: { series: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
        <h3 className="font-h3 text-h3 text-zinc-50 mb-md">Evolução Diária</h3>
        <div className="text-center text-zinc-500 py-8">Sem dados no período</div>
      </div>
    )
  }

  const maxBar = Math.max(...series.map((s) => Math.max(s.adsGmv, s.spend)), 1)
  const totalSpend = series.reduce((a, s) => a + s.spend, 0)
  const totalGmv = series.reduce((a, s) => a + s.adsGmv, 0)
  const avgSpend = totalSpend / series.length
  const avgGmv = totalGmv / series.length
  const tickStep = Math.max(1, Math.ceil(series.length / 12))

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(24,24,27,0.6), rgba(24,24,27,0.4), rgba(9,9,11,0.4))',
        border: '1px solid #27272a',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
      onMouseLeave={() => setHover(null)}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="font-h3 text-h3 text-zinc-50 flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-sm bg-gradient-to-b from-blue-400 to-emerald-500" />
            Investimento vs Retorno
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-[0.15em] font-medium">{series.length} dias</p>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <Stat label="Investido" value={fmtBrlInt(totalSpend)} sub={`média ${fmtBrl(avgSpend)}/dia`} tone="error" />
          <div style={{ height: '36px', width: '1px', background: '#27272a' }} />
          <Stat label="Vendido" value={fmtBrlInt(totalGmv)} sub={`média ${fmtBrl(avgGmv)}/dia`} tone="primary" />
          <div style={{ height: '36px', width: '1px', background: '#27272a' }} />
          <Stat label="ROAS médio" value={totalSpend > 0 ? fmtRoas(totalGmv / totalSpend) : '—'} sub="GMV ÷ Investido" tone="secondary" />
        </div>
      </div>

      <div style={{ position: 'relative', padding: '20px 20px 12px' }}>
        <div style={{ display: 'flex', height: '240px' }}>
          <div style={{ position: 'relative', width: '50px', flexShrink: 0 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p) => {
              const v = p * maxBar
              return (
                <div
                  key={p}
                  className="text-[9px] text-zinc-500 font-mono leading-none"
                  style={{ position: 'absolute', right: '8px', bottom: `${p * 100}%`, transform: 'translateY(50%)' }}
                >
                  R${Math.round(v).toLocaleString('pt-BR')}
                </div>
              )
            })}
          </div>

          <div className="border-l border-b border-zinc-700" style={{ position: 'relative', flex: '1 1 0%', minWidth: 0 }}>
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <div
                key={p}
                className="border-t border-dashed border-zinc-800"
                style={{ position: 'absolute', left: 0, right: 0, bottom: `${p * 100}%` }}
              />
            ))}

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '2px', padding: '0 4px' }}>
              {series.map((s, i) => {
                const spendH = (s.spend / maxBar) * 100
                const gmvH = (s.adsGmv / maxBar) * 100
                const isHover = hover === i
                return (
                  <div
                    key={s.date}
                    onMouseEnter={() => setHover(i)}
                    style={{
                      flex: '1 1 0%',
                      minWidth: '6px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '1px',
                      alignItems: 'flex-end',
                      cursor: 'crosshair',
                      position: 'relative',
                      paddingLeft: '2px',
                      paddingRight: '2px',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: `${Math.max(spendH, 0.5)}%`,
                        background: isHover
                          ? 'linear-gradient(to bottom, #fca5a5, #ef4444, #7f1d1d)'
                          : 'linear-gradient(to bottom, #f87171, #ef4444 50%, rgba(127,29,29,0.5))',
                        borderTopLeftRadius: '2px',
                        borderTopRightRadius: '2px',
                        boxShadow: isHover ? '0 0 12px rgba(248,113,113,0.6)' : 'none',
                        transition: 'all 150ms',
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        height: `${Math.max(gmvH, 0.5)}%`,
                        background: isHover
                          ? 'linear-gradient(to bottom, #a7f3d0, #10b981, #064e3b)'
                          : 'linear-gradient(to bottom, #6ee7b7, #10b981 50%, rgba(6,78,59,0.5))',
                        borderTopLeftRadius: '2px',
                        borderTopRightRadius: '2px',
                        boxShadow: isHover ? '0 0 12px rgba(16,185,129,0.6)' : 'none',
                        transition: 'all 150ms',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', paddingLeft: '50px', marginTop: '4px' }}>
          <div className="text-[9px] text-zinc-500 font-mono" style={{ display: 'flex', flex: 1, justifyContent: 'space-between', padding: '0 4px' }}>
            {series.map((s, i) =>
              i % tickStep !== 0 && i !== series.length - 1
                ? <span key={s.date} style={{ flex: 1 }} />
                : <span key={s.date} style={{ flex: 1, textAlign: 'center' }}>{fmtShortDate(s.date)}</span>
            )}
          </div>
        </div>

        {hover != null && series[hover] && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-zinc-700 bg-zinc-950/95 backdrop-blur-md px-3 py-2.5 shadow-2xl shadow-black/60 min-w-[200px] -translate-x-1/2"
            style={{ left: `calc(50px + ${((hover + 0.5) / series.length) * 92}%)`, top: 28 }}
          >
            <div className="text-[9px] text-zinc-500 uppercase tracking-[0.12em] font-semibold mb-1.5 flex items-center gap-1.5">
              <span className="block w-1 h-1 rounded-full bg-zinc-400" />
              {new Date(series[hover].date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[9px] text-zinc-500 uppercase">Investido</div>
                <div className="text-error font-mono font-bold">R$ {fmtBrl(series[hover].spend)}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 uppercase">GMV Ads</div>
                <div className="text-emerald-400 font-mono font-bold">R$ {fmtBrl(series[hover].adsGmv)}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 uppercase">ROAS</div>
                <div className="text-secondary font-mono font-bold">
                  {series[hover].spend > 0 ? fmtRoas(series[hover].adsGmv / series[hover].spend) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 uppercase">Pedidos</div>
                <div className="text-zinc-50 font-mono font-bold">{fmtNum(series[hover].orders)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-md mt-md border-t border-white/5 text-[10px] text-zinc-500 gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="block w-3 h-2 rounded-sm bg-gradient-to-b from-red-300 via-red-500 to-red-900 opacity-90" />
              <span className="uppercase tracking-wider font-medium">Investido</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="block w-3 h-2 rounded-sm bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-900 opacity-90" />
              <span className="uppercase tracking-wider font-medium">GMV Ads</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'error' | 'primary' | 'secondary' }) {
  const valueTone =
    tone === 'error' ? 'text-error'
    : tone === 'primary' ? 'text-primary'
    : tone === 'secondary' ? 'text-secondary'
    : 'text-zinc-50'
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <span className="text-[9px] text-zinc-500 uppercase tracking-[0.12em] font-semibold">{label}</span>
      <span className={cn('text-sm font-bold font-mono leading-tight', valueTone)}>{value}</span>
      <span className="text-[9px] text-zinc-600 leading-tight">{sub}</span>
    </div>
  )
}

function CampaignDrilldown({
  campaign,
  dailyRows,
  onClose,
}: {
  campaign: CampaignAgg
  dailyRows: Array<{ date: string; spend: number; gmv: number; orders: number; impressions: number; clicks: number; ctr: number; cpc: number; roas: number; acos: number }>
  onClose: () => void
}) {
  const maxBar = Math.max(...dailyRows.map((r) => Math.max(r.spend, r.gmv)), 1)
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-4xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 p-lg flex items-start justify-between gap-3 z-10">
          <div className="flex items-start gap-3 min-w-0">
            {campaign.item_thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={campaign.item_thumb} alt="" className="w-12 h-12 rounded object-cover border border-zinc-800 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-zinc-600">campaign</span>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-h2 text-h2 text-zinc-50 truncate">
                {campaign.item_title || campaign.campaign_name || `Campanha ${campaign.campaign_id}`}
              </h2>
              <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-2 font-mono">
                <span>ID {campaign.campaign_id}</span>
                <span>·</span>
                <span>{campaign.ad_type}</span>
                <span>·</span>
                <span className="uppercase">{campaign.status}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-900 shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-lg flex flex-col gap-lg">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Gasto', value: fmtBrlInt(campaign.expense), tone: 'text-error' },
              { label: 'GMV', value: fmtBrlInt(campaign.broad_gmv), tone: 'text-primary' },
              { label: 'ROAS', value: fmtRoas(campaign.roas), tone: 'text-secondary' },
              { label: 'ACOS', value: fmtPct(campaign.acos), tone: 'text-tertiary' },
              { label: 'Impressões', value: fmtNum(campaign.impressions), tone: 'text-zinc-50' },
              { label: 'Clicks', value: fmtNum(campaign.clicks), tone: 'text-zinc-50' },
              { label: 'CTR', value: fmtPct(campaign.ctr), tone: 'text-zinc-50' },
              { label: 'Pedidos', value: fmtNum(campaign.broad_orders), tone: 'text-zinc-50' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{kpi.label}</div>
                <div className={cn('font-h3 text-h3 mt-1', kpi.tone)}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Daily breakdown chart */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
            <h3 className="font-h3 text-h3 text-zinc-50 mb-md">Performance Diária</h3>
            {dailyRows.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">Sem dados diários</div>
            ) : (
              <div style={{ display: 'flex', height: '180px' }}>
                <div style={{ position: 'relative', width: '50px', flexShrink: 0 }}>
                  {[0, 0.5, 1].map((p) => {
                    const v = p * maxBar
                    return (
                      <div
                        key={p}
                        className="text-[9px] text-zinc-500 font-mono leading-none"
                        style={{ position: 'absolute', right: '8px', bottom: `${p * 100}%`, transform: 'translateY(50%)' }}
                      >
                        R${Math.round(v).toLocaleString('pt-BR')}
                      </div>
                    )
                  })}
                </div>
                <div className="border-l border-b border-zinc-700" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '1px', padding: '0 4px' }}>
                    {dailyRows.map((r) => (
                      <div
                        key={r.date}
                        style={{
                          flex: '1 1 0%',
                          minWidth: '4px',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'row',
                          gap: '1px',
                          alignItems: 'flex-end',
                          paddingLeft: '1px',
                          paddingRight: '1px',
                        }}
                        title={`${fmtShortDate(r.date)} · Gasto R$${fmtBrl(r.spend)} · GMV R$${fmtBrl(r.gmv)} · ROAS ${fmtRoas(r.roas)}`}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: `${(r.spend / maxBar) * 100}%`,
                            background: 'linear-gradient(to bottom, #f87171, #7f1d1d)',
                            borderTopLeftRadius: '2px',
                            borderTopRightRadius: '2px',
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            height: `${(r.gmv / maxBar) * 100}%`,
                            background: 'linear-gradient(to bottom, #10b981, #064e3b)',
                            borderTopLeftRadius: '2px',
                            borderTopRightRadius: '2px',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="block w-3 h-2 rounded-sm bg-gradient-to-b from-red-300 to-red-900" />
                <span className="uppercase tracking-wider">Gasto</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="block w-3 h-2 rounded-sm bg-gradient-to-b from-emerald-300 to-emerald-900" />
                <span className="uppercase tracking-wider">GMV</span>
              </span>
            </div>
          </div>

          {/* Daily table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="p-md border-b border-white/10">
              <h3 className="font-h3 text-h3 text-zinc-50">Detalhe Diário ({dailyRows.length} dias)</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left font-label-md text-label-md whitespace-nowrap border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {['Data', 'Impressões', 'Clicks', 'CTR', 'CPC', 'Gasto', 'GMV', 'Pedidos', 'ROAS', 'ACOS'].map((h, i) => (
                      <th
                        key={h}
                        className="bg-zinc-950 text-zinc-400 font-medium uppercase tracking-wider text-[10px] border-b border-white/10 px-md py-2"
                        style={{ textAlign: i === 0 ? 'left' : 'right' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[...dailyRows].reverse().map((r) => (
                    <tr key={r.date} className="hover:bg-white/[0.02]">
                      <td className="px-md py-2 text-zinc-300 font-mono text-xs">{fmtShortDate(r.date)}</td>
                      <td className="px-md py-2 text-zinc-400 text-right font-mono-sm">{fmtNum(r.impressions)}</td>
                      <td className="px-md py-2 text-zinc-400 text-right font-mono-sm">{fmtNum(r.clicks)}</td>
                      <td className="px-md py-2 text-zinc-400 text-right font-mono-sm">{fmtPct(r.ctr)}</td>
                      <td className="px-md py-2 text-zinc-400 text-right font-mono-sm">R$ {fmtBrl(r.cpc)}</td>
                      <td className="px-md py-2 text-error text-right font-mono-sm font-semibold">R$ {fmtBrl(r.spend)}</td>
                      <td className="px-md py-2 text-emerald-400 text-right font-mono-sm font-semibold">R$ {fmtBrl(r.gmv)}</td>
                      <td className="px-md py-2 text-zinc-300 text-right font-mono-sm">{fmtNum(r.orders)}</td>
                      <td className={cn('px-md py-2 text-right font-mono-sm font-semibold', r.roas >= 5 ? 'text-secondary' : r.roas >= 2 ? 'text-zinc-50' : 'text-error')}>
                        {fmtRoas(r.roas)}
                      </td>
                      <td className="px-md py-2 text-zinc-400 text-right font-mono-sm">{fmtPct(r.acos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
