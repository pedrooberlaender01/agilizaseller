import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { ShopeeOrderStatus } from '@/types'
import { PedidosView, type OrderRow } from './pedidos-view'

const PAGE_SIZE = 50
const VALID_STATUSES: readonly ShopeeOrderStatus[] = [
  'UNPAID', 'READY_TO_SHIP', 'PROCESSED', 'SHIPPED',
  'TO_CONFIRM_RECEIVE', 'COMPLETED', 'IN_CANCEL', 'CANCELLED', 'INVOICE_PENDING',
] as const

type Period = '7d' | '30d' | '90d'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' ? raw : '30d'
}

function parseStatuses(raw: string | undefined): ShopeeOrderStatus[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ShopeeOrderStatus => VALID_STATUSES.includes(s as ShopeeOrderStatus))
}

function periodCutoffIso(period: Period): string {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Pedidos — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações para começar a sincronizar pedidos.
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

export default async function ShopeePedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const statuses = parseStatuses(sp.status)
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
  const connId = conn.id

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shopee_orders')
    .select(
      '*, shopee_order_items(count), shopee_order_margins(gross_profit, margin_pct, cost_missing, net_amount_real_cents, escrow_synced_at), shopee_shipments(logistics_status, tracking_number)',
      { count: 'exact' },
    )
    .eq('connection_id', connId)
    .gte('date_created', periodCutoffIso(period))

  if (statuses.length > 0) query = query.in('status', statuses)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,buyer_username.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('date_created', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  // KPIs agregados pra todo o período (paginação manual — Supabase JS cap 1000/query)
  type KpiRow = {
    total_amount: number | null
    status: string
    shopee_order_margins: { net_amount_real_cents: number | null; gross_profit: number | null; escrow_synced_at: string | null }[]
  }
  async function fetchAllKpis(): Promise<KpiRow[]> {
    const all: KpiRow[] = []
    for (let p = 0; p < 20; p++) {
      let q = supabase
        .from('shopee_orders')
        .select('total_amount, status, shopee_order_margins(net_amount_real_cents, gross_profit, escrow_synced_at)')
        .eq('connection_id', connId)
        .gte('date_created', periodCutoffIso(period))
      if (statuses.length > 0) q = q.in('status', statuses)
      if (search) {
        const term = search.replace(/%/g, '')
        q = q.or(`external_id.ilike.%${term}%,buyer_username.ilike.%${term}%`)
      }
      const { data: chunk } = await q.range(p * 1000, p * 1000 + 999)
      if (!chunk || chunk.length === 0) break
      all.push(...(chunk as KpiRow[]))
      if (chunk.length < 1000) break
    }
    return all
  }
  const allRows = await fetchAllKpis()
  const totalOrders = allRows.length
  const totalRevenue = allRows.reduce((a, r) => a + (Number(r.total_amount) || 0), 0)
  const cancelled = allRows.filter((r) => r.status === 'CANCELLED' || r.status === 'IN_CANCEL').length
  const netReal = allRows.reduce((a, r) => {
    const m = r.shopee_order_margins?.[0]
    if (!m) return a
    if (m.net_amount_real_cents != null) return a + Number(m.net_amount_real_cents) / 100
    return a + (Number(m.gross_profit) || 0)
  }, 0)
  const escrowSynced = allRows.filter((r) => r.shopee_order_margins?.[0]?.escrow_synced_at != null).length
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return (
    <PedidosView
      orders={(data ?? []) as OrderRow[]}
      totalCount={count ?? 0}
      page={page}
      period={period}
      statusList={statuses}
      search={search}
      kpis={{
        totalOrders,
        totalRevenue,
        netReal,
        avgTicket,
        cancelled,
        escrowSynced,
      }}
    />
  )
}
