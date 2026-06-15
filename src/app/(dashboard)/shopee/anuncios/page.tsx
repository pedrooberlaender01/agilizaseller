import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type {
  ShopeeItem,
  ShopeeAdsBalance,
  ShopeeAdsCampaign,
  ShopeeAdsCampaignDailyPerformance,
  ShopeeDailyMetric,
} from '@/types'
import type { Period } from '@/components/metrics-chart'
import { AnunciosView, type CostEntry } from './anuncios-view'
export type { Period }

export type AdsPeriod = Period | 'custom'

function parseAdsPeriod(raw: string | undefined): AdsPeriod {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes' || raw === 'custom') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

function periodRange(period: AdsPeriod, customFrom: string | null, customTo: string | null): { from: string; to: string } {
  const today = new Date()
  const toStr = today.toISOString().slice(0, 10)
  if (period === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo }
  }
  if (period === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: start.toISOString().slice(0, 10), to: toStr }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const from = new Date(today)
  from.setDate(from.getDate() - days + 1)
  return { from: from.toISOString().slice(0, 10), to: toStr }
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Anúncios — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações para começar a sincronizar anúncios.
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

function NoItemsState() {
  return (
    <>
      <TopBar title="Anúncios — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">hourglass_empty</span>
          <h2 className="text-h2 font-semibold text-on-surface">Nenhum anúncio sincronizado</h2>
          <p className="text-sm text-on-surface-variant">
            Aguardando próxima execução do workflow{' '}
            <span className="font-mono text-on-surface">Shopee — Reconciliar Anúncios</span> (cron 2h).
          </p>
        </div>
      </main>
    </>
  )
}

type ProductCostJoin = {
  cost_unit: number | null
  packaging_cost: number | null
  tax_rate: number | null
  valid_from: string | null
  valid_to: string | null
}

type ProductRow = {
  seller_sku: string
  product_costs: ProductCostJoin[] | null
}

export default async function ShopeeAnunciosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab === 'ads' ? 'ads' : 'anuncios'
  const adsPeriod = parseAdsPeriod(sp.period)
  const adsCustomFrom = parseIsoDateOnly(sp.from)
  const adsCustomTo = parseIsoDateOnly(sp.to)
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, external_user_id')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const { data: itemsRaw } = await supabase
    .from('shopee_items')
    .select('*')
    .eq('connection_id', conn.id)
    .order('sold_quantity', { ascending: false, nullsFirst: false })

  const items = (itemsRaw ?? []) as ShopeeItem[]
  if (items.length === 0) return <NoItemsState />

  const skus = items
    .map((i) => i.item_sku)
    .filter((s): s is string => !!s)

  const costsBySku: Record<string, CostEntry> = {}
  if (skus.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('seller_sku, product_costs(cost_unit, packaging_cost, tax_rate, valid_from, valid_to)')
      .in('seller_sku', skus)

    for (const p of (products ?? []) as ProductRow[]) {
      const active = (p.product_costs ?? [])
        .filter((c) => c.valid_to === null)
        .sort((a, b) => (b.valid_from ?? '').localeCompare(a.valid_from ?? ''))[0]
      if (active && active.cost_unit !== null) {
        costsBySku[p.seller_sku] = {
          cost_unit: active.cost_unit,
          packaging_cost: active.packaging_cost ?? 0,
          tax_rate: active.tax_rate ?? 0,
        }
      }
    }
  }

  const { from: adsFrom, to: adsTo } = periodRange(adsPeriod, adsCustomFrom, adsCustomTo)
  const [
    { data: balanceRows },
    { data: campaignRows },
    { data: perfRows },
    { data: dailyRows },
  ] = await Promise.all([
    supabase
      .from('shopee_ads_balance')
      .select('*')
      .eq('connection_id', conn.id)
      .order('snapshot_at', { ascending: false })
      .limit(1),
    supabase
      .from('shopee_ads_campaigns')
      .select('*')
      .eq('connection_id', conn.id),
    supabase
      .from('shopee_ads_campaign_daily_performance')
      .select('*')
      .eq('connection_id', conn.id)
      .gte('date', adsFrom)
      .lte('date', adsTo)
      .order('date', { ascending: true }),
    supabase
      .from('shopee_daily_metrics')
      .select('*')
      .eq('connection_id', conn.id)
      .gte('date', adsFrom)
      .lte('date', adsTo)
      .order('date', { ascending: true }),
  ])

  return (
    <AnunciosView
      items={items}
      costsBySku={costsBySku}
      shopExternalId={conn.external_user_id ?? null}
      tab={tab}
      adsBalance={(balanceRows?.[0] ?? null) as ShopeeAdsBalance | null}
      adsCampaigns={(campaignRows ?? []) as ShopeeAdsCampaign[]}
      adsPerformance={(perfRows ?? []) as ShopeeAdsCampaignDailyPerformance[]}
      adsDaily={(dailyRows ?? []) as ShopeeDailyMetric[]}
      adsPeriod={adsPeriod}
      adsCustomFrom={adsPeriod === 'custom' ? adsCustomFrom : null}
      adsCustomTo={adsPeriod === 'custom' ? adsCustomTo : null}
    />
  )
}
