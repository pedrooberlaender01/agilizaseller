import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { MetricasView, type DailyPoint, type StatusCount } from './metricas-view'

export const revalidate = 60

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}
function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}
function periodRangeIso(period: Period, cf: string | null, ct: string | null): { from: string; to: string } {
  const now = new Date()
  if (period === 'custom' && cf && ct) {
    const f = new Date(cf + 'T00:00:00-03:00')
    const t = new Date(ct + 'T00:00:00-03:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date(now)
  d.setDate(d.getDate() - days + 1)
  d.setHours(0, 0, 0, 0)
  return { from: d.toISOString(), to: now.toISOString() }
}

export default async function TiktokMetricasPage({
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
    .eq('marketplace', 'tiktok_shop')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Métricas — TikTok Shop" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <div className="border border-zinc-800 bg-zinc-900/40 flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
            <span className="material-symbols-outlined text-4xl text-zinc-50">link_off</span>
            <h2 className="text-h2 font-semibold text-zinc-50">Sem conexão TikTok Shop ativa</h2>
            <Link href="/configuracoes" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100">
              <span className="material-symbols-outlined text-[18px]">link</span>
              Ir para Configurações
            </Link>
          </div>
        </main>
      </>
    )
  }

  const { from, to } = periodRangeIso(period, customFrom, customTo)

  const [metricsRes, financeRes, seriesRes] = await Promise.all([
    supabase.rpc('tt_metrics_realtime', { p_from: from, p_to: to }),
    supabase.rpc('tt_finance_realtime', { p_from: from, p_to: to }),
    supabase.rpc('tt_daily_series', { p_from: from, p_to: to }),
  ])

  const m = (metricsRes.data ?? {}) as {
    orders_count?: number; gross_revenue?: number | string; ticket_medio?: number | string
    cancelled?: number; delivered?: number; by_status?: Record<string, number>
  }
  const f = (financeRes.data ?? {}) as { repasse?: number | string; taxas?: number | string; receita?: number | string }
  const byStatus: StatusCount[] = Object.entries(m.by_status ?? {})
    .map(([status, count]) => ({ status, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
  const series = ((seriesRes.data ?? []) as Array<{ dia: string; pedidos: number; faturamento: number | string }>)
    .map((r) => ({ dia: r.dia, pedidos: Number(r.pedidos), faturamento: Number(r.faturamento) })) as DailyPoint[]

  return (
    <MetricasView
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      kpi={{
        orders: Number(m.orders_count ?? 0),
        gross: Number(m.gross_revenue ?? 0),
        ticket: Number(m.ticket_medio ?? 0),
        cancelled: Number(m.cancelled ?? 0),
        delivered: Number(m.delivered ?? 0),
        repasse: Number(f.repasse ?? 0),
        taxas: Number(f.taxas ?? 0),
      }}
      byStatus={byStatus}
      series={series}
    />
  )
}
