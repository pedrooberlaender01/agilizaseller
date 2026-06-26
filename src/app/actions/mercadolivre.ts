'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  MlOrder,
  MlOrderItem,
  MlOrderStatus,
  MlShipment,
  MlShipmentHistory,
  OrderMargin,
} from '@/types'

const ML_MARKETPLACE = 'mercado_livre'

/** Resolve a conexão Mercado Livre ativa (igual ao padrão Shopee). */
async function resolveConnectionId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', ML_MARKETPLACE)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export type FullMlOrder = {
  id: string
  external_id: string
  status: MlOrderStatus
  date_created: string
  total_amount: number
  paid_amount: number
  buyer_nickname: string | null
  coupon_amount: number
  taxes_amount: number
  raw_payload: unknown
  ml_order_items: MlOrderItem[]
  order_margins: OrderMargin[]
  ml_shipments: MlShipment[]
}

/** Detalhe completo do pedido para o drawer (mirror de getShopeeOrderDetails). */
export async function getMercadoLivreOrderDetails(orderId: string): Promise<FullMlOrder | null> {
  const supabase = await createClient()
  try {
    const { data } = await supabase
      .from('ml_orders')
      .select('*, ml_order_items(*), order_margins(*), ml_shipments(*)')
      .eq('id', orderId)
      .maybeSingle()
    return (data as FullMlOrder | null) ?? null
  } catch {
    return null
  }
}

export type MlOrderFilters = {
  period: '7d' | '30d' | '90d'
  statuses: MlOrderStatus[]
  search: string
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'Pago',
  confirmed: 'Confirmado',
  payment_required: 'Aguardando pagamento',
  in_process: 'Em processo',
  partially_refunded: 'Parcial. reembolsado',
  cancelled: 'Cancelado',
}

function periodCutoffIso(period: MlOrderFilters['period']): string {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export async function exportMercadoLivreOrdersCsv(
  filters: MlOrderFilters,
): Promise<{ csv: string; filename: string }> {
  const supabase = await createClient()
  const connId = await resolveConnectionId(supabase)
  if (!connId) return { csv: '', filename: 'mercado-livre-pedidos-vazio.csv' }

  let query = supabase
    .from('ml_orders')
    .select(
      '*, ml_order_items(count), order_margins(gross_profit, margin_pct, cost_missing), ml_shipments(status)',
    )
    .eq('connection_id', connId)
    .gte('date_created', periodCutoffIso(filters.period))

  if (filters.statuses.length > 0) query = query.in('status', filters.statuses)
  if (filters.search) {
    const term = filters.search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,buyer_nickname.ilike.%${term}%`)
  }

  const { data } = await query.order('date_created', { ascending: false }).limit(5000)
  const rows = (data ?? []) as Array<
    MlOrder & {
      ml_order_items: { count: number }[]
      order_margins: Pick<OrderMargin, 'gross_profit' | 'margin_pct' | 'cost_missing'>[]
      ml_shipments: Pick<MlShipment, 'status'>[]
    }
  >

  const headers = ['ID', 'Comprador', 'Itens', 'Total', 'Lucro', 'Margem', 'Status', 'Envio', 'Data']
  const csvRows = rows.map((o) => {
    const margin = o.order_margins?.[0]
    const ship = o.ml_shipments?.[0]
    return [
      o.external_id,
      o.buyer_nickname ?? '',
      String(o.ml_order_items?.[0]?.count ?? 0),
      Number(o.total_amount).toFixed(2).replace('.', ','),
      margin && !margin.cost_missing ? Number(margin.gross_profit).toFixed(2).replace('.', ',') : '',
      margin?.margin_pct != null && !margin.cost_missing
        ? Number(margin.margin_pct).toFixed(1).replace('.', ',')
        : '',
      STATUS_LABEL[o.status] ?? o.status,
      ship?.status ?? '',
      new Date(o.date_created).toLocaleString('pt-BR'),
    ]
  })

  const csv = [headers, ...csvRows]
    .map((r) => r.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';'))
    .join('\n')

  const filename = `mercado-livre-pedidos-${new Date().toISOString().slice(0, 10)}.csv`
  return { csv: '﻿' + csv, filename }
}

/** Histórico de rastreio do envio (tabela pode estar vazia — trata graciosamente). */
export async function getMlShipmentHistory(shipmentId: string): Promise<MlShipmentHistory[]> {
  const supabase = await createClient()
  try {
    const { data } = await supabase
      .from('ml_shipment_history')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('event_date', { ascending: false })
    return (data ?? []) as MlShipmentHistory[]
  } catch {
    return []
  }
}
