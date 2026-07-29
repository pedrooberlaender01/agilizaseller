export type Marketplace = 'mercado-livre' | 'shopee' | 'tiktok'

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type ReputationLevel = 'platinum' | 'gold' | 'silver' | 'bronze' | 'green' | 'red'

export interface Tenant {
  id: string
  name: string
  slug: string
}

export interface DailyMetric {
  id: string
  date: string
  connection_id: string
  orders_count: number
  orders_cancelled_count: number
  gross_revenue: number
  total_fees: number
  total_shipping_cost: number
  total_taxes: number
  total_cogs: number
  gross_profit: number
  avg_margin_pct: number | null
  items_with_cost_missing: number
  calculated_at: string
}

export interface Alert {
  id: string
  connection_id: string | null
  type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string | null
  is_read: boolean
  is_resolved: boolean
  triggered_at: string
  resolved_at: string | null
  resource_type: string | null
  resource_id: string | null
}

export interface AccountHealth {
  id: string
  connection_id: string
  snapshot_at: string
  level_id: string | null
  power_seller_status: string | null
  transactions_total: number | null
  transactions_completed: number | null
  transactions_canceled: number | null
  claims_rate: number | null
  delayed_handling_rate: number | null
  cancellations_rate: number | null
}

export interface MarketplaceConnection {
  id: string
  marketplace: 'mercado_livre' | 'shopee' | 'tiktok_shop' | 'shein' | 'magazord'
  external_user_id: string
  nickname: string | null
  status: 'active' | 'expired' | 'disconnected' | 'error'
  connected_at: string
  updated_at: string | null
}

export interface SyncLog {
  id: string
  connection_id: string | null
  workflow: string
  status: 'running' | 'success' | 'error' | 'partial'
  started_at: string
  finished_at: string | null
  records_processed: number | null
  records_failed: number | null
  error_message: string | null
}

export interface MlOauthToken {
  id: string
  connection_id: string
  expires_at: string | null
  updated_at: string | null
}

export interface OrderMargin {
  id: string
  order_id: string
  gross_revenue: number
  gross_profit: number
  sale_fee: number
  shipping_cost_seller: number
  taxes_retained: number
  cogs_total: number
  margin_pct: number | null
  cost_missing: boolean
  calculated_at: string
}

export type MlOrderStatus =
  | 'paid'
  | 'cancelled'
  | 'confirmed'
  | 'payment_required'
  | 'in_process'
  | 'partially_refunded'

export interface MlOrderItem {
  id: string
  order_id: string
  item_external_id: string
  seller_sku: string | null
  title: string | null
  quantity: number
  unit_price: number
  full_unit_price: number
  sale_fee: number
}

export interface MlShipment {
  id: string
  order_id: string
  status: string | null
  tracking_number: string | null
  estimated_delivery_limit: string | null
  delivered_at: string | null
  receiver_city: string | null
  receiver_state: string | null
  receiver_zip: string | null
  cost_seller: number | null
  cost_buyer: number | null
  logistic_type: string | null
  mode: string | null
  is_tracking_available: boolean
  created_at: string
}

export interface MlShipmentFull extends MlShipment {
  ml_orders: { buyer_nickname: string | null; date_created: string; total_amount: number } | null
}

export interface MlShipmentHistory {
  id: string
  shipment_id: string
  status: string | null
  substatus: string | null
  event_date: string
  tracking_message: string | null
}

export interface ProductCost {
  id: string
  product_id: string
  cost_unit: number
  packaging_cost: number
  tax_rate: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  seller_sku: string | null
  title: string | null
  thumbnail: string | null
  is_kit: boolean
  product_costs: Pick<ProductCost, 'id' | 'cost_unit' | 'packaging_cost' | 'tax_rate'>[]
}

export interface MlItem {
  id: string
  connection_id: string
  external_id: string
  seller_sku: string | null
  title: string | null
  category_id: string | null
  price: number
  available_quantity: number
  sold_quantity: number
  listing_type_id: string | null
  status: string
  permalink: string | null
  thumbnail: string | null
  synced_at: string | null
  product_ml_items: {
    product_id: string
    products: Product | null
  }[]
}

