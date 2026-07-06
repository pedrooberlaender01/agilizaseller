import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { ShopeeWalletTransaction, ShopeePayout, ShopeeDailyMetric } from '@/types'
import type { Period } from '@/components/metrics-chart'
import { FinanceiroView } from './financeiro-view'

export const revalidate = 60

export type FinanceiroPeriod = Period | 'custom'

function parsePeriod(raw: string | undefined): FinanceiroPeriod {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes' || raw === 'custom') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

function periodRange(period: FinanceiroPeriod, customFrom: string | null, customTo: string | null): { from: string; to: string } {
  const today = new Date()
  const toStr = today.toISOString()
  if (period === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00')
    const t = new Date(customTo + 'T23:59:59')
    return { from: f.toISOString(), to: t.toISOString() }
  }
  if (period === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: start.toISOString(), to: toStr }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const from = new Date(today)
  from.setDate(from.getDate() - days + 1)
  from.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: toStr }
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Financeiro — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-sm font-medium text-on-tertiary"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function ShopeeFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; type?: string; from?: string; to?: string; view?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const typeFilter = sp.type || 'all'
  const isTaxasView = sp.view === 'taxas'
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />
  const connId = conn.id

  const { from, to } = periodRange(period, customFrom, customTo)

  // Supabase JS hard cap 1000/query → paginar em paralelo a partir do count
  async function fetchAllTransactions(): Promise<ShopeeWalletTransaction[]> {
    const baseQuery = () => supabase
      .from('shopee_wallet_transactions')
      .select('*', { count: 'estimated' })
      .eq('connection_id', connId)
      .gte('create_time', from)
      .lte('create_time', to)
      .order('create_time', { ascending: false })

    const { data: firstChunk, count } = await baseQuery().range(0, 999)
    const total = count ?? firstChunk?.length ?? 0
    const all: ShopeeWalletTransaction[] = (firstChunk ?? []) as ShopeeWalletTransaction[]
    if (total <= 1000) return all

    const remainingChunks = Math.min(19, Math.ceil(total / 1000) - 1)
    const rangeStarts = Array.from({ length: remainingChunks }, (_, i) => (i + 1) * 1000)
    const results = await Promise.all(
      rangeStarts.map((start) =>
        baseQuery()
          .range(start, start + 999)
          .then((r) => (r.data ?? []) as ShopeeWalletTransaction[]),
      ),
    )
    for (const arr of results) all.push(...arr)
    return all
  }

  const fromDate = from.slice(0, 10)
  const toDate = to.slice(0, 10)

  // Aba Taxas: todos os pedidos do período com breakdown de taxas (paginado server → completo)
  async function fetchOrderFeesList() {
    if (!isTaxasView) return null
    const selectCols = [
      'external_id', 'date_created', 'status', 'total_amount',
      'shopee_order_margins(gross_revenue,commission_fee_real_cents,net_commission_fee_cents,service_fee_real_cents,net_service_fee_cents,shipping_protection_fee_cents,actual_shipping_fee_cents,shopee_shipping_rebate_cents,escrow_amount_cents,is_estimated,' +
      'selling_price:escrow_raw->order_income->>order_selling_price,buyer_ship:escrow_raw->order_income->>buyer_paid_shipping_fee,' +
      'preco_produto:escrow_raw->order_income->>original_cost_of_goods_sold,reembolso:escrow_raw->order_income->>seller_return_refund)',
    ].join(',')
    const baseQuery = () => supabase
      .from('shopee_orders')
      .select(selectCols, { count: 'estimated' })
      .eq('connection_id', connId)
      .gte('date_created', from)
      .lte('date_created', to)
      .not('status', 'in', '("CANCELLED","IN_CANCEL","UNPAID","INVOICE_PENDING")')
      .order('date_created', { ascending: false })

    const { data: first, count } = await baseQuery().range(0, 999)
    const total = count ?? first?.length ?? 0
    const all = [...(first ?? [])]
    if (total > 1000) {
      const chunks = Math.min(9, Math.ceil(total / 1000) - 1)
      const starts = Array.from({ length: chunks }, (_, i) => (i + 1) * 1000)
      const results = await Promise.all(starts.map((s) => baseQuery().range(s, s + 999).then((r) => r.data ?? [])))
      for (const arr of results) all.push(...arr)
    }
    type RawRow = {
      external_id: string; date_created: string; status: string; total_amount: number | string
      shopee_order_margins: {
        gross_revenue: number | string | null
        commission_fee_real_cents: number | null; net_commission_fee_cents: number | null
        service_fee_real_cents: number | null; net_service_fee_cents: number | null
        shipping_protection_fee_cents: number | null
        actual_shipping_fee_cents: number | null; shopee_shipping_rebate_cents: number | null
        escrow_amount_cents: number | null; is_estimated: boolean | null
        selling_price: string | null; buyer_ship: string | null
        preco_produto: string | null; reembolso: string | null
      }[] | null
    }
    return (all as unknown as RawRow[]).map((o) => {
      const m = Array.isArray(o.shopee_order_margins) ? o.shopee_order_margins[0] : o.shopee_order_margins
      return {
        order_sn: o.external_id,
        date_created: o.date_created,
        status: o.status,
        valor: Number(m?.selling_price ?? o.total_amount) || 0,
        preco_produto: Number(m?.preco_produto ?? 0) || 0,
        reembolso: Number(m?.reembolso ?? 0) || 0,
        buyer_ship: Number(m?.buyer_ship ?? 0) || 0,
        comissao_bruta: (m?.commission_fee_real_cents ?? 0) / 100,
        comissao_liq: (m?.net_commission_fee_cents ?? 0) / 100,
        servico_bruta: (m?.service_fee_real_cents ?? 0) / 100,
        servico_liq: (m?.net_service_fee_cents ?? 0) / 100,
        dev_facil_real: (m?.shipping_protection_fee_cents ?? 0) / 100,
        frete_real: (m?.actual_shipping_fee_cents ?? 0) / 100,
        frete_rebate: (m?.shopee_shipping_rebate_cents ?? 0) / 100,
        renda: (m?.escrow_amount_cents ?? 0) / 100,
        estimado: !!m?.is_estimated,
        sem_escrow: !m || m.escrow_amount_cents == null,
      }
    })
  }

  const [txRows, { data: payoutRows }, { data: latestTx }, { data: dailyRows }, orderFeesList] = await Promise.all([
    fetchAllTransactions(),
    supabase
      .from('shopee_payouts')
      .select('*')
      .eq('connection_id', conn.id)
      .order('payout_time', { ascending: false })
      .limit(50),
    supabase
      .from('shopee_wallet_transactions')
      .select('current_balance_cents, create_time')
      .eq('connection_id', conn.id)
      .not('current_balance_cents', 'is', null)
      .order('create_time', { ascending: false })
      .limit(1),
    supabase
      .from('shopee_daily_metrics')
      .select('*')
      .eq('connection_id', conn.id)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true }),
    fetchOrderFeesList(),
  ])

  return (
    <FinanceiroView
      transactions={txRows}
      payouts={(payoutRows ?? []) as ShopeePayout[]}
      latestBalanceCents={
        latestTx && latestTx[0]?.current_balance_cents != null
          ? Number(latestTx[0].current_balance_cents)
          : null
      }
      dailyMetrics={(dailyRows ?? []) as ShopeeDailyMetric[]}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      typeFilter={typeFilter}
      nickname={conn.nickname}
      orderFeesList={orderFeesList}
    />
  )
}
