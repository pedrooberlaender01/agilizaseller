import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, type ShipmentRow } from './envios-view'

export const revalidate = 60

const PAGE_SIZE = 50

type Period = '7d' | '30d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === 'custom' ? raw : '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

// Filtra por data de criação do pedido (order_time). Custom = BRT (bate painel Meus Pedidos).
function periodRangeIso(period: Period, customFrom: string | null, customTo: string | null): { from: string; to: string | null } {
  if (period === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00-03:00')
    const t = new Date(customTo + 'T00:00:00-03:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return { from: d.toISOString(), to: null }
}

export default async function SheinEnviosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; carrier?: string; status?: string; page?: string; period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const carrierFilter = (sp.carrier ?? '').trim()
  const statusFilter = (sp.status ?? '').trim() // 'pending' | 'transit' | 'delivered'
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

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
        <TopBar title="Envios — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  const { from, to } = periodRangeIso(period, customFrom, customTo)
  let query = supabase
    .from('shein_shipments_enriched')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)
    .gte('order_time', from)
  if (to) query = query.lt('order_time', to)

  // Status real vem do tracking (last_node), não da presença de carrier (nulo em quase tudo).
  const DELIVERED_NODES = ['sign_for', 'signed', 'delivered', 'sign_for_others']
  if (carrierFilter) query = query.eq('carrier', carrierFilter)
  if (statusFilter === 'pending') query = query.is('last_node', null)
  if (statusFilter === 'transit') {
    query = query.not('last_node', 'is', null).not('last_node', 'in', `(${DELIVERED_NODES.map((n) => `"${n}"`).join(',')})`)
  }
  if (statusFilter === 'delivered') {
    query = query.in('last_node', DELIVERED_NODES)
  }
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`order_no.ilike.%${term}%,waybill_no.ilike.%${term}%,package_no.ilike.%${term}%,product_name.ilike.%${term}%`)
  }

  const [pageResult, statsResult] = await Promise.all([
    query
      .order('last_update_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('shein_envios_stats', { p_connection_id: conn.id, p_cutoff: from, p_end: to }),
  ])
  const { data, count } = pageResult
  const statsRow = (statsResult.data ?? [])[0] as {
    total: number | string | null
    pending: number | string | null
    delivered: number | string | null
    transit: number | string | null
    carriers: string[] | null
  } | undefined
  const totalCount = Number(statsRow?.total ?? 0)
  const pendingCount = Number(statsRow?.pending ?? 0)
  const deliveredCount = Number(statsRow?.delivered ?? 0)
  const transitCount = Number(statsRow?.transit ?? 0)
  const carriers = statsRow?.carriers ?? []

  return (
    <EnviosView
      shipments={(data ?? []) as ShipmentRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      carrier={carrierFilter}
      status={statusFilter}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      carriers={carriers}
      stats={{
        total: totalCount ?? 0,
        pending: pendingCount ?? 0,
        transit: Math.max(0, transitCount),
        delivered: deliveredCount ?? 0,
      }}
      nickname={conn.nickname}
    />
  )
}
