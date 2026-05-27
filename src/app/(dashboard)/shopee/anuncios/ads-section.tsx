'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { cn } from '@/lib/utils'
import type {
  ShopeeAdsBalance,
  ShopeeAdsCampaign,
  ShopeeAdsCampaignDailyPerformance,
  ShopeeDailyMetric,
  ShopeeItem,
} from '@/types'
import type { Period } from '@/components/metrics-chart'

const periods: { key: Period; label: string }[] = [
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

// Helper: lucro líquido (escrow). Fallback gross_profit.
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

function buildDailySeries(perf: ShopeeAdsCampaignDailyPerformance[], daily: ShopeeDailyMetric[]) {
  const adsByDate = new Map<string, { spend: number; gmv: number }>()
  for (const p of perf) {
    const k = p.date
    if (!adsByDate.has(k)) adsByDate.set(k, { spend: 0, gmv: 0 })
    const e = adsByDate.get(k)!
    e.spend += (Number(p.expense_cents) || 0) / 100
    e.gmv += (Number(p.broad_gmv_cents) || 0) / 100
  }
  const allDates = new Set<string>([
    ...Array.from(adsByDate.keys()),
    ...daily.map((d) => d.date),
  ])
  const sorted = Array.from(allDates).sort()
  return sorted.map((date) => {
    const a = adsByDate.get(date) || { spend: 0, gmv: 0 }
    const d = daily.find((x) => x.date === date)
    return {
      date,
      spend: a.spend,
      adsGmv: a.gmv,
      grossRevenue: d ? Number(d.gross_revenue) || 0 : 0,
      netReal: d ? lucroReal(d) : 0,
    }
  })
}

export function AdsSection({
  balance,
  campaigns,
  performance,
  daily,
  items,
  period,
}: {
  balance: ShopeeAdsBalance | null
  campaigns: ShopeeAdsCampaign[]
  performance: ShopeeAdsCampaignDailyPerformance[]
  daily: ShopeeDailyMetric[]
  items: ShopeeItem[]
  period: Period
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: Period) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false })
    })
  }

  const aggregatedCampaigns = useMemo(
    () => aggregateCampaigns(campaigns, performance, items),
    [campaigns, performance, items],
  )

  const series = useMemo(() => buildDailySeries(performance, daily), [performance, daily])

  const totalSpend = series.reduce((a, x) => a + x.spend, 0)
  const totalAdsGmv = series.reduce((a, x) => a + x.adsGmv, 0)
  const totalGross = series.reduce((a, x) => a + x.grossRevenue, 0)
  const totalNet = series.reduce((a, x) => a + x.netReal, 0)
  const totalImpressions = aggregatedCampaigns.reduce((a, c) => a + c.impressions, 0)
  const totalClicks = aggregatedCampaigns.reduce((a, c) => a + c.clicks, 0)
  const roasGlobal = totalSpend > 0 ? totalAdsGmv / totalSpend : 0
  const acosGlobal = totalAdsGmv > 0 ? (totalSpend / totalAdsGmv) * 100 : 0
  const pctVendasAds = totalGross > 0 ? (totalAdsGmv / totalGross) * 100 : 0
  const ctrGlobal = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const saldoAds = balance ? balance.total_balance_cents / 100 : 0

  const maxBarValue = Math.max(...series.map((s) => Math.max(s.grossRevenue, s.adsGmv, s.spend, s.netReal)), 1)

  return (
    <div
      className={cn(
        'flex flex-col gap-gutter',
        pending && 'opacity-70 pointer-events-none transition-opacity',
      )}
    >
      <div className="flex justify-end">
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
                  active
                    ? 'bg-zinc-50 text-zinc-900 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-50',
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
          {[
            { label: 'Saldo Conta Ads', value: fmtBrlInt(saldoAds), icon: 'account_balance_wallet', tone: 'text-zinc-50' },
            { label: 'Gasto Período', value: fmtBrlInt(totalSpend), icon: 'payments', tone: 'text-error' },
            { label: 'GMV Via Ads', value: fmtBrlInt(totalAdsGmv), icon: 'shopping_cart', tone: 'text-primary' },
            { label: 'ROAS Global', value: fmtRoas(roasGlobal), icon: 'trending_up', tone: 'text-secondary' },
            { label: 'ACOS Global', value: fmtPct(acosGlobal), icon: 'pie_chart', tone: 'text-tertiary' },
            { label: '% Vendas via Ads', value: fmtPct(pctVendasAds), icon: 'campaign', tone: 'text-primary-fixed' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
              </div>
              <div className={cn('font-h2 text-h2', kpi.tone)}>{kpi.value}</div>
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
            <span className="text-xs text-zinc-500">{fmtPct(pctVendasAds)} do bruto</span>
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

        {/* Gráfico simples diário */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-h3 text-h3 text-zinc-50">Evolução Diária</h3>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-50" /> Bruto</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> GMV Ads</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error" /> Gasto Ads</span>
            </div>
          </div>
          {series.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">Sem dados no período</div>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto">
              {series.map((s) => (
                <div key={s.date} className="flex flex-col items-center gap-1 min-w-[40px]">
                  <div className="flex items-end gap-[2px] h-32">
                    <div
                      className="w-2 bg-zinc-50/70 rounded-t"
                      style={{ height: `${(s.grossRevenue / maxBarValue) * 100}%` }}
                      title={`Bruto: ${fmtBrl(s.grossRevenue)}`}
                    />
                    <div
                      className="w-2 bg-primary/80 rounded-t"
                      style={{ height: `${(s.adsGmv / maxBarValue) * 100}%` }}
                      title={`GMV Ads: ${fmtBrl(s.adsGmv)}`}
                    />
                    <div
                      className="w-2 bg-error/80 rounded-t"
                      style={{ height: `${(s.spend / maxBarValue) * 100}%` }}
                      title={`Gasto: ${fmtBrl(s.spend)}`}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-500">{s.date.slice(8)}/{s.date.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabela campanhas */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-white/10 flex items-center justify-between">
            <h3 className="font-h3 text-h3 text-zinc-50">
              Campanhas ({aggregatedCampaigns.length})
            </h3>
            <span className="text-xs text-zinc-500">
              Ordenado por gasto. Click no ID pra copiar.
            </span>
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
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">CPC</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Gasto</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">GMV Broad</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">ROAS</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">ACOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {aggregatedCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center text-zinc-500 py-8">
                      Sem performance no período
                    </td>
                  </tr>
                ) : (
                  aggregatedCampaigns.slice(0, 50).map((c) => {
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
                      <tr key={c.campaign_id} className="hover:bg-white/[0.02] transition-colors">
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
                                onClick={() => {
                                  navigator.clipboard.writeText(c.campaign_id)
                                }}
                                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono cursor-pointer flex items-center gap-1 text-left"
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
                        <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">R$ {fmtBrl(c.cpc)}</td>
                        <td className="px-md py-3 text-error text-right font-mono-sm">R$ {fmtBrl(c.expense)}</td>
                        <td className="px-md py-3 text-primary text-right font-mono-sm">R$ {fmtBrl(c.broad_gmv)}</td>
                        <td className={cn(
                          'px-md py-3 text-right font-mono-sm font-semibold',
                          c.roas >= 5 ? 'text-secondary' : c.roas >= 2 ? 'text-zinc-50' : 'text-error',
                        )}>
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
        {aggregatedCampaigns.length > 50 && (
          <div className="p-3 border-t border-white/10 text-center text-xs text-zinc-500">
            Mostrando top 50 de {aggregatedCampaigns.length} campanhas
          </div>
        )}
      </div>
    </div>
  )
}
