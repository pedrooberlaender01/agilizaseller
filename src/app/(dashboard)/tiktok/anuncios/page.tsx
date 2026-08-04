import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { AnunciosView, type AdsDay } from './anuncios-view'

export const revalidate = 60

type Period = '7d' | '30d' | '90d'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' ? raw : '30d'
}
function periodRangeIso(period: Period): { from: string; to: string } {
  const now = new Date()
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return { from: d.toISOString(), to: now.toISOString() }
}

export default async function TiktokAnunciosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'tiktok_shop')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Anúncios — TikTok Shop" />
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

  const { from, to } = periodRangeIso(period)
  const fromDate = from.slice(0, 10)
  const toDate = to.slice(0, 10)

  const [adsRes, seriesRes, metricsRes, campaignsRes] = await Promise.all([
    supabase.rpc('tt_ads_realtime', { p_from: from, p_to: to }),
    supabase.rpc('tt_ads_series', { p_from: from, p_to: to }),
    supabase.rpc('tt_metrics_realtime', { p_from: from, p_to: to }),
    supabase.rpc('tt_ads_campaigns_table', { p_from: fromDate, p_to: toDate }),
  ])

  const a = (adsRes.data ?? {}) as { ads_spend?: number | string; payments_count?: number }
  const m = (metricsRes.data ?? {}) as { gross_revenue?: number | string }
  const series = ((seriesRes.data ?? []) as Array<{ dia: string; gasto: number | string; cobrancas: number }>)
    .map((r) => ({ dia: r.dia, gasto: Math.abs(Number(r.gasto)), cobrancas: Number(r.cobrancas) })) as AdsDay[]
  const campaigns = (campaignsRes.data ?? []) as Array<{
    campaign_id: string; campaign_name: string | null; operation_status: string | null
    secondary_status: string | null; spend: number | string; orders: number
    gross_revenue: number | string; roi: number | string | null
    impressions: number | string | null; clicks: number | string | null; ctr: number | string | null
    live_views: number | string | null; live_follows: number | string | null
  }>

  const gasto = Math.abs(Number(a.ads_spend ?? 0))
  const faturamento = Number(m.gross_revenue ?? 0)

  return (
    <AnunciosView
      period={period}
      gasto={gasto}
      cobrancas={Number(a.payments_count ?? 0)}
      faturamento={faturamento}
      series={series}
      campaigns={campaigns}
    />
  )
}
