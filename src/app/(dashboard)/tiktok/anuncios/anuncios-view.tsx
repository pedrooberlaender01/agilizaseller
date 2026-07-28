'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { RevenueChart } from '@/components/revenue-chart'
import { cn } from '@/lib/utils'
import { KpiCard, fmtBrl, fmtNum, fmtPct } from '../_ui'

type Period = '7d' | '30d' | '90d'
export type AdsDay = { dia: string; gasto: number; cobrancas: number }

// Métricas que exigem a TikTok Marketing API (app separado) — não temos.
const SEM_API = [
  'Campanhas (nome, status, budget)',
  'Impressões e cliques',
  'CTR e CPC',
  'GMV atribuído a Ads',
  'ROAS por campanha',
  'Taxa de conversão',
]

export function AnunciosView({
  period,
  gasto,
  cobrancas,
  faturamento,
  series,
}: {
  period: Period
  gasto: number
  cobrancas: number
  faturamento: number
  series: AdsDay[]
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
            <p className="text-sm font-medium text-zinc-100">Gasto real da carteira (GMV Max)</p>
            <p className="mt-1 text-xs text-slate-400">
              O gasto vem das cobranças de anúncios debitadas no financeiro da loja. Métricas de campanha
              (impressões, cliques, ROAS) ficam na TikTok Marketing API, que é uma plataforma separada e exige
              um app próprio — ainda não integrada.
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

        {/* O que falta */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Requer TikTok Marketing API</h3>
            <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">App separado, não integrado</p>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 p-lg md:grid-cols-2">
            {SEM_API.map((l) => (
              <div key={l} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{l}</span>
                <span className="text-zinc-600">—</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
