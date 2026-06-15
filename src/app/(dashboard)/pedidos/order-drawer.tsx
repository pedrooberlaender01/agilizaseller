'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/icon'
import { MarketplaceLogo, marketplaceLabel } from '@/components/marketplace-logo'
import { cn } from '@/lib/utils'
import {
  getUnifiedOrderDetails,
  type MagazordOrderDetail,
  type SheinOrderDetail,
  type ShopeeOrderDetail,
  type MercadoLivreOrderDetail,
  type OrderDetailsResult,
} from './actions'
import type { UnifiedOrder } from './pedidos-view'

const fmtCurrency = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-outline">{title}</h4>
      <div className="glass-card rounded-lg p-4">{children}</div>
    </div>
  )
}

function Row({ label, value, mono = false, tone }: { label: string; value: React.ReactNode; mono?: boolean; tone?: 'red' | 'green' | 'blue' | 'default' }) {
  const toneCls = tone === 'red' ? 'text-error' : tone === 'green' ? 'text-secondary' : tone === 'blue' ? 'text-primary' : 'text-slate-200'
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={cn('text-sm font-medium', toneCls, mono && 'font-mono text-xs')}>{value}</span>
    </div>
  )
}

const magSituacaoLabel: Record<number, string> = {
  1: 'Aguardando Pagto.', 2: 'Cancelado Pagto.', 3: 'Em Análise Pagto.',
  4: 'Aprovado', 5: 'Aprovado e Integrado', 6: 'NF Emitida',
  7: 'Transporte', 8: 'Entregue', 9: 'Fraude',
  10: 'Chargeback', 11: 'Disputa', 14: 'Cancelado Análise',
  21: 'Devolvido Estoque', 23: 'Faturamento Iniciado', 26: 'NF Cancelada',
}

