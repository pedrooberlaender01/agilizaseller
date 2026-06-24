import type { SupabaseClient } from '@supabase/supabase-js'
import type { DateRange } from './period'
import type { DeltaPair, UnifiedMetrics, ShopeeExtras, UnifiedDailyPoint } from './types'

const FAST_ESCROW = ['FAST_ESCROW_DEDUCT']

interface ShopeeRow {
  date: string
  gross_revenue: number | null
  orders_count: number | null
  orders_cancelled_count: number | null
  total_commission: number | null
  total_shipping_cost: number | null
  ads_spend_cents: number | null
  net_revenue_cents: number | null
  gross_profit: number | null
}

function sum(rows: ShopeeRow[], key: keyof ShopeeRow): number {
  return rows.reduce((a, r) => a + (Number(r[key]) || 0), 0)
}

function pair(cur: number, prev: number): DeltaPair {
  return { cur, prev }
}

export async function loadShopeeMetrics(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<UnifiedMetrics | null> {
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return null

  const curFromTs = `${range.current.from}T00:00:00`
  const curToTs = `${range.current.to}T23:59:59`
  const prevFromTs = `${range.previous.from}T00:00:00`
  const prevToTs = `${range.previous.to}T23:59:59`

  const cols = 'date,gross_revenue,orders_count,orders_cancelled_count,total_commission,total_shipping_cost,ads_spend_cents,net_revenue_cents,gross_profit'

  const [
    { data: curRows },
    { data: prevRows },
    { data: walletCur },
    { data: walletPrev },
    { data: affiliateCur },
    { data: affiliatePrev },
  ] = await Promise.all([
    supabase.from('shopee_daily_metrics').select(cols).eq('connection_id', conn.id).gte('date', range.current.from).lte('date', range.current.to).order('date', { ascending: true }),
    supabase.from('shopee_daily_metrics').select(cols).eq('connection_id', conn.id).gte('date', range.previous.from).lte('date', range.previous.to),
    supabase.from('shopee_wallet_transactions').select('transaction_type,amount_cents').eq('connection_id', conn.id).in('transaction_type', FAST_ESCROW).gte('create_time', curFromTs).lte('create_time', curToTs),
    supabase.from('shopee_wallet_transactions').select('transaction_type,amount_cents').eq('connection_id', conn.id).in('transaction_type', FAST_ESCROW).gte('create_time', prevFromTs).lte('create_time', prevToTs),
    // AMS get_affiliate_performance: snapshot Last30d (não daily). Pega snapshot mais recente.
    supabase.from('shopee_affiliate_performance')
      .select('commission_cents, period_end')
      .eq('connection_id', conn.id)
      .order('period_end', { ascending: false })
      .limit(500),
    supabase.from('shopee_affiliate_performance')
      .select('commission_cents, period_end')
      .eq('connection_id', conn.id)
      .order('period_end', { ascending: false })
      .limit(500)
      .lt('period_end', new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)),
  ])

  const cur = (curRows ?? []) as ShopeeRow[]
  const prev = (prevRows ?? []) as ShopeeRow[]

  const faturamentoCur = sum(cur, 'gross_revenue')
  const faturamentoPrev = sum(prev, 'gross_revenue')
  const pedidosCur = sum(cur, 'orders_count')
  const pedidosPrev = sum(prev, 'orders_count')
  const cancelCur = sum(cur, 'orders_cancelled_count')
  const cancelPrev = sum(prev, 'orders_cancelled_count')

  const ticketCur = pedidosCur > 0 ? faturamentoCur / pedidosCur : 0
  const ticketPrev = pedidosPrev > 0 ? faturamentoPrev / pedidosPrev : 0

  const adsCur = sum(cur, 'ads_spend_cents') / 100
  const adsPrev = sum(prev, 'ads_spend_cents') / 100
  const taxaCur = sum(cur, 'total_shipping_cost')
  const taxaPrev = sum(prev, 'total_shipping_cost')
  const comissaoCur = sum(cur, 'total_commission')
  const comissaoPrev = sum(prev, 'total_commission')

  const sumWalletAbs = (rows: { amount_cents: number | null }[] | null): number => {
    if (!rows) return 0
    return rows.reduce((a, r) => a + Math.abs(Number(r.amount_cents) || 0), 0) / 100
  }
  const antecipacoesCur = sumWalletAbs(walletCur as { amount_cents: number | null }[] | null)
  const antecipacoesPrev = sumWalletAbs(walletPrev as { amount_cents: number | null }[] | null)

  // Snapshot AMS = Last30d. Pega o mais recente period_end e soma todas commissions desse snapshot.
  const sumAffiliateLatestSnapshot = (rows: { commission_cents: number | null; period_end: string | null }[] | null): number => {
    if (!rows || rows.length === 0) return 0
    const latest = rows[0]?.period_end
    if (!latest) return 0
    return rows
      .filter(r => r.period_end === latest)
      .reduce((a, r) => a + (Number(r.commission_cents) || 0), 0) / 100
  }
  const afiliadosCur = sumAffiliateLatestSnapshot(affiliateCur as { commission_cents: number | null; period_end: string | null }[] | null)
  const afiliadosPrev = sumAffiliateLatestSnapshot(affiliatePrev as { commission_cents: number | null; period_end: string | null }[] | null)

  const netCur = cur.reduce((a, r) => a + (Number(r.net_revenue_cents) || 0), 0) / 100
  const netPrev = prev.reduce((a, r) => a + (Number(r.net_revenue_cents) || 0), 0) / 100
  const taxasShopeeCur = comissaoCur + taxaCur
  const taxasShopeePrev = comissaoPrev + taxaPrev
  const lucroBrutoCur = (netCur > 0 ? netCur : faturamentoCur - taxasShopeeCur) - adsCur
  const lucroBrutoPrev = (netPrev > 0 ? netPrev : faturamentoPrev - taxasShopeePrev) - adsPrev
  const margemCur = faturamentoCur > 0 ? (lucroBrutoCur / faturamentoCur) * 100 : 0
  const margemPrev = faturamentoPrev > 0 ? (lucroBrutoPrev / faturamentoPrev) * 100 : 0

  const daily: UnifiedDailyPoint[] = cur.map((r) => ({
    date: r.date,
    faturamento: Number(r.gross_revenue) || 0,
    pedidos: Number(r.orders_count) || 0,
    cancelamentos: Number(r.orders_cancelled_count) || 0,
    liquido: (Number(r.net_revenue_cents) || 0) / 100,
  }))

  const extras: ShopeeExtras = {
    type: 'shopee',
    lucroBrutoMacro: pair(lucroBrutoCur, lucroBrutoPrev),
    margemMacro: pair(margemCur, margemPrev),
  }

  return {
    canal: 'shopee',
    faturamento: pair(faturamentoCur, faturamentoPrev),
    pedidos: pair(pedidosCur, pedidosPrev),
    ticketMedio: pair(ticketCur, ticketPrev),
    cancelamentos: pair(cancelCur, cancelPrev),
    despesas: {
      ads: pair(adsCur, adsPrev),
      afiliados: pair(afiliadosCur, afiliadosPrev),
      taxa: pair(taxaCur, taxaPrev),
      comissao: pair(comissaoCur, comissaoPrev),
      antecipacoes: pair(antecipacoesCur, antecipacoesPrev),
    },
    daily,
    extras,
    nickname: conn.nickname,
  }
}
