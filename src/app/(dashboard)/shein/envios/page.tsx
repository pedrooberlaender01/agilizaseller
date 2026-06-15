import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, type ShipmentRow } from './envios-view'

export const revalidate = 60

const PAGE_SIZE = 50

export default async function SheinEnviosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; carrier?: string; status?: string; page?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const carrierFilter = (sp.carrier ?? '').trim()
  const statusFilter = (sp.status ?? '').trim() // 'pending' | 'transit' | 'delivered'
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
  let query = supabase
    .from('shein_shipments_enriched')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (carrierFilter) query = query.eq('carrier', carrierFilter)
  if (statusFilter === 'pending') query = query.is('carrier', null)
  if (statusFilter === 'transit') {
    query = query.not('carrier', 'is', null).not('last_node', 'in', '("sign_for","signed","delivered")')
  }
  if (statusFilter === 'delivered') {
    query = query.in('last_node', ['sign_for', 'signed', 'delivered'])
  }
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`order_no.ilike.%${term}%,waybill_no.ilike.%${term}%,package_no.ilike.%${term}%,product_name.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('last_update_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: carrierRows } = await supabase
    .from('shein_shipments')
    .select('carrier')
    .eq('connection_id', conn.id)
    .not('carrier', 'is', null)

  const carriers = Array.from(
    new Set(((carrierRows ?? []) as Array<{ carrier: string }>).map((r) => r.carrier)),
  ).sort()

  // Counts pra KPIs
  const { count: totalCount } = await supabase
    .from('shein_shipments')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)

  const { count: pendingCount } = await supabase
    .from('shein_shipments')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .is('carrier', null)

  const { count: deliveredCount } = await supabase
    .from('shein_shipments')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .in('last_node', ['sign_for', 'signed', 'delivered'])

  const transitCount = (totalCount ?? 0) - (pendingCount ?? 0) - (deliveredCount ?? 0)

  return (
    <EnviosView
      shipments={(data ?? []) as ShipmentRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      carrier={carrierFilter}
      status={statusFilter}
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
