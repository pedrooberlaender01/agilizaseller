'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { RevenueChart } from '@/components/revenue-chart'
import { cn } from '@/lib/utils'
import { KpiCard, fmtBrl, fmtNum, fmtPct } from '../_ui'

type Period = '7d' | '30d' | '90d'
export type AdsDay = { dia: string; gasto: number; cobrancas: number }
export type AdsCampaign = {
  campaign_id: string
  campaign_name: string | null
  operation_status: string | null
  secondary_status: string | null
  spend: number | string
  orders: number
  gross_revenue: number | string
  roi: number | string | null
  impressions: number | string | null
  clicks: number | string | null
  ctr: number | string | null
  live_views: number | string | null
  live_follows: number | string | null
}

function statusTone(status: string | null): 'green' | 'gray' {
  return status === 'ENABLE' ? 'green' : 'gray'
}

export function AnunciosView({
  period,
  gasto,
  cobrancas,
  faturamento,
  series,
  campaigns,
}: {
  period: Period
  gasto: number
  cobrancas: number
  faturamento: number
  series: AdsDay[]
  campaigns: AdsCampaign[]
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: Period) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', p)
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }))
  }

  const pctFaturamento = faturamento > 0 ? (gasto / faturamento) * 100 : 0
  const dias = series.length || 1
  const mediaDiaria = gasto / dias

  const chartData = series.map((d) => {
    const dt = new Date(d.dia + 'T00:00:00')
    return {
      day: `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`,
      faturamento: d.gasto,
      lucro: 0,
    }
  })

  return (
    <>
      <TopBar title="Anúncios — TikTok Shop" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        {/* Aviso de escopo */}
        <div className="mb-lg flex flex-wrap items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-lg">
          <span className="material-symbols-outlined text-lg text-blue-300">info</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-100">GMV Max — campanhas, ROI e alcance reais</p>
            <p className="mt-1 text-xs text-slate-400">
              Gasto, receita, ROI, impressões e cliques vêm direto das campanhas GMV Max da loja (impressões/cliques
              agregados a partir do nível de criativo/produto). Campanhas LIVE mostram visualizações/seguidores em vez
              de impressões/cliques — são métricas diferentes por tipo de campanha.
            </p>
          </div>
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
        </div>

        {/* KPIs com dado real */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Gasto em Ads" value={fmtBrl(gasto)} icon="campaign" tone="red" sub={`${fmtNum(cobrancas)} cobranças`} />
          <KpiCard label="Média Diária" value={fmtBrl(mediaDiaria)} icon="calendar_month" sub={`${fmtNum(dias)} dias com gasto`} />
          <KpiCard label="% do Faturamento" value={fmtPct(pctFaturamento)} icon="percent" tone={pctFaturamento <= 10 ? 'green' : 'gold'} sub="gasto ÷ GMV do período" />
          <KpiCard label="Faturamento (GMV)" value={fmtBrl(faturamento)} icon="payments" tone="green" />
        </div>

        {/* Gráfico */}
        <div className="mb-lg">
          <RevenueChart
            data={chartData}
            showLucro={false}
            title="Gasto em Ads por dia"
            subtitle="GMV Max · BRL"
          />
        </div>

        {/* Campanhas GMV Max */}
        <div className="mb-lg rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Campanhas GMV Max</h3>
            <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">{campaigns.length} campanhas no período</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-lg py-3">Campanha</th>
                  <th className="px-lg py-3">Status</th>
                  <th className="px-lg py-3 text-right">Gasto</th>
                  <th className="px-lg py-3 text-right">Impressões</th>
                  <th className="px-lg py-3 text-right">Cliques</th>
                  <th className="px-lg py-3 text-right">CTR</th>
                  <th className="px-lg py-3 text-right">Visualizações LIVE</th>
                  <th className="px-lg py-3 text-right">Seguidores (LIVE)</th>
                  <th className="px-lg py-3 text-right">Pedidos</th>
                  <th className="px-lg py-3 text-right">Receita</th>
                  <th className="px-lg py-3 text-right">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-lg py-6 text-center text-sm text-zinc-500">Nenhuma campanha no período.</td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.campaign_id}>
                      <td className="px-lg py-3 text-zinc-100">{c.campaign_name ?? '—'}</td>
                      <td className="px-lg py-3">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', statusTone(c.operation_status) === 'green' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-outline/20 text-zinc-500')}>
                          {c.operation_status ?? '—'}
                        </span>
                      </td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{fmtBrl(c.spend)}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{c.impressions != null ? fmtNum(Number(c.impressions)) : '—'}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{c.clicks != null ? fmtNum(Number(c.clicks)) : '—'}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{c.ctr != null ? fmtPct(Number(c.ctr)) : '—'}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{c.live_views != null ? fmtNum(Number(c.live_views)) : '—'}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{c.live_follows != null ? fmtNum(Number(c.live_follows)) : '—'}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{fmtNum(c.orders)}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-emerald-300">{fmtBrl(c.gross_revenue)}</td>
                      <td className="px-lg py-3 text-right tabular-nums text-zinc-100">{c.roi != null ? `${Number(c.roi).toFixed(2)}x` : '—'}</td>
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
