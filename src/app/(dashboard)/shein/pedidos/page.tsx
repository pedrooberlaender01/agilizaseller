import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { PedidosView, type OrderRow } from './pedidos-view'

export const revalidate = 60

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

// Retorna janela {from, to}. Custom = BRT (data local BR, bate painel Meus Pedidos Shein).
function periodRangeIso(
  period: Period,
  customFrom: string | null,
  customTo: string | null,
): { from: string; to: string | null } {
  if (period === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00-03:00')
    const t = new Date(customTo + 'T00:00:00-03:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return { from: d.toISOString(), to: null }
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Pedidos — Shein" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="border border-zinc-800 bg-zinc-900/40 flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-zinc-50">link_off</span>
          <h2 className="text-h2 font-semibold text-zinc-50">Sem conexão Shein ativa</h2>
          <p className="text-sm text-zinc-400">
            Configure a conexão Shein em Configurações para começar a sincronizar pedidos.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function SheinPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; payment?: string; shipping?: string; q?: string; page?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const statusFilter = (sp.status ?? '').trim()
  const paymentFilter = (sp.payment ?? '').trim()
  const shippingFilter = (sp.shipping ?? '').trim()
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const offset = (page - 1) * PAGE_SIZE
  const { from, to } = periodRangeIso(period, customFrom, customTo)
  let query = supabase
    .from('shein_orders')
    .select('*, shein_order_items(quantity, commission, service_charge, estimated_income, seller_price, product_name)', { count: 'exact' })
    .eq('connection_id', conn.id)
    .gte('order_time', from)

  if (to) query = query.lt('order_time', to)
  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(Boolean)
    if (statuses.length > 0) query = query.in('order_status', statuses)
  }
  if (paymentFilter) {
    query = query.eq('payment_status', paymentFilter)
  }
  if (shippingFilter) {
    query = query.eq('shipping_status', shippingFilter)
  }
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`order_no.ilike.%${term}%,buyer_name.ilike.%${term}%,buyer_email.ilike.%${term}%`)
  }

  const statusesArr = statusFilter ? statusFilter.split(',').filter(Boolean) : null

  const [pageResult, statusesResult, totalsResult] = await Promise.all([
    query
      .order('order_time', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('shein_distinct_order_statuses', { p_connection_id: conn.id }),
    supabase.rpc('shein_pedidos_totals', {
      p_connection_id: conn.id,
      p_cutoff: from,
      p_end: to,
      p_statuses: statusesArr,
      p_payment: paymentFilter || null,
      p_shipping: shippingFilter || null,
      p_search: search || null,
    }),
  ])
  const { data, count } = pageResult
  const uniqueStatuses = ((statusesResult.data ?? []) as Array<{ status: string | null }>)
    .map((r) => r.status)
    .filter((s): s is string => !!s)

  const totalsRow = ((totalsResult.data ?? []) as Array<{
    gmv: number | string | null
    fees: number | string | null
    estimated: number | string | null
    total: number | string | null
  }>)[0]
  const periodTotals = {
    gmv: Number(totalsRow?.gmv ?? 0),
    fees: Number(totalsRow?.fees ?? 0),
    estimated: Number(totalsRow?.estimated ?? 0),
  }

  return (
    <PedidosView
      orders={(data ?? []) as OrderRow[]}
      totalCount={count ?? 0}
      periodTotals={periodTotals}
      page={page}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      status={statusFilter}
      payment={paymentFilter}
      shipping={shippingFilter}
      search={search}
      statuses={uniqueStatuses}
    />
  )
}
