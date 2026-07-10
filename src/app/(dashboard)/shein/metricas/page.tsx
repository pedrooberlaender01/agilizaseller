import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { MetricasView, type DailyMetric } from './metricas-view'

export const revalidate = 60

type Period = '7d' | '30d' | '90d' | 'mes' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === '90d' || raw === 'mes' || raw === 'custom') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

// Shein painel usa fuso SGT (UTC+8, China). Interpretar datas selecionadas em SGT
// pra bater com painel Shein oficial. 08/06 00:00 SGT = 07/06 13:00 BRT.
function periodRangeIso(period: Period, customFrom: string | null, customTo: string | null): { from: string; to: string | null } {
  const today = new Date()
  const toIso = today.toISOString()
  if (period === 'custom' && customFrom && customTo) {
    // Interpretar data como SGT: 08/06 vira 08/06 00:00:00+08 (= 07/06 16:00 UTC)
    const f = new Date(customFrom + 'T00:00:00+08:00')
    // Fim do dia SGT: 08/07 vira 09/07 00:00:00+08 (exclusivo)
    const t = new Date(customTo + 'T00:00:00+08:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  if (period === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: start.toISOString(), to: toIso }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date(today)
  d.setDate(d.getDate() - days + 1)
  d.setHours(0, 0, 0, 0)
  return { from: d.toISOString(), to: toIso }
}

export default async function SheinMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
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

  const { from, to } = periodRangeIso(period, customFrom, customTo)

  const [{ data: rows, error }, marginAgg] = await Promise.all([
    supabase.rpc('shein_metrics_realtime', {
      p_connection_id: conn.id,
      p_cutoff: from,
      p_end: to,
    }),
    supabase.rpc('shein_margins_agg', {
      p_connection_id: conn.id,
      p_cutoff: from,
      p_end: to,
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
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      nickname={conn.nickname}
      costAgg={costAgg}
    />
  )
}