function MagazordContent({ order }: { order: MagazordOrderDetail }) {
  const items = order.mag_order_items ?? []
  const payments = order.mag_order_payments ?? []
  const tracking = order.mag_order_tracking ?? []
  const subtotal = items.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0)
  const totalDesconto = items.reduce((s, it) => s + (Number(it.valor_desconto) || 0), 0)
  return (
    <div className="space-y-6">
      <Section title="Cliente">
        <Row label="Nome" value={order.pessoa_nome ?? '—'} />
        <Row label="CPF/CNPJ" value={order.cpf_cnpj ?? '—'} mono />
        <Row label="Cidade/UF" value={`${order.cidade ?? '—'} / ${order.uf ?? '—'}`} />
      </Section>

      <Section title="Pedido">
        <Row label="Código externo" value={order.external_id ?? '—'} mono />
        {order.codigo_marketplace && <Row label="Código marketplace" value={order.codigo_marketplace} mono />}
        {order.marketplace_origem && <Row label="Origem" value={order.marketplace_origem} />}
        <Row label="Situação" value={magSituacaoLabel[order.situacao ?? 0] ?? order.situacao_descricao ?? '—'} tone="blue" />
        <Row label="Forma pagamento" value={order.forma_pagamento_descricao ?? '—'} />
        <Row label="Aberto em" value={fmtDateTime(order.data_hora)} mono />
        <Row label="Última alteração" value={fmtDateTime(order.data_hora_ultima_alteracao)} mono />
        <Row label="Mudança situação" value={fmtDateTime(order.data_hora_ultima_alteracao_situacao)} mono />
      </Section>

      <Section title={`Itens (${items.length})`}>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-xs text-outline">Nenhum item.</p>}
          {items.map((it, i) => {
            const qty = Number(it.quantidade) || 0
            const unit = Number(it.valor_unitario) || 0
            const desc = Number(it.valor_desconto) || 0
            const acresc = Number(it.valor_acrescimo) || 0
            const total = qty * unit - desc + acresc
            return (
              <div key={i} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                <p className="line-clamp-2 text-sm text-white">{it.titulo ?? '—'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-outline">
                  <span className="font-mono">{it.codigo_derivacao || it.codigo_produto || '—'}</span>
                  <span>•</span>
                  <span>Qtd {qty}</span>
                  <span>•</span>
                  <span className="font-mono">{fmtCurrency(unit)}</span>
                  {desc > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-error">−{fmtCurrency(desc)}</span>
                    </>
                  )}
                  {it.brinde && <span className="rounded bg-secondary/15 px-1.5 py-0.5 text-[9px] text-secondary">Brinde</span>}
                  {it.presente && <span className="rounded bg-tertiary/15 px-1.5 py-0.5 text-[9px] text-tertiary">Presente</span>}
                </div>
                <p className="mt-1 text-right text-sm font-semibold text-white">{fmtCurrency(total)}</p>
              </div>
            )
          })}
        </div>
      </Section>

      {payments.length > 0 && (
        <Section title="Pagamentos">
          {payments.map((p, i) => (
            <Row
              key={i}
              label={`${p.forma_pagamento_descricao ?? 'Pagamento'} ${p.parcelas ? `(${p.parcelas}x)` : ''}`}
              value={`${fmtCurrency(p.valor)} · ${p.status ?? '—'}`}
            />
          ))}
        </Section>
      )}

      {tracking.length > 0 && (
        <Section title="Rastreios">
          {tracking.map((t, i) => (
            <div key={i} className="border-t border-white/5 pt-2 first:border-t-0 first:pt-0">
              <Row label="Código" value={t.codigo_rastreio ?? '—'} mono />
              {t.transportadora && <Row label="Transportadora" value={`${t.transportadora}${t.servico_transportadora ? ' · ' + t.servico_transportadora : ''}`} />}
              <Row label="Status" value={t.status ?? '—'} />
              {t.data_evento && <Row label="Evento" value={fmtDateTime(t.data_evento)} mono />}
              {t.link && (
                <a href={t.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Icon name="open_in_new" size={12} /> Abrir rastreio
                </a>
              )}
            </div>
          ))}
        </Section>
      )}

      <Section title="Resumo financeiro">
        <Row label="Subtotal itens" value={fmtCurrency(subtotal)} />
        {totalDesconto > 0 && <Row label="Desconto itens" value={`−${fmtCurrency(totalDesconto)}`} tone="red" />}
        {Number(order.valor_desconto ?? 0) > 0 && (
          <Row label="Desconto pedido" value={`−${fmtCurrency(order.valor_desconto)}`} tone="red" />
        )}
        <Row label="Frete" value={fmtCurrency(order.valor_frete)} />
        <div className="my-2 border-t border-white/10" />
        <Row label="Total" value={fmtCurrency(order.valor_total)} tone="green" />
      </Section>
    </div>
  )
}

