import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { AdsView, type AdsDailyRow } from './ads-view'
import type { Period } from '@/components/metrics-chart'

export const revalidate = 60

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** Início do período em data pura (YYYY-MM-DD) — ml_ads_daily.date é date, sem timezone. */
function periodFrom(period: Period): string {
  const d = new Date()
  if (period === 'mes') {
    d.setDate(1)
  } else {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    d.setDate(d.getDate() - days + 1)
  }
  return d.toISOString().slice(0, 10)
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Ads — Mercado Livre" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Mercado Livre ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Mercado Livre em Configurações para acompanhar o Mercado Ads.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-sm font-medium text-on-tertiary transition-colors hover:bg-tertiary/90"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function MercadoLivreAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const isCustom = !!(customFrom && customTo)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'mercado_livre')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const from = isCustom ? customFrom! : periodFrom(period)
  const to = isCustom ? customTo! : new Date().toISOString().slice(0, 10)

  // ml_ads_daily já tem tudo por dia (cost/clicks/prints/total_amount) — leitura direta,
  // sem RPC. O faturamento do mesmo período vem do financeiro pra calcular % vendas via Ads.
  const [{ data: adsData }, { data: finData }] = await Promise.all([
    supabase
      .from('ml_ads_daily')
      .select('date, cost, clicks, prints, total_amount')
      .eq('connection_id', conn.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true }),
    supabase.rpc('ml_financeiro_daily', {
      p_connection_id: conn.id,
      p_from: `${from}T00:00:00-03:00`,
      p_to: `${to}T23:59:59-03:00`,
    }),
  ])

  const rows: AdsDailyRow[] = ((adsData ?? []) as Array<Record<string, unknown>>).map((r) => ({
    date: String(r.date),
    cost: Number(r.cost) || 0,
    clicks: Number(r.clicks) || 0,
    prints: Number(r.prints) || 0,
    gmv: Number(r.total_amount) || 0,
  }))

  const faturamento = ((finData ?? []) as Array<{ faturamento: number | string }>).reduce(
    (a, r) => a + (Number(r.faturamento) || 0),
    0,
  )

  return (
    <AdsView
      rows={rows}
      faturamento={faturamento}
      period={period}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
    />
  )
}
