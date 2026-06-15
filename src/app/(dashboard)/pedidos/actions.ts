'use server'

import { createClient } from '@/lib/supabase/server'

export type OrderDetailsResult =
  | { marketplace: 'magazord'; order: MagazordOrderDetail | null }
  | { marketplace: 'shein'; order: SheinOrderDetail | null }
  | { marketplace: 'shopee'; order: ShopeeOrderDetail | null }
  | { marketplace: 'mercado_livre'; order: MercadoLivreOrderDetail | null }
  | { marketplace: string; order: null }

export type MagazordOrderDetail = {
  id: string
  external_id: string | null
  codigo_marketplace: string | null
  marketplace_origem: string | null
  situacao: number | null
  situacao_descricao: string | null
  data_hora: string | null
  data_hora_ultima_alteracao: string | null
  data_hora_ultima_alteracao_situacao: string | null
  valor_total: number | string | null
  valor_frete: number | string | null
  valor_desconto: number | string | null
  forma_pagamento_descricao: string | null
  cpf_cnpj: string | null
  pessoa_nome: string | null
  uf: string | null
  cidade: string | null
  raw_payload: Record<string, unknown> | null
  mag_order_items: Array<{
    codigo_produto: string | null
    codigo_derivacao: string | null
    titulo: string | null
    quantidade: number | null
    valor_unitario: number | string | null
    valor_desconto: number | string | null
    valor_acrescimo: number | string | null
    brinde: boolean | null
    presente: boolean | null
  }>
  mag_order_payments: Array<{
    forma_pagamento_descricao: string | null
    valor: number | string | null
    parcelas: number | null
    status: string | null
    data_hora: string | null
  }>
  mag_order_tracking: Array<{
    codigo_rastreio: string | null
    link: string | null
    transportadora: string | null
    servico_transportadora: string | null
    status: string | null
    data_evento: string | null
    descricao: string | null
  }>
}

export type SheinOrderDetail = {
  id: string
  order_no: string | null
  store_code: string | null
  order_status: string | null
  payment_status: string | null
  shipping_status: string | null
  total_amount: number | string | null
  currency: string | null
  buyer_name: string | null
  buyer_email: string | null
  shipping_address: Record<string, unknown> | null
  order_time: string | null
  payment_time: string | null
  shein_order_items: Array<{
    sku_code: string | null
    product_name: string | null
    quantity: number | null
    unit_price: number | string | null
    total_price: number | string | null
    seller_price: number | string | null
    commission: number | string | null
    commission_rate: number | string | null
    service_charge: number | string | null
    estimated_income: number | string | null
  }>
}

export type ShopeeOrderDetail = {
  id: string
  external_id: string | null
  status: string | null
  status_detail: string | null
  total_amount: number | string | null
  currency: string | null
  buyer_username: string | null
  shipping_carrier: string | null
  payment_method: string | null
  estimated_shipping_fee: number | string | null
  actual_shipping_fee: number | string | null
  date_created: string | null
  raw_payload: Record<string, unknown> | null
  shopee_order_items: Array<{
    title: string | null
    model_sku: string | null
    seller_sku: string | null
    quantity: number | null
    unit_price: number | string | null
    discounted_price: number | string | null
  }>
  shopee_shipments: Array<{
    tracking_number: string | null
    logistics_status: string | null
    package_number: string | null
  }> | null
  shopee_order_margins: Array<{
    commission_fee: number | string | null
    cogs_total: number | string | null
    shipping_cost_seller: number | string | null
    packaging_total: number | string | null
    seller_tax_total: number | string | null
    gross_profit: number | string | null
    margin_pct: number | string | null
  }> | null
}

