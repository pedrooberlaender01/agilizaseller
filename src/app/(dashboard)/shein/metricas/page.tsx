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
    supabase
      .from('shein_margins_enriched')
      .select('quantity, seller_price, estimated_income, total_cost, real_profit, cost_price, commission, service_charge')
      .eq('connection_id', conn.id)
      .gte('order_time', cutoff),
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

  const marginRows = (marginAgg.data ?? []) as Array<{
    quantity: number | null
    seller_price: number | string | null
    estimated_income: number | string | null
    total_cost: number | string | null
    real_profit: number | string | null
    cost_price: number | string | null
    commission: number | string | null
    service_charge: number | string | null
  }>

  const costAgg = marginRows.reduce(
    (acc, r) => {
      const qty = Number(r.quantity ?? 0)
      const gross = qty * Number(r.seller_price ?? 0)
      acc.estimated += Number(r.estimated_income ?? 0)
      acc.totalGross += gross
      acc.totalCommission += Number(r.commission ?? 0)
      acc.totalServiceCharge += Number(r.service_charge ?? 0)
      if (r.cost_price !== null && r.cost_price !== undefined) {
        acc.coveredGross += gross
        acc.coveredEstimated += Number(r.estimated_income ?? 0)
        acc.coveredCost += Number(r.total_cost ?? 0)
        acc.coveredProfit += Number(r.real_profit ?? 0)
        acc.coveredUnits += qty
      } else {
        acc.uncoveredUnits += qty
      }
      return acc
    },
    {
      estimated: 0,
      totalGross: 0,
      totalCommission: 0,
      totalServiceCharge: 0,
      coveredGross: 0,
      coveredEstimated: 0,
      coveredCost: 0,
      coveredProfit: 0,
      coveredUnits: 0,
      uncoveredUnits: 0,
    },
  )

  return (
    <MetricasView
      rows={(rows ?? []) as DailyMetric[]}
      period={period}
      nickname={conn.nickname}
      costAgg={costAgg}
    />
  )
}
