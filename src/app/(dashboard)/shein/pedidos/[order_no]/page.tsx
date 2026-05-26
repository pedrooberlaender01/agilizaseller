import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { mapOrderStatus, mapInvoiceStatus, mapPrintStatus, statusToneClass } from '@/lib/shein-status'
import { ExportAddressButton } from './export-button'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

type Tone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

const toneClasses: Record<Tone, string> = {
  yellow: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  blue:   'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  green:  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red:    'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray:   'bg-zinc-700/30 text-zinc-300 border border-zinc-600/40',
}

function statusTone(s: string | null): Tone {
  if (!s) return 'gray'
  const v = s.toLowerCase()
  if (v.includes('cancel') || v.includes('refund') || v.includes('reject')) return 'red'
  if (v.includes('paid') || v.includes('delivered') || v.includes('complete') || v.includes('success')) return 'green'
  if (v.includes('ship') || v.includes('transit') || v.includes('process')) return 'blue'
  if (v.includes('pend') || v.includes('wait') || v.includes('hold')) return 'yellow'
  return 'gray'
}

function Field({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'red' | 'green' }) {
  const toneCls = tone === 'red' ? 'text-error' : tone === 'green' ? 'text-secondary' : 'text-white'
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('font-medium', toneCls)}>{value}</p>
    </div>
  )
}

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ order_no: string }>
}) {
  const { order_no: rawOrderNo } = await params
  const orderNo = decodeURIComponent(rawOrderNo)

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('shein_orders')
    .select(
      '*, shein_order_items(id, sku_code, product_name, quantity, unit_price, total_price, commission, commission_rate, service_charge, estimated_income, seller_price)',
    )
    .eq('order_no', orderNo)
    .maybeSingle()

  if (!order) notFound()

  const items = (order.shein_order_items ?? []) as Array<{
    id: string
    sku_code: string | null
    product_name: string | null
    quantity: number | null
    unit_price: number | string | null
    total_price: number | string | null
    commission: number | string | null
    commission_rate: number | string | null
    service_charge: number | string | null
    estimated_income: number | string | null
    seller_price: number | string | null
  }>

  const totalCommission = items.reduce((s, i) => s + Number(i.commission ?? 0), 0)
  const totalService = items.reduce((s, i) => s + Number(i.service_charge ?? 0), 0)
  const totalFees = totalCommission + totalService
  const totalEstimated = items.reduce((s, i) => s + Number(i.estimated_income ?? 0), 0)
  const totalGross = Number(order.total_amount ?? 0)
  const taxaPct = totalGross > 0 ? (totalFees / totalGross) * 100 : 0

  const { data: settlements } = await supabase
    .from('shein_settlements')
    .select('settlement_id, amount, settlement_date, currency')
    .eq('order_no', orderNo)
    .order('settlement_date', { ascending: false })

  const settlementList = (settlements ?? []) as Array<{
    settlement_id: string | null
    amount: number | string | null
    settlement_date: string | null
    currency: string | null
  }>

  let shippingAddress: Record<string, unknown> | null = null
  try {
    if (order.shipping_address) {
      shippingAddress = typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address) : order.shipping_address
    }
  } catch {
    shippingAddress = null
  }

  return (
    <>
      <TopBar title={`Pedido ${orderNo}`} />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <Link
            href="/shein/pedidos"
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar
          </Link>
        </div>

        <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Order #</p>
            <h2 className="font-mono text-h2 font-semibold text-white">{order.order_no}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {(() => {
                const m = mapOrderStatus(order.order_status)
                return (
                  <span className={cn('inline-flex rounded px-2 py-1 text-[10px] font-medium', statusToneClass(m.tone))}>
                    Status: {m.label}
                  </span>
                )
              })()}
              {(() => {
                const m = mapInvoiceStatus(order.payment_status)
                return (
                  <span className={cn('inline-flex rounded px-2 py-1 text-[10px] font-medium', statusToneClass(m.tone))}>
                    Fatura: {m.label}
                  </span>
                )
              })()}
              {(() => {
                const m = mapPrintStatus(order.shipping_status)
                return (
                  <span className={cn('inline-flex rounded px-2 py-1 text-[10px] font-medium', statusToneClass(m.tone))}>
                    Envio: {m.label}
                  </span>
                )
              })()}
            </div>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Bruto</p>
            <p className="mt-1 text-2xl font-semibold text-white">{fmtBrl(totalGross, order.currency ?? 'BRL')}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Comissão</p>
            <p className="mt-1 text-2xl font-semibold text-error">{fmtBrl(totalCommission, order.currency ?? 'BRL')}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Service charge</p>
            <p className="mt-1 text-2xl font-semibold text-error">{fmtBrl(totalService, order.currency ?? 'BRL')}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Taxa total ({taxaPct.toFixed(1)}%)</p>
            <p className="mt-1 text-2xl font-semibold text-error">{fmtBrl(totalFees, order.currency ?? 'BRL')}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Líquido est.</p>
            <p className="mt-1 text-2xl font-semibold text-secondary">{fmtBrl(totalEstimated, order.currency ?? 'BRL')}</p>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-lg">
            <h3 className="mb-4 text-sm font-semibold text-white">Datas</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Criado" value={fmtDateTime(order.order_time)} />
              <Field label="Pagamento" value={fmtDateTime(order.payment_time)} />
            </div>
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-lg">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Comprador</h3>
              <ExportAddressButton
                orderNo={order.order_no}
                connectionId={order.connection_id}
                hasData={Boolean(order.buyer_name)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Nome" value={order.buyer_name || '—'} />
              <Field label="Email" value={order.buyer_email || '—'} />
            </div>
            {!order.buyer_name && (
              <p className="mt-3 text-[11px] text-zinc-500">
                Shein mascara comprador por padrão (LGPD). Use o botão acima para puxar via export-address.
              </p>
            )}
          </div>
        </div>

        {shippingAddress && Object.keys(shippingAddress).length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-white">Endereço de envio</h3>
            </div>
            <div className="p-lg">
              <pre className="overflow-x-auto font-mono text-xs text-slate-300">
                {JSON.stringify(shippingAddress, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Itens ({items.length})</h3>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Produto</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">SKU</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Qtd</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Preço</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Comm</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Service</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Líquido est.</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {items.map((i) => (
                <tr key={i.id} className="border-b border-zinc-800/60">
                  <td className="px-6 py-3 text-xs">{i.product_name || '—'}</td>
                  <td className="px-6 py-3 font-mono text-[10px] text-slate-400">{i.sku_code || '—'}</td>
                  <td className="px-6 py-3 text-right font-mono text-xs">{i.quantity ?? 0}</td>
                  <td className="px-6 py-3 text-right text-xs">{fmtBrl(i.unit_price, order.currency ?? 'BRL')}</td>
                  <td className="px-6 py-3 text-right text-xs text-error">
                    {fmtBrl(i.commission, order.currency ?? 'BRL')}
                    {i.commission_rate ? (
                      <span className="ml-1 text-[9px] text-zinc-500">({(Number(i.commission_rate) * 100).toFixed(1)}%)</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-3 text-right text-xs text-error">{fmtBrl(i.service_charge, order.currency ?? 'BRL')}</td>
                  <td className="px-6 py-3 text-right text-xs text-secondary">{fmtBrl(i.estimated_income, order.currency ?? 'BRL')}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-500">
                    Sem itens registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {settlementList.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-white">Settlements vinculados ({settlementList.length})</h3>
            </div>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Settlement ID</th>
                  <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Líquido est.</th>
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Data</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {settlementList.map((s) => (
                  <tr key={s.settlement_id} className="border-b border-zinc-800/60">
                    <td className="px-6 py-3 font-mono text-xs text-white">{s.settlement_id}</td>
                    <td className="px-6 py-3 text-right text-xs text-secondary">{fmtBrl(s.amount, s.currency ?? 'BRL')}</td>
                    <td className="px-6 py-3 text-xs text-slate-400">{fmtDateTime(s.settlement_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="border border-zinc-800 bg-zinc-900/40 rounded-2xl">
          <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-white">Payload raw</summary>
          <div className="border-t border-zinc-800 p-lg">
            <pre className="overflow-x-auto font-mono text-[11px] text-slate-300">
              {JSON.stringify(order.raw ?? {}, null, 2)}
            </pre>
          </div>
        </details>
      </main>
    </>
  )
}
