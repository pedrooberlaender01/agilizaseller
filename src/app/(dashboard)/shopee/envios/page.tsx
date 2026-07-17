import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, type Period, type ShipmentRow } from './envios-view'
import { type Category } from './status-map'

const PAGE_SIZE = 50

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === 'all' || raw === 'custom') return raw
  return '30d'
}

function parseCategory(raw: string | undefined): Category | 'all' {
  if (raw === 'in_transit' || raw === 'delivered' || raw === 'problem' || raw === 'pending' || raw === 'cancelled') return raw
  return 'all'
}

function isoDate(s: string | undefined): string | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

// Bounds de created_at pra listagem (os cards são por status atual, sem filtro de data).
function listingBounds(period: Period, from: string | null, to: string | null): { gte: string | null; lte: string | null } {
  if (period === 'custom' && from && to) return { gte: `${from}T00:00:00.000Z`, lte: `${to}T23:59:59.999Z` }
  if (period === 'all') return { gte: null, lte: null }
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return { gte: d.toISOString(), lte: null }
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
  searchParams: Promise<{ status?: string; period?: string; from?: string; to?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const rawPeriod = parsePeriod(sp.period)
  const from = isoDate(sp.from)
  const to = isoDate(sp.to)
  // custom sem range válido cai pra 30d
  const period: Period = rawPeriod === 'custom' && !(from && to) ? '30d' : rawPeriod
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

  const bounds = listingBounds(period, from, to)

  // Cards contam PEDIDOS por order_status (mesma fonte das abas "Meus Pedidos" da Shopee =
  // get_order_list), sem filtro de data — espelha a aba exatamente. O período/busca abaixo
  // filtra só a listagem detalhada, igual à Shopee (filtro aplica na lista, não na aba).
  const { data: countRows } = await supabase.rpc('shopee_envios_counts', { p_conn: conn.id })
  const counts: Record<Category, number> = {
    in_transit: 0,
    delivered: 0,
    problem: 0,
    pending: 0,
    cancelled: 0,
  }
  for (const row of (countRows ?? []) as { categoria: string; total: number }[]) {
    if (row.categoria in counts) counts[row.categoria as Category] = Number(row.total)
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shopee_shipments_active')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)
    .neq('categoria', 'excluded')

  if (bounds.gte) query = query.gte('created_at', bounds.gte)
  if (bounds.lte) query = query.lte('created_at', bounds.lte)

  if (activeCategory !== 'all') {
    query = query.eq('categoria', activeCategory)
  }

  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`tracking_number.ilike.%${term}%,order_sn.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('synced_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalAcrossAll = Object.values(counts).reduce((a, n) => a + n, 0)

  // View traz campos do pedido flat (order_*) — remonta o shape shopee_orders que a view espera.
  const shipments = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      ...row,
      shopee_orders: {
        buyer_username: row.order_buyer_username ?? null,
        date_created: row.order_date_created ?? null,
        total_amount: row.order_total_amount ?? 0,
      },
    }
  }) as unknown as ShipmentRow[]

  return (
    <EnviosView
      shipments={shipments}
      totalCount={count ?? 0}
      page={page}
      counts={counts}
      activeCategory={activeCategory}
      period={period}
      from={from}
      to={to}
      search={search}
      hasAnyShipments={totalAcrossAll > 0}
    />
  )
}
