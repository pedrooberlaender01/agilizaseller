import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { PedidosView, type UnifiedOrder } from './pedidos-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 50

type Period = '7d' | '30d' | 'all' | 'custom'

const VALID_MKT = ['magazord', 'mercado_livre', 'shopee', 'shein'] as const
type MarketplaceId = typeof VALID_MKT[number]

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

export default async function PedidosUnifiedPage({
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

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('all_orders_unified')
    .select('*', { count: 'exact' })

  if (cutoff) query = query.gte('order_date', cutoff.toISOString())
  if (endAt) query = query.lt('order_date', endAt.toISOString())

  if (mktList.length === 1) {
    query = query.eq('marketplace', mktList[0])
  } else if (mktList.length > 1) {
    query = query.in('marketplace', mktList)
  }

  if (statusFilter && ['paid', 'cancelled', 'pending', 'other'].includes(statusFilter)) {
    query = query.eq('status_class', statusFilter)
  }

  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,buyer_name.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('order_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: mktCountsRaw } = await supabase.rpc('all_orders_counts', {
    p_cutoff: cutoff?.toISOString() ?? null,
    p_end: endAt?.toISOString() ?? null,
  })

  const counts: Record<string, number> = { magazord: 0, mercado_livre: 0, shopee: 0, shein: 0 }
  for (const row of (mktCountsRaw ?? []) as { marketplace: string; total: number }[]) {
    counts[row.marketplace] = Number(row.total) || 0
  }

  return (
    <>
      <TopBar title="Pedidos" />
      <PedidosView
        orders={(data ?? []) as UnifiedOrder[]}
        totalCount={count ?? 0}
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