export interface MlOrder {
  id: string
  connection_id: string
  external_id: string
  status: MlOrderStatus
  date_created: string
  total_amount: number
  paid_amount: number
  buyer_nickname: string | null
  coupon_amount: number
  taxes_amount: number
  // joined relations
  ml_order_items: { count: number }[]
  order_margins: Pick<OrderMargin, 'gross_profit' | 'margin_pct' | 'sale_fee' | 'shipping_cost_seller' | 'taxes_retained' | 'cogs_total' | 'cost_missing'>[]
  ml_shipments: Pick<MlShipment, 'status' | 'tracking_number' | 'estimated_delivery_limit' | 'receiver_city' | 'receiver_state'>[]
}

export interface ShopeeDailyMetric {
  id: string
  date: string
  connection_id: string
  orders_count: number
  orders_cancelled_count: number
  gross_revenue: number
  total_commission: number
  total_shipping_cost: number
  total_cogs: number
  gross_profit: number
  avg_margin_pct: number | null
  items_with_cost_missing: number
  calculated_at: string
  ads_spend_cents: number | null
  ads_impressions: number | null
  ads_clicks: number | null
  ads_gmv_cents: number | null
  ads_orders: number | null
  net_revenue_cents: number | null
  roas: number | null
  acos: number | null
  total_commission_fee: number | null
  total_service_fee: number | null
  total_commission_net: number | null
  total_service_fee_net: number | null
  total_product_sales: number | null
  orders_count_incl_cancel: number | null
  gross_revenue_incl_cancel: number | null
  orders_count_all: number | null
  gross_revenue_all: number | null
}

export interface ShopeeAdsBalance {
  id: number
  connection_id: string
  snapshot_at: string
  total_balance_cents: number
  free_credit_cents: number | null
  paid_credit_cents: number | null
  raw: unknown
  created_at: string
}

export interface ShopeeAdsCampaign {
  id: number
  connection_id: string
  campaign_id: string
  ad_type: string | null
  campaign_status: string | null
  campaign_name: string | null
  campaign_budget_cents: number | null
  daily_budget_cents: number | null
  bidding_method: string | null
  item_id: number | null
  start_date: string | null
  end_date: string | null
  synced_at: string
  created_at: string
  updated_at: string
}

export interface ShopeeAdsCampaignDailyPerformance {
  id: number
  connection_id: string
  campaign_id: string
  ad_type: 'manual' | 'auto' | 'all_cpc' | string
  date: string
  impressions: number | null
  clicks: number | null
  ctr: number | null
  expense_cents: number | null
  broad_gmv_cents: number | null
  broad_order_count: number | null
  broad_order_amount_cents: number | null
  direct_gmv_cents: number | null
  direct_order_count: number | null
  direct_order_amount_cents: number | null
  checkout_count: number | null
  cpc_cents: number | null
  roas: number | null
  acos: number | null
  cr: number | null
  direct_conversion_rate: number | null
  broad_conversion_rate: number | null
  cost_per_conversion_cents: number | null
  synced_at: string
}

export interface ShopeeWalletTransaction {
  id: number
  connection_id: string
  transaction_id: string
  transaction_type: string | null
  status: string | null
  amount_cents: number
  current_balance_cents: number | null
  create_time: string
  order_sn: string | null
  refund_sn: string | null
  reason: string | null
  wallet_type: string | null
  raw: unknown
  synced_at: string
}

export interface ShopeePayout {
  id: number
  connection_id: string
  payout_id: string
  payout_amount_cents: number
  payout_time: string
  payout_period_start: string | null
  payout_period_end: string | null
  bank_account_masked: string | null
  currency: string | null
  status: string | null
  total_orders: number | null
  synced_at: string
}

