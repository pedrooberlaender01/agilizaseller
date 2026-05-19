import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, STATUS_CATEGORY, type Category, type Period, type ShipmentRow } from './envios-view'

const PAGE_SIZE = 50

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' ? raw : '30d'
}

function parseCategory(raw: string | undefined): Category | 'all' {
  if (raw === 'in_transit' || raw === 'delivered' || raw === 'problem' || raw === 'pending') return raw
  return 'all'
}

function periodCutoffIso(period: Period): string {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function statusesForCategory(cat: Category): string[] {
  return Object.entries(STATUS_CATEGORY)
    .filter(([, c]) => c === cat)
    .map(([s]) => s)
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Envios — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações para começar a sincronizar envios.
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

export default async function ShopeeEnviosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const activeCategory = parseCategory(sp.status)
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const cutoff = periodCutoffIso(period)

  const { data: statusRows } = await supabase
    .from('shopee_shipments')
    .select('logistics_status')
    .eq('connection_id', conn.id)
    .gte('created_at', cutoff)

  const counts: Record<Category, number> = { in_transit: 0, delivered: 0, problem: 0, pending: 0 }
  for (const r of (statusRows ?? []) as { logistics_status: string | null }[]) {
    if (!r.logistics_status) continue
    const c = STATUS_CATEGORY[r.logistics_status]
    if (c) counts[c]++
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shopee_shipments')
    .select(
      '*, shopee_orders(buyer_username, date_created, total_amount)',
      { count: 'exact' },
    )
    .eq('connection_id', conn.id)
    .gte('created_at', cutoff)

  if (activeCategory !== 'all') {
    const statuses = statusesForCategory(activeCategory)
    if (statuses.length > 0) query = query.in('logistics_status', statuses)
  }

  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`tracking_number.ilike.%${term}%,order_sn.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('synced_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalAcrossAll = (statusRows ?? []).length

  return (
    <EnviosView
      shipments={(data ?? []) as ShipmentRow[]}
      totalCount={count ?? 0}
      page={page}
      counts={counts}
      activeCategory={activeCategory}
      period={period}
      search={search}
      hasAnyShipments={totalAcrossAll > 0}
    />
  )
}
