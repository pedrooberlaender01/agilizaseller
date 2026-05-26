import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { MetricasView, type DailyMetric } from './metricas-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  const { data: rows, error } = await supabase.rpc('shein_metrics_realtime', {
    p_connection_id: conn.id,
    p_cutoff: periodCutoffIso(period),
  })

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

  return (
    <MetricasView
      rows={(rows ?? []) as DailyMetric[]}
      period={period}
      nickname={conn.nickname}
    />
  )
}
