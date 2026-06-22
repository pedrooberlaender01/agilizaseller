import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { MetricasView, type DailyMetric } from './metricas-view'

export const revalidate = 60

type Period = '7d' | '30d' | '90d'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' ? raw : '30d'
}

function periodCutoffIso(period: Period): string {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export default async function SheinMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Métricas — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const cutoff = periodCutoffIso(period)

  const [{ data: rows, error }, marginAgg] = await Promise.all([
    supabase.rpc('shein_metrics_realtime', {
      p_connection_id: conn.id,
      p_cutoff: cutoff,
    }),
    supabase.rpc('shein_margins_agg', {
      p_connection_id: conn.id,
      p_cutoff: cutoff,
    }),
  ])

  if (error) {
    return (
      <>
        <TopBar title="Métricas — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-error">Erro ao calcular métricas: {error.message}</p>
        </main>
      </>
    )
  }

  const aggRow = ((marginAgg.data ?? []) as Array<{
    estimated: number | string | null
    total_gross: number | string | null
    total_commission: number | string | null
    total_service_charge: number | string | null
    covered_gross: number | string | null
    covered_estimated: number | string | null
    covered_cost: number | string | null
    covered_profit: number | string | null
    covered_units: number | string | null
    uncovered_units: number | string | null
  }>)[0]
  const costAgg = {
    estimated: Number(aggRow?.estimated ?? 0),
    totalGross: Number(aggRow?.total_gross ?? 0),
    totalCommission: Number(aggRow?.total_commission ?? 0),
    totalServiceCharge: Number(aggRow?.total_service_charge ?? 0),
    coveredGross: Number(aggRow?.covered_gross ?? 0),
    coveredEstimated: Number(aggRow?.covered_estimated ?? 0),
    coveredCost: Number(aggRow?.covered_cost ?? 0),
    coveredProfit: Number(aggRow?.covered_profit ?? 0),
    coveredUnits: Number(aggRow?.covered_units ?? 0),
    uncoveredUnits: Number(aggRow?.uncovered_units ?? 0),
  }

  return (
    <MetricasView
      rows={(rows ?? []) as DailyMetric[]}
      period={period}
      nickname={conn.nickname}
      costAgg={costAgg}
    />
  )
}