export type ShopeeOrderStatus =
  | 'UNPAID' | 'READY_TO_SHIP' | 'PROCESSED' | 'SHIPPED'
  | 'TO_CONFIRM_RECEIVE' | 'COMPLETED' | 'IN_CANCEL'
  | 'CANCELLED' | 'INVOICE_PENDING'

export interface ShopeeItem {
  id: string
  connection_id: string
  external_id: string
  item_sku: string | null
  title: string
  category_id: string | null
  price: number | null
  stock: number | null
  sold_quantity: number | null
  item_status: string | null
  has_model: boolean
  raw_payload: any
  synced_at: string | null
}

export interface ShopeeOrder {
  id: string
  connection_id: string
  external_id: string
  status: ShopeeOrderStatus
  date_created: string
  total_amount: number
  buyer_username: string | null
  payment_method: string | null
  shipping_carrier: string | null
  estimated_shipping_fee: number
  actual_shipping_fee: number
}

export interface ShopeeOrderMargin {
  id: string
  order_id: string
  gross_revenue: number
  commission_fee: number
  shipping_cost_seller: number
  cogs_total: number
  packaging_total: number
  seller_tax_total: number
  gross_profit: number
  margin_pct: number | null
  roi_pct: number | null
  cost_missing: boolean
  is_estimated: boolean
  commission_fee_real_cents: number | null
  service_fee_real_cents: number | null
  transaction_fee_real_cents: number | null
  actual_shipping_fee_cents: number | null
  shopee_shipping_rebate_cents: number | null
  seller_voucher_cents: number | null
  buyer_paid_amount_cents: number | null
  escrow_amount_cents: number | null
  net_amount_real_cents: number | null
  escrow_synced_at: string | null
}

export interface ShopeeOrderItem {
  id: string
  order_id: string
  item_external_id: string | null
  model_id: string | null
  model_sku: string | null
  seller_sku: string | null
  title: string
  quantity: number
  unit_price: number
  discounted_price: number | null
}

export interface ShopeeShipment {
  id: string
  connection_id: string
  order_id: string
  order_sn: string
  logistics_status: string
  tracking_number: string | null
  shipping_carrier: string | null
  estimated_delivery: string | null
  delivered_at: string | null
  receiver_name: string | null
  receiver_city: string | null
  receiver_state: string | null
  receiver_zip: string | null
  cost_seller: number | null
  raw_payload: unknown
  synced_at: string | null
  created_at: string | null
}

export interface ShopeeShipmentHistory {
  id: string
  shipment_id: string
  logistics_status: string
  event_date: string
  description: string | null
  raw_payload: unknown
}

export interface ShopeeAccountHealth {
  id: string
  connection_id: string
  snapshot_at: string
  overall_performance_rating: string | null
  penalty_points: number
  listing_violation_count: number
  ongoing_punishment: any
  perf_raw_payload?: any
  penalty_raw_payload?: any
}

export interface ShopeeReturnItem {
  item_id?: number | string
  model_id?: number | string
  name?: string
  amount?: number
  item_price?: number
  refund_amount?: number
  sku?: string
}

export interface ShopeeReturn {
  id: string
  connection_id: string
  return_sn: string
  order_sn: string | null
  return_status: string | null
  reason: string | null
  text_reason: string | null
  return_solution: string | null
  refund_amount_cents: number
  currency: string | null
  buyer_username: string | null
  dispute_reason: string | null
  dispute_status: string | null
  evidence_urls: string[]
  item_list: ShopeeReturnItem[]
  tracking_number: string | null
  shipping_carrier: string | null
  needs_response_due_date: string | null
  due_date: string | null
  create_time: string | null
  update_time: string | null
  raw: unknown
  detail_raw: unknown
  detail_synced_at: string | null
  seller_proof_status: string | null
  seller_compensation_status: string | null
  negotiation: {
    counter_limit?: number | null
    offer_due_date?: number | null
    latest_solution?: string | null
    negotiation_status?: string | null
    latest_offer_amount?: number | null
    latest_offer_creator?: string | null
  } | null
  activity_history: unknown
  synced_at: string
  created_at: string
  updated_at: string
}
