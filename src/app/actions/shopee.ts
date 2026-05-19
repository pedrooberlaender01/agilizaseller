'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ShopeeOrder,
  ShopeeOrderItem,
  ShopeeOrderMargin,
  ShopeeOrderStatus,
  ShopeeShipment,
  ShopeeShipmentHistory,
} from '@/types'

export type SaveCostState = { ok: boolean; error?: string } | null

export async function saveProductCost(
  sku: string,
  costUnit: number,
  packagingCost: number,
  taxRate: number,
): Promise<SaveCostState> {
  if (!sku) return { ok: false, error: 'SKU vazio' }
  if (![costUnit, packagingCost, taxRate].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ok: false, error: 'Valores inválidos' }
  }

  const supabase = await createClient()

  let { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('seller_sku', sku)
    .maybeSingle()

  if (!product) {
    const { data: created, error } = await supabase
      .from('products')
      .insert({ seller_sku: sku })
      .select('id')
      .single()
    if (error || !created) return { ok: false, error: error?.message ?? 'Falha ao criar produto' }
    product = created
  }

  const nowIso = new Date().toISOString()

  const { error: closeErr } = await supabase
    .from('product_costs')
    .update({ valid_to: nowIso })
    .eq('product_id', product.id)
    .is('valid_to', null)
  if (closeErr) return { ok: false, error: closeErr.message }

  const { error: insertErr } = await supabase
    .from('product_costs')
    .insert({
      product_id: product.id,
      cost_unit: costUnit,
      packaging_cost: packagingCost,
      tax_rate: taxRate,
      valid_from: nowIso,
    })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/shopee/anuncios')
  return { ok: true }
}

export type FullShopeeOrder = ShopeeOrder & {
  shopee_order_items: ShopeeOrderItem[]
  shopee_order_margins: ShopeeOrderMargin[]
  shopee_shipments: ShopeeShipment[]
  raw_payload: unknown
}

export async function getShopeeOrderDetails(orderId: string): Promise<FullShopeeOrder | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shopee_orders')
    .select('*, shopee_order_items(*), shopee_order_margins(*), shopee_shipments(*)')
    .eq('id', orderId)
    .maybeSingle()
  return (data as FullShopeeOrder | null) ?? null
}

export type OrderFilters = {
  period: '7d' | '30d' | '90d'
  statuses: ShopeeOrderStatus[]
  search: string
}

const STATUS_LABEL: Record<ShopeeOrderStatus, string> = {
  UNPAID: 'Aguardando pagamento',
  READY_TO_SHIP: 'Pronto para envio',
  PROCESSED: 'Processado',
  SHIPPED: 'Enviado',
  TO_CONFIRM_RECEIVE: 'Confirmar recebimento',
  COMPLETED: 'Concluído',
  IN_CANCEL: 'Em cancelamento',
  CANCELLED: 'Cancelado',
  INVOICE_PENDING: 'NF pendente',
}

function periodCutoffIso(period: OrderFilters['period']): string {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export async function exportShopeeOrdersCsv(filters: OrderFilters): Promise<{ csv: string; filename: string }> {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return { csv: '', filename: 'shopee-pedidos-vazio.csv' }

  let query = supabase
    .from('shopee_orders')
    .select(
      '*, shopee_order_items(count), shopee_order_margins(gross_profit, margin_pct, cost_missing), shopee_shipments(logistics_status)',
    )
    .eq('connection_id', conn.id)
    .gte('date_created', periodCutoffIso(filters.period))

  if (filters.statuses.length > 0) query = query.in('status', filters.statuses)
  if (filters.search) {
    const term = filters.search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,buyer_username.ilike.%${term}%`)
  }

  const { data } = await query.order('date_created', { ascending: false }).limit(5000)
  const rows = (data ?? []) as Array<
    ShopeeOrder & {
      shopee_order_items: { count: number }[]
      shopee_order_margins: Pick<ShopeeOrderMargin, 'gross_profit' | 'margin_pct' | 'cost_missing'>[]
      shopee_shipments: Pick<ShopeeShipment, 'logistics_status'>[]
    }
  >

  const headers = ['ID', 'Comprador', 'Itens', 'Total', 'Lucro', 'Margem', 'Status', 'Envio', 'Data']
  const csvRows = rows.map((o) => {
    const margin = o.shopee_order_margins[0]
    const ship = o.shopee_shipments[0]
    return [
      o.external_id,
      o.buyer_username ?? '',
      String(o.shopee_order_items[0]?.count ?? 0),
      o.total_amount.toFixed(2).replace('.', ','),
      margin && !margin.cost_missing ? margin.gross_profit.toFixed(2).replace('.', ',') : '',
      margin?.margin_pct != null && !margin.cost_missing ? margin.margin_pct.toFixed(1).replace('.', ',') : '',
      STATUS_LABEL[o.status as ShopeeOrderStatus] ?? o.status,
      ship?.logistics_status ?? '',
      new Date(o.date_created).toLocaleString('pt-BR'),
    ]
  })

  const csv = [headers, ...csvRows]
    .map((r) => r.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';'))
    .join('\n')

  const filename = `shopee-pedidos-${new Date().toISOString().slice(0, 10)}.csv`
  return { csv: '﻿' + csv, filename }
}

export async function getShipmentHistory(shipmentId: string): Promise<ShopeeShipmentHistory[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shopee_shipment_history')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('event_date', { ascending: false })
  return (data ?? []) as ShopeeShipmentHistory[]
}
