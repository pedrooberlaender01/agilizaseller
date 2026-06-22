import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, type UnifiedShipment } from './envios-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 50
const VALID_MKT = ['shopee'] as const
type MarketplaceId = typeof VALID_MKT[number]

type Period = '7d' | '30d' | 'all' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '30d' || raw === 'custom' ? raw : 'all'
}

function parseMarketplaces(raw: string | undefined): MarketplaceId[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MarketplaceId => (VALID_MKT as readonly string[]).includes(s))
}

function parseIsoDateOnly(s: string | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, da] = m
  const d = new Date(Number(y), Number(mo) - 1, Number(da))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function presetCutoff(period: Period): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

const SHOPEE_STATUS_CAT: Record<string, 'in_transit' | 'delivered' | 'problem' | 'pending'> = {
  LOGISTICS_PICKUP_DONE: 'in_transit',
  LOGISTICS_DELIVERY_PENDING: 'in_transit',
  LOGISTICS_DELIVERY_DONE: 'delivered',
  LOGISTICS_FAILED: 'problem',
  LOGISTICS_PICKUP_RETRY: 'problem',
  LOGISTICS_PICKUP_FAILED: 'problem',
  LOGISTICS_DELIVERY_FAILED: 'problem',
  LOGISTICS_RTS: 'problem',
  LOGISTICS_RETURNING: 'problem',
  LOGISTICS_RETURNED: 'problem',
  LOGISTICS_INVOICE_PENDING: 'pending',
  LOGISTICS_READY: 'pending',
  LOGISTICS_REQUEST_CREATED: 'pending',
  LOGISTICS_PICKUP_REQUESTED: 'pending',
}

export default async function EnviosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; mkt?: string; status?: string; q?: string; page?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  let period = parsePeriod(sp.period)
  const mktList = parseMarketplaces(sp.mkt)
  const statusFilter = (sp.status ?? '').trim().toLowerCase()
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)

  let cutoff: Date | null
  let endAt: Date | null = null
  if ((period === 'custom' || (customFrom && customTo)) && customFrom && customTo) {
    period = 'custom'
    cutoff = startOfDay(customFrom)
    endAt = endOfDay(customTo)
  } else {
    if (period === 'custom') period = 'all'
    cutoff = presetCutoff(period)
  }

  const supabase = await createClient()
  const cutoffIso = cutoff?.toISOString() ?? null
  const endIso = endAt?.toISOString() ?? null

  const statusesForClass = (cls: string): string[] =>
    Object.entries(SHOPEE_STATUS_CAT).filter(([, c]) => c === cls).map(([s]) => s)

  const validStatusFilter = ['in_transit', 'delivered', 'problem', 'pending'].includes(statusFilter)
  const statusList = validStatusFilter ? statusesForClass(statusFilter) : []

  const offset = (page - 1) * PAGE_SIZE
  const searchTerm = search ? search.replace(/%/g, '') : null

  let pageQ = supabase
    .from('shopee_shipments')
    .select(
      'id, order_id, tracking_number, logistics_status, shipping_carrier, delivered_at, receiver_city, receiver_state, created_at, order_sn, shopee_orders(buyer_username, date_created, total_amount)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (cutoffIso) pageQ = pageQ.gte('created_at', cutoffIso)
  if (endIso) pageQ = pageQ.lt('created_at', endIso)
  if (searchTerm) pageQ = pageQ.or(`tracking_number.ilike.%${searchTerm}%,order_sn.ilike.%${searchTerm}%`)
  if (statusList.length > 0) pageQ = pageQ.in('logistics_status', statusList)

  const { data: shopeeData, count: totalCount } = await pageQ
  const shopeeRows = (shopeeData ?? []) as unknown as Array<{
    id: string
    order_id: string | null
    tracking_number: string | null
    logistics_status: string | null
    shipping_carrier: string | null
    delivered_at: string | null
    receiver_city: string | null
    receiver_state: string | null
    created_at: string | null
    order_sn: string | null
    shopee_orders: { buyer_username: string | null; date_created: string | null; total_amount: number | string | null } | { buyer_username: string | null; date_created: string | null; total_amount: number | string | null }[] | null
  }>

  const pageRows: UnifiedShipment[] = shopeeRows.map((r) => {
    const so = Array.isArray(r.shopee_orders) ? r.shopee_orders[0] ?? null : r.shopee_orders
    return {
      id: r.id,
      marketplace: 'shopee' as const,
      order_id: r.order_id,
      external_id: r.order_sn,
      tracking_number: r.tracking_number,
      status_code: r.logistics_status,
      status_class: r.logistics_status ? SHOPEE_STATUS_CAT[r.logistics_status] ?? 'pending' : 'pending',
      buyer_name: so?.buyer_username ?? null,
      total_amount: so?.total_amount ?? null,
      currency: 'BRL',
      ship_date: r.created_at,
      shipping_carrier: r.shipping_carrier,
      receiver_city: r.receiver_city,
      receiver_state: r.receiver_state,
      delivered_at: r.delivered_at,
    }
  })

  const counts: Record<string, number> = { shopee: totalCount ?? 0 }

  return (
    <>
      <TopBar title="Envios" />
      <EnviosView
        shipments={pageRows}
        totalCount={totalCount ?? 0}
        page={page}
        period={period}
        from={customFrom ? customFrom.toISOString().slice(0, 10) : null}
        to={customTo ? customTo.toISOString().slice(0, 10) : null}
        selectedMarketplaces={mktList}
        marketplaceCounts={counts}
        status={statusFilter}
        search={search}
      />
    </>
  )
}