export type MercadoLivreOrderDetail = {
  id: string
  external_id: string | null
  pack_id: string | null
  status: string | null
  status_detail: string | null
  total_amount: number | string | null
  paid_amount: number | string | null
  currency_id: string | null
  buyer_nickname: string | null
  buyer_id: string | null
  coupon_amount: number | string | null
  taxes_amount: number | string | null
  tags: string[] | null
  date_created: string | null
  date_closed: string | null
  raw_payload: Record<string, unknown> | null
  ml_order_items: Array<{
    item_external_id: string | null
    seller_sku: string | null
    title: string | null
    category_id: string | null
    quantity: number | null
    unit_price: number | string | null
    full_unit_price: number | string | null
    sale_fee: number | string | null
  }>
  ml_shipments: Array<{
    tracking_number: string | null
    status: string | null
    substatus: string | null
    logistic_type: string | null
    cost_seller: number | string | null
    receiver_zip: string | null
    receiver_city: string | null
    receiver_state: string | null
    delivered_at: string | null
    estimated_delivery_limit: string | null
  }> | null
}

export async function getUnifiedOrderDetails(
  marketplace: string,
  orderId: string,
): Promise<OrderDetailsResult> {
  const supabase = await createClient()

  if (marketplace === 'magazord') {
    const { data } = await supabase
      .from('mag_orders')
      .select(`
        id, external_id, codigo_marketplace, marketplace_origem,
        situacao, situacao_descricao,
        data_hora, data_hora_ultima_alteracao, data_hora_ultima_alteracao_situacao,
        valor_total, valor_frete, valor_desconto,
        forma_pagamento_descricao, cpf_cnpj, pessoa_nome, uf, cidade, raw_payload,
        mag_order_items(codigo_produto, codigo_derivacao, titulo, quantidade, valor_unitario, valor_desconto, valor_acrescimo, brinde, presente),
        mag_order_payments(forma_pagamento_descricao, valor, parcelas, status, data_hora),
        mag_order_tracking(codigo_rastreio, link, transportadora, servico_transportadora, status, data_evento, descricao)
      `)
      .eq('id', orderId)
      .maybeSingle()
    return { marketplace: 'magazord', order: (data ?? null) as MagazordOrderDetail | null }
  }

  if (marketplace === 'shein') {
    const { data } = await supabase
      .from('shein_orders')
      .select(`
        id, order_no, store_code, order_status, payment_status, shipping_status,
        total_amount, currency, buyer_name, buyer_email, shipping_address,
        order_time, payment_time,
        shein_order_items(sku_code, product_name, quantity, unit_price, total_price, seller_price, commission, commission_rate, service_charge, estimated_income)
      `)
      .eq('id', orderId)
      .maybeSingle()
    return { marketplace: 'shein', order: (data ?? null) as SheinOrderDetail | null }
  }

  if (marketplace === 'shopee') {
    const { data } = await supabase
      .from('shopee_orders')
      .select(`
        id, external_id, status, status_detail, total_amount, currency,
        buyer_username, shipping_carrier, payment_method,
        estimated_shipping_fee, actual_shipping_fee, date_created, raw_payload,
        shopee_order_items(title, model_sku, seller_sku, quantity, unit_price, discounted_price),
        shopee_shipments(tracking_number, logistics_status, package_number),
        shopee_order_margins(commission_fee, cogs_total, shipping_cost_seller, packaging_total, seller_tax_total, gross_profit, margin_pct)
      `)
      .eq('id', orderId)
      .maybeSingle()
    return { marketplace: 'shopee', order: (data ?? null) as ShopeeOrderDetail | null }
  }

  if (marketplace === 'mercado_livre') {
    const { data } = await supabase
      .from('ml_orders')
      .select(`
        id, external_id, pack_id, status, status_detail,
        total_amount, paid_amount, currency_id,
        buyer_nickname, buyer_id, coupon_amount, taxes_amount, tags,
        date_created, date_closed, raw_payload,
        ml_order_items(item_external_id, seller_sku, title, category_id, quantity, unit_price, full_unit_price, sale_fee),
        ml_shipments(tracking_number, status, substatus, logistic_type, cost_seller, receiver_zip, receiver_city, receiver_state, delivered_at, estimated_delivery_limit)
      `)
      .eq('id', orderId)
      .maybeSingle()
    return { marketplace: 'mercado_livre', order: (data ?? null) as MercadoLivreOrderDetail | null }
  }

  return { marketplace, order: null }
}
