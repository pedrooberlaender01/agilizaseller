import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { fmtBrl, fmtNum } from '../../_ui'
import { cn } from '@/lib/utils'

export const revalidate = 60

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'
const toneClasses: Record<Tone, string> = {
  yellow: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',
  blue: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray: 'bg-outline/20 text-zinc-500 border border-outline/30',
}
function statusTone(s: string | null): Tone {
  if (!s) return 'gray'
  const v = s.toUpperCase()
  if (v.includes('CANCEL')) return 'red'
  if (v === 'DELIVERED' || v === 'COMPLETED') return 'green'
  if (v.includes('TRANSIT') || v.includes('COLLECTION')) return 'blue'
  if (v.includes('AWAITING') || v === 'ON_HOLD' || v === 'UNPAID') return 'yellow'
  return 'gray'
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function fmtEpoch(v: unknown): string {
  const n = Number(v)
  if (!n || Number.isNaN(n)) return '—'
  return fmtDateTime(new Date(n * 1000).toISOString())
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' | 'default' }) {
  const color = tone === 'red' ? 'text-error' : tone === 'green' ? 'text-secondary' : 'text-zinc-100'
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={cn('font-medium tabular-nums', color)}>{value}</span>
    </div>
  )
}

export default async function TiktokPedidoDetalhePage({
  params,
}: {
  params: Promise<{ order_id: string }>
}) {
  const { order_id } = await params
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'tiktok_shop')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) notFound()

  const [orderRes, itemsRes, feesRes] = await Promise.all([
    supabase.from('tt_orders').select('*').eq('connection_id', conn.id).eq('order_id', order_id).maybeSingle(),
    supabase.from('tt_order_items').select('*').eq('tt_order_id', order_id),
    supabase.from('tt_order_fees').select('*').eq('connection_id', conn.id).eq('order_id', order_id).maybeSingle(),
  ])

  const order = orderRes.data as {
    order_id: string; order_status: string | null; total_amount: number | string | null
    currency: string | null; buyer_name: string | null; create_time: string | null
    paid_time: string | null; update_time: string | null
    shipping_address: Record<string, unknown> | null
    raw: Record<string, unknown> | null
  } | null

  if (!order) notFound()

  const items = (itemsRes.data ?? []) as Array<{
    sku_id: string | null; seller_sku: string | null; product_name: string | null
    quantity: number | null; unit_price: number | string | null
  }>
  const fees = feesRes.data as {
    settlement_amount: number | string | null; revenue_amount: number | string | null
    shipping_cost_amount: number | string | null; affiliate_commission: number | string | null
    platform_commission: number | string | null; sfp_service_fee: number | string | null
    fee_per_item: number | string | null
  } | null

  const raw = (order.raw ?? {}) as Record<string, unknown>
  const addr = (order.shipping_address ?? {}) as Record<string, unknown>
  const cur = order.currency ?? 'BRL'
  // No detalhe do pedido o painel agrega afiliado dentro de "Taxas e impostos"
  // (diferente da Estrutura de despesas, que separa afiliado numa linha propria).
  const taxasTotal = fees
    ? Number(fees.platform_commission ?? 0) + Number(fees.sfp_service_fee ?? 0)
      + Number(fees.fee_per_item ?? 0) + Number(fees.affiliate_commission ?? 0)
    : 0
  const cancelado = (order.order_status ?? '').toUpperCase() === 'CANCELLED'
  // Pedido devolvido: tt_order_fees guarda o liquido (venda + estorno no mesmo registro).
  const devolvido = !!fees && Number(fees.revenue_amount ?? 0) === 0 && Number(fees.settlement_amount ?? 0) < 0

  return (
    <>
      <TopBar title={`Pedido ${order_id} — TikTok Shop`} />
      <main className="overflow-y-auto p-margin">
        <Link
          href="/tiktok/pedidos"
          className="mb-lg inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Voltar para Pedidos
        </Link>

        {/* Header */}
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-lg">
          <div>
            <p className="font-mono text-xs text-zinc-500">{order.order_id}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{fmtBrl(order.total_amount, cur)}</p>
            <p className="mt-1 text-xs text-slate-400">Criado {fmtDateTime(order.create_time)}</p>
          </div>
          <span className={cn('inline-flex rounded px-3 py-1 text-xs font-medium', toneClasses[statusTone(order.order_status)])}>
            {order.order_status ?? '—'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Financeiro por pedido */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Financeiro</h3>
              <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">
                {fees ? 'Detalhamento da liquidação' : 'Aguardando liquidação'}
              </p>
            </div>
            <div className="flex flex-col divide-y divide-zinc-800/60 p-lg">
              {fees ? (
                <>
                  {devolvido && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      <span>
                        Pedido devolvido — os valores abaixo são o líquido da venda somada ao estorno.
                      </span>
                    </div>
                  )}
                  <Row label="Receita" value={fmtBrl(fees.revenue_amount, cur)} tone="green" />
                  <Row label="Comissão da plataforma" value={fmtBrl(fees.platform_commission, cur)} tone="red" />
                  <Row label="Taxa de serviço (SFP)" value={fmtBrl(fees.sfp_service_fee, cur)} tone="red" />
                  <Row label="Taxa por item" value={fmtBrl(fees.fee_per_item, cur)} tone="red" />
                  <Row label="Comissão de afiliado" value={fmtBrl(fees.affiliate_commission, cur)} tone="red" />
                  <Row label="Taxas e impostos" value={fmtBrl(taxasTotal, cur)} tone="red" />
                  <Row label="Frete (líquido)" value={fmtBrl(fees.shipping_cost_amount, cur)} tone="red" />
                  <div className="pt-2">
                    <Row label="Valor liquidado" value={fmtBrl(fees.settlement_amount, cur)} tone="green" />
                  </div>
                </>
              ) : (
                <p className="py-4 text-sm text-zinc-500">
                  Este pedido ainda não foi liquidado pelo TikTok (leva cerca de 7 a 15 dias após o pagamento).
                </p>
              )}
            </div>
          </div>

          {/* Entrega */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Entrega</h3>
              <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">Rastreio e prazos</p>
            </div>
            <div className="flex flex-col divide-y divide-zinc-800/60 p-lg">
              <Row label="Rastreio" value={String(raw.tracking_number ?? '—')} />
              <Row label="Transportadora" value={String(raw.shipping_provider ?? '—')} />
              <Row label="Modalidade" value={String(raw.delivery_option_name ?? '—')} />
              <Row label="Pago em" value={fmtDateTime(order.paid_time)} />
              <Row label="Pronto para envio" value={fmtEpoch(raw.rts_time)} />
              <Row label="Enviar até (prazo)" value={fmtEpoch(raw.rts_sla_time)} />
              <Row label="Coletado em" value={fmtEpoch(raw.collection_time)} />
              <Row label="Entregue em" value={fmtEpoch(raw.delivery_time)} />
            </div>
          </div>

          {/* Comprador */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Comprador</h3>
            </div>
            <div className="flex flex-col divide-y divide-zinc-800/60 p-lg">
              <Row label="Nome" value={order.buyer_name ?? '—'} />
              <Row label="Destino" value={String(addr.district_info_display ?? addr.region_code ?? '—')} />
              <Row label="Pagamento" value={String(raw.payment_method_name ?? '—')} />
              {raw.buyer_message ? <Row label="Mensagem" value={String(raw.buyer_message)} /> : null}
              {/* TikTok reusa cancel_reason/initiator tambem em devolucao — so rotular "cancelamento" se o pedido esta cancelado */}
              {raw.cancel_reason ? (
                <Row label={cancelado ? 'Motivo do cancelamento' : 'Motivo da devolução'} value={String(raw.cancel_reason)} tone="red" />
              ) : null}
              {raw.cancellation_initiator ? (
                <Row label={cancelado ? 'Cancelado por' : 'Solicitado por'} value={String(raw.cancellation_initiator)} />
              ) : null}
            </div>
          </div>

          {/* Itens */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Itens ({fmtNum(items.length)})</h3>
            </div>
            <div className="flex flex-col divide-y divide-zinc-800/60">
              {items.length === 0 ? (
                <p className="p-lg text-sm text-zinc-500">Sem itens registrados.</p>
              ) : (
                items.map((it, i) => (
                  <div key={`${it.sku_id}-${i}`} className="flex items-start justify-between gap-4 p-lg">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium text-white">{it.product_name ?? '—'}</p>
                      <p className="mt-1 font-mono text-[10px] text-zinc-500">
                        {it.seller_sku ?? it.sku_id ?? '—'} · {fmtNum(it.quantity ?? 1)}x
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-white">{fmtBrl(it.unit_price, cur)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