function SheinContent({ order }: { order: SheinOrderDetail }) {
  const items = order.shein_order_items ?? []
  const totals = items.reduce(
    (acc, it) => {
      acc.commission += Number(it.commission ?? 0)
      acc.service += Number(it.service_charge ?? 0)
      acc.estimated += Number(it.estimated_income ?? 0)
      acc.seller += Number(it.seller_price ?? 0) * (Number(it.quantity ?? 0) || 1)
      return acc
    },
    { commission: 0, service: 0, estimated: 0, seller: 0 },
  )
  const addr = order.shipping_address ?? null
  return (
    <div className="space-y-6">
      <Section title="Comprador">
        <Row label="Nome" value={order.buyer_name ?? '—'} />
        <Row label="Email" value={order.buyer_email ?? '—'} />
        {addr && typeof addr === 'object' && (
          <div className="mt-2 border-t border-white/5 pt-2 text-xs text-slate-400">
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-outline">
              {JSON.stringify(addr, null, 2)}
            </pre>
          </div>
        )}
      </Section>

      <Section title="Pedido">
        <Row label="Order No" value={order.order_no ?? '—'} mono />
        {order.store_code && <Row label="Store code" value={order.store_code} mono />}
        <Row label="Status pedido" value={order.order_status ?? '—'} tone="blue" />
        <Row label="Status pagamento" value={order.payment_status ?? '—'} />
        <Row label="Status envio" value={order.shipping_status ?? '—'} />
        <Row label="Moeda" value={order.currency ?? 'BRL'} />
        <Row label="Criado em" value={fmtDateTime(order.order_time)} mono />
        {order.payment_time && <Row label="Pago em" value={fmtDateTime(order.payment_time)} mono />}
      </Section>

      <Section title={`Itens (${items.length})`}>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-xs text-outline">Nenhum item.</p>}
          {items.map((it, i) => (
            <div key={i} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
              <p className="line-clamp-2 text-sm text-white">{it.product_name ?? '—'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-outline">
                <span className="font-mono">{it.sku_code ?? '—'}</span>
                <span>•</span>
                <span>Qtd {it.quantity ?? 0}</span>
                <span>•</span>
                <span className="font-mono">{fmtCurrency(it.unit_price, order.currency ?? 'BRL')}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                <span className="text-slate-400">Total: <span className="text-white">{fmtCurrency(it.total_price, order.currency ?? 'BRL')}</span></span>
                <span className="text-slate-400">Seller: <span className="text-white">{fmtCurrency(it.seller_price, order.currency ?? 'BRL')}</span></span>
                {Number(it.commission ?? 0) > 0 && (
                  <span className="text-slate-400">Comissão: <span className="text-error">{fmtCurrency(it.commission, order.currency ?? 'BRL')}</span></span>
                )}
                {Number(it.estimated_income ?? 0) > 0 && (
                  <span className="text-slate-400">Líquido est.: <span className="text-secondary">{fmtCurrency(it.estimated_income, order.currency ?? 'BRL')}</span></span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Resumo financeiro">
        <Row label="Total bruto" value={fmtCurrency(order.total_amount, order.currency ?? 'BRL')} />
        {totals.commission > 0 && <Row label="Comissão Shein" value={`−${fmtCurrency(totals.commission, order.currency ?? 'BRL')}`} tone="red" />}
        {totals.service > 0 && <Row label="Service charge" value={`−${fmtCurrency(totals.service, order.currency ?? 'BRL')}`} tone="red" />}
        <div className="my-2 border-t border-white/10" />
        <Row label="Receita líquida est." value={fmtCurrency(totals.estimated, order.currency ?? 'BRL')} tone="green" />
      </Section>
    </div>
  )
}

function ShopeeContent({ order }: { order: ShopeeOrderDetail }) {
  const items = order.shopee_order_items ?? []
  const shipment = order.shopee_shipments?.[0]
  const margin = order.shopee_order_margins?.[0]
  const subtotal = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0)
  const raw = (order.raw_payload as { recipient_address?: { name?: string; full_address?: string; phone?: string } } | null)?.recipient_address
  return (
    <div className="space-y-6">
      <Section title="Comprador">
        <Row label="Username" value={order.buyer_username ?? '—'} mono />
        {raw?.name && <Row label="Destinatário" value={raw.name} />}
        {raw?.phone && <Row label="Telefone" value={raw.phone} mono />}
        {raw?.full_address && (
          <p className="mt-2 whitespace-pre-line border-t border-white/5 pt-2 text-xs text-slate-400">{raw.full_address}</p>
        )}
      </Section>

      <Section title="Pedido">
        <Row label="Order ID" value={order.external_id ?? '—'} mono />
        <Row label="Status" value={`${order.status ?? '—'}${order.status_detail ? ' · ' + order.status_detail : ''}`} tone="blue" />
        <Row label="Pagamento" value={order.payment_method ?? '—'} />
        <Row label="Transportadora" value={order.shipping_carrier ?? '—'} />
        <Row label="Criado em" value={fmtDateTime(order.date_created)} mono />
      </Section>

      {shipment && (
        <Section title="Envio">
          <Row label="Status logística" value={shipment.logistics_status ?? '—'} tone="blue" />
          {shipment.tracking_number && <Row label="Rastreio" value={shipment.tracking_number} mono />}
          {shipment.package_number && <Row label="Pacote" value={shipment.package_number} mono />}
        </Section>
      )}

      <Section title={`Itens (${items.length})`}>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-xs text-outline">Nenhum item.</p>}
          {items.map((it, i) => {
            const qty = Number(it.quantity) || 0
            const unit = Number(it.unit_price) || 0
            return (
              <div key={i} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                <p className="line-clamp-2 text-sm text-white">{it.title ?? '—'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-outline">
                  <span className="font-mono">{it.model_sku ?? it.seller_sku ?? '—'}</span>
                  <span>•</span>
                  <span>Qtd {qty}</span>
                  <span>•</span>
                  <span className="font-mono">{fmtCurrency(unit, order.currency ?? 'BRL')}</span>
                </div>
                <p className="mt-1 text-right text-sm font-semibold text-white">{fmtCurrency(qty * unit, order.currency ?? 'BRL')}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Resumo financeiro">
        <Row label="Subtotal itens" value={fmtCurrency(subtotal, order.currency ?? 'BRL')} />
        <Row label="Frete est." value={fmtCurrency(order.estimated_shipping_fee, order.currency ?? 'BRL')} />
        <Row label="Frete real" value={fmtCurrency(order.actual_shipping_fee, order.currency ?? 'BRL')} />
        <div className="my-2 border-t border-white/10" />
        {margin ? (
          <>
            <Row label="Comissão Shopee" value={`−${fmtCurrency(margin.commission_fee, order.currency ?? 'BRL')}`} tone="red" />
            <Row label="Custo produto" value={`−${fmtCurrency(margin.cogs_total, order.currency ?? 'BRL')}`} tone="red" />
            <Row label="Embalagem" value={`−${fmtCurrency(margin.packaging_total, order.currency ?? 'BRL')}`} tone="red" />
            <Row label="Impostos" value={`−${fmtCurrency(margin.seller_tax_total, order.currency ?? 'BRL')}`} tone="red" />
            <div className="my-2 border-t border-white/10" />
            <Row label="Lucro líquido" value={fmtCurrency(margin.gross_profit, order.currency ?? 'BRL')} tone={Number(margin.gross_profit ?? 0) >= 0 ? 'green' : 'red'} />
            {margin.margin_pct != null && <Row label="Margem" value={`${Number(margin.margin_pct).toFixed(1)}%`} />}
          </>
        ) : (
          <Row label="Total" value={fmtCurrency(order.total_amount, order.currency ?? 'BRL')} tone="green" />
        )}
      </Section>
    </div>
  )
}

function MlContent({ order }: { order: MercadoLivreOrderDetail }) {
  const items = order.ml_order_items ?? []
  const shipment = order.ml_shipments?.[0]
  const totalSaleFee = items.reduce((s, it) => s + (Number(it.sale_fee) || 0), 0)
  return (
    <div className="space-y-6">
      <Section title="Comprador">
        <Row label="Apelido" value={order.buyer_nickname ?? '—'} mono />
        <Row label="Buyer ID" value={order.buyer_id ?? '—'} mono />
        {shipment && (shipment.receiver_city || shipment.receiver_state) && (
          <Row label="Cidade/UF" value={`${shipment.receiver_city ?? '—'} / ${shipment.receiver_state ?? '—'}`} />
        )}
        {shipment?.receiver_zip && <Row label="CEP" value={shipment.receiver_zip} mono />}
      </Section>

      <Section title="Pedido">
        <Row label="Order ID" value={order.external_id ?? '—'} mono />
        {order.pack_id && <Row label="Pack" value={order.pack_id} mono />}
        <Row label="Status" value={`${order.status ?? '—'}${order.status_detail ? ' · ' + order.status_detail : ''}`} tone="blue" />
        <Row label="Moeda" value={order.currency_id ?? 'BRL'} />
        <Row label="Criado em" value={fmtDateTime(order.date_created)} mono />
        {order.date_closed && <Row label="Fechado em" value={fmtDateTime(order.date_closed)} mono />}
        {order.tags && order.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-white/5 pt-2">
            {order.tags.map((t) => (
              <span key={t} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{t}</span>
            ))}
          </div>
        )}
      </Section>

      {shipment && (
        <Section title="Envio">
          <Row label="Status" value={`${shipment.status ?? '—'}${shipment.substatus ? ' · ' + shipment.substatus : ''}`} tone="blue" />
          <Row label="Tipo logístico" value={shipment.logistic_type ?? '—'} />
          {shipment.tracking_number && <Row label="Rastreio" value={shipment.tracking_number} mono />}
          {shipment.estimated_delivery_limit && <Row label="Estimativa entrega" value={fmtDateTime(shipment.estimated_delivery_limit)} mono />}
          {shipment.delivered_at && <Row label="Entregue em" value={fmtDateTime(shipment.delivered_at)} mono tone="green" />}
          <Row label="Custo vendedor" value={fmtCurrency(shipment.cost_seller, order.currency_id ?? 'BRL')} />
        </Section>
      )}

      <Section title={`Itens (${items.length})`}>
        <div className="space-y-3">
          {items.length === 0 && <p className="text-xs text-outline">Nenhum item.</p>}
          {items.map((it, i) => {
            const qty = Number(it.quantity) || 0
            const unit = Number(it.unit_price) || 0
            return (
              <div key={i} className="border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
                <p className="line-clamp-2 text-sm text-white">{it.title ?? '—'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-outline">
                  <span className="font-mono">{it.seller_sku ?? it.item_external_id ?? '—'}</span>
                  <span>•</span>
                  <span>Qtd {qty}</span>
                  <span>•</span>
                  <span className="font-mono">{fmtCurrency(unit, order.currency_id ?? 'BRL')}</span>
                </div>
                {Number(it.sale_fee ?? 0) > 0 && (
                  <p className="mt-1 text-[11px] text-error">Taxa venda: −{fmtCurrency(it.sale_fee, order.currency_id ?? 'BRL')}</p>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Resumo financeiro">
        <Row label="Total bruto" value={fmtCurrency(order.total_amount, order.currency_id ?? 'BRL')} />
        {Number(order.paid_amount ?? 0) > 0 && <Row label="Pago" value={fmtCurrency(order.paid_amount, order.currency_id ?? 'BRL')} tone="green" />}
        {Number(order.coupon_amount ?? 0) > 0 && <Row label="Cupom" value={`−${fmtCurrency(order.coupon_amount, order.currency_id ?? 'BRL')}`} tone="red" />}
        {Number(order.taxes_amount ?? 0) > 0 && <Row label="Impostos" value={`−${fmtCurrency(order.taxes_amount, order.currency_id ?? 'BRL')}`} tone="red" />}
        {totalSaleFee > 0 && <Row label="Comissão ML" value={`−${fmtCurrency(totalSaleFee, order.currency_id ?? 'BRL')}`} tone="red" />}
      </Section>
    </div>
  )
}

export function OrderDrawer({
  orderRow,
  onClose,
}: {
  orderRow: UnifiedOrder
  onClose: () => void
}) {
  const [result, setResult] = useState<OrderDetailsResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setResult(null)
    getUnifiedOrderDetails(orderRow.marketplace, orderRow.order_id).then((res) => {
      if (!cancelled) {
        setResult(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [orderRow.marketplace, orderRow.order_id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 z-40 flex h-screen w-[440px] flex-col overflow-y-auto border-l border-white/10 bg-[#0d1117]"
        style={{ boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#0d1117]/95 p-5 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-3 pr-3">
            <MarketplaceLogo name={orderRow.marketplace} size={36} />
            <div className="min-w-0">
              <h3 className="truncate font-mono text-sm font-semibold text-white">{orderRow.external_id ?? '—'}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {marketplaceLabel(orderRow.marketplace)}
                {orderRow.source_marketplace && ` · via ${orderRow.source_marketplace}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon name="progress_activity" className="animate-spin text-primary" size={28} />
              <span className="text-xs text-outline">Carregando detalhes…</span>
            </div>
          )}

          {!loading && result && !result.order && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon name="error" className="text-error" size={28} />
              <span className="text-sm text-error">Pedido não encontrado.</span>
            </div>
          )}

          {!loading && result?.marketplace === 'magazord' && result.order && (
            <MagazordContent order={result.order} />
          )}
          {!loading && result?.marketplace === 'shein' && result.order && (
            <SheinContent order={result.order} />
          )}
          {!loading && result?.marketplace === 'shopee' && result.order && (
            <ShopeeContent order={result.order} />
          )}
          {!loading && result?.marketplace === 'mercado_livre' && result.order && (
            <MlContent order={result.order} />
          )}
        </div>
      </aside>
    </>
  )
}
