import type { SupabaseClient } from '@supabase/supabase-js'
import type { DateRange } from './period'
import type { DeltaPair, UnifiedMetrics, SheinExtras, UnifiedDailyPoint } from './types'

interface SheinDailyRow {
  metric_date: string
  orders_count: number | null
  gross_revenue: number | string | null
  net_revenue: number | string | null
  items_sold: number | null
  cancellations: number | null
}

interface SheinMarginRow {
  quantity: number | null
  seller_price: number | string | null
  estimated_income: number | string | null
  total_cost: number | string | null
  real_profit: number | string | null
  cost_price: number | string | null
  commission: number | string | null
  service_charge: number | string | null
  order_time: string
}

function pair(cur: number, prev: number): DeltaPair {
  return { cur, prev }
}

function sumDaily(rows: SheinDailyRow[]): { fat: number; pedidos: number; cancel: number; net: number } {
  return rows.reduce(
    (a, r) => ({
      fat: a.fat + Number(r.gross_revenue ?? 0),
      pedidos: a.pedidos + (Number(r.orders_count) || 0),
      cancel: a.cancel + (Number(r.cancellations) || 0),
      net: a.net + Number(r.net_revenue ?? 0),
    }),
    { fat: 0, pedidos: 0, cancel: 0, net: 0 },
  )
}

function sumMargins(rows: SheinMarginRow[]) {
  return rows.reduce(
    (acc, r) => {
      const qty = Number(r.quantity ?? 0)
      acc.commission += Number(r.commission ?? 0)
      acc.service += Number(r.service_charge ?? 0)
      if (r.cost_price !== null && r.cost_price !== undefined) {
        const gross = qty * Number(r.seller_price ?? 0)
        acc.coveredGross += gross
        acc.coveredCost += Number(r.total_cost ?? 0)
        acc.coveredProfit += Number(r.real_profit ?? 0)
        acc.coveredUnits += qty
      } else {
        acc.uncoveredUnits += qty
      }
      acc.totalGross += qty * Number(r.seller_price ?? 0)
      return acc
    },
    {
      commission: 0,
      service: 0,
      coveredGross: 0,
      coveredCost: 0,
      coveredProfit: 0,
      coveredUnits: 0,
      uncoveredUnits: 0,
      totalGross: 0,
    },
  )
}

export async function loadSheinMetrics(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<UnifiedMetrics | null> {
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return null

  const curCutoff = `${range.current.from}T00:00:00`
  const prevCutoff = `${range.previous.from}T00:00:00`

  const [curRpc, prevRpc, marginCur, marginPrev] = await Promise.all([
    supabase.rpc('shein_metrics_realtime', { p_connection_id: conn.id, p_cutoff: curCutoff }),
    supabase.rpc('shein_metrics_realtime', { p_connection_id: conn.id, p_cutoff: prevCutoff }),
    supabase
      .from('shein_margins_enriched')
      .select('quantity,seller_price,estimated_income,total_cost,real_profit,cost_price,commission,service_charge,order_time')
      .eq('connection_id', conn.id)
      .gte('order_time', curCutoff)
      .lte('order_time', `${range.current.to}T23:59:59`),
    supabase
      .from('shein_margins_enriched')
      .select('quantity,seller_price,estimated_income,total_cost,real_profit,cost_price,commission,service_charge,order_time')
      .eq('connection_id', conn.id)
      .gte('order_time', prevCutoff)
      .lte('order_time', `${range.previous.to}T23:59:59`),
  ])

  const curDaily = (curRpc.data ?? []) as SheinDailyRow[]
  const prevDaily = (prevRpc.data ?? []) as SheinDailyRow[]
  const curRange = curDaily.filter((r) => r.metric_date >= range.current.from && r.metric_date <= range.current.to)
  const prevRange = prevDaily.filter((r) => r.metric_date >= range.previous.from && r.metric_date <= range.previous.to)

  const curT = sumDaily(curRange)
  const prevT = sumDaily(prevRange)

  const ticketCur = curT.pedidos > 0 ? curT.fat / curT.pedidos : 0
  const ticketPrev = prevT.pedidos > 0 ? prevT.fat / prevT.pedidos : 0

  const mCur = sumMargins((marginCur.data ?? []) as SheinMarginRow[])
  const mPrev = sumMargins((marginPrev.data ?? []) as SheinMarginRow[])

  const taxaCur = mCur.service
  const taxaPrev = mPrev.service
  const comissaoCur = mCur.commission
  const comissaoPrev = mPrev.commission

  const margemRealPct = mCur.coveredGross > 0 ? (mCur.coveredProfit / mCur.coveredGross) * 100 : 0
  const cobertaPct = mCur.totalGross > 0 ? (mCur.coveredGross / mCur.totalGross) * 100 : 0

  const daily: UnifiedDailyPoint[] = curRange.map((r) => ({
    date: r.metric_date,
    faturamento: Number(r.gross_revenue ?? 0),
    pedidos: Number(r.orders_count) || 0,
    cancelamentos: Number(r.cancellations) || 0,
    liquido: Number(r.net_revenue ?? 0),
  }))

  const extras: SheinExtras = {
    type: 'shein',
    lucroReal: mCur.coveredProfit,
    margemRealPct,
    custoTotal: mCur.coveredCost,
    cobertaPct,
    unidadesCobertas: mCur.coveredUnits,
    unidadesSemCusto: mCur.uncoveredUnits,
  }

  return {
    canal: 'shein',
    faturamento: pair(curT.fat, prevT.fat),
    pedidos: pair(curT.pedidos, prevT.pedidos),
    ticketMedio: pair(ticketCur, ticketPrev),
    cancelamentos: pair(curT.cancel, prevT.cancel),
    despesas: {
      taxa: pair(taxaCur, taxaPrev),
      comissao: pair(comissaoCur, comissaoPrev),
    },
    daily,
    extras,
    nickname: conn.nickname,
  }
}
