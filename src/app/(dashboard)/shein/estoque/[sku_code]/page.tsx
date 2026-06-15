import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { mapOrderStatus, statusToneClass } from '@/lib/shein-status'

export const revalidate = 60

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

type StockRow = {
  id: string
  sku_code: string
  warehouse: string | null
  available_qty: number | string | null
  reserved_qty: number | string | null
  total_qty: number | string | null
  updated_at: string | null
  product_name?: string | null
  spu_name?: string | null
  skc_name?: string | null
}

type OrderRow = {
  id: string
  order_no: string
  order_time: string | null
  order_status: string | null
  total_amount: number | string | null
  currency: string | null
  shein_order_items: Array<{
    sku_code: string | null
    product_name: string | null
    quantity: number | null
    unit_price: number | string | null
    commission: number | string | null
    service_charge: number | string | null
    estimated_income: number | string | null
  }>
}

export default async function EstoqueSkuPage({
  params,
}: {
  params: Promise<{ sku_code: string }>
}) {
  const { sku_code: rawSku } = await params
  const skuCode = decodeURIComponent(rawSku)

  const supabase = await createClient()

  const { data: stockRows } = await supabase
    .from('shein_stock_enriched')
    .select('*')
    .eq('sku_code', skuCode)
    .order('warehouse', { ascending: true })

  const stocks = (stockRows ?? []) as StockRow[]
  if (stocks.length === 0) notFound()

  const productName = stocks.find((s) => (s.product_name || '').trim())?.product_name?.trim() || skuCode
  const spu = stocks.find((s) => s.spu_name)?.spu_name || ''
  const skc = stocks.find((s) => s.skc_name)?.skc_name || ''

  const totalAvail = stocks.reduce((s, r) => s + Number(r.available_qty ?? 0), 0)
  const totalReserved = stocks.reduce((s, r) => s + Number(r.reserved_qty ?? 0), 0)
  const totalAll = stocks.reduce((s, r) => s + Number(r.total_qty ?? 0), 0)

  // Pedidos com esse SKU
  const { data: itemsWithOrder } = await supabase
    .from('shein_order_items')
    .select('quantity, unit_price, commission, service_charge, estimated_income, product_name, shein_orders!inner(id, order_no, order_time, order_status, total_amount, currency)')
    .eq('sku_code', skuCode)
    .limit(50)

  type ItemWithOrder = {
    quantity: number | null
    unit_price: number | string | null
    commission: number | string | null
    service_charge: number | string | null
    estimated_income: number | string | null
    product_name: string | null
    shein_orders: {
      id: string
      order_no: string
      order_time: string | null
      order_status: string | null
      total_amount: number | string | null
      currency: string | null
    }
  }

  const orderItemRows = (itemsWithOrder ?? []) as unknown as ItemWithOrder[]
  const orderItems = orderItemRows
    .filter((r) => r.shein_orders)
    .sort((a, b) => {
      const at = new Date(a.shein_orders.order_time ?? 0).getTime()
      const bt = new Date(b.shein_orders.order_time ?? 0).getTime()
      return bt - at
    })

  const totalSold = orderItems.reduce((s, r) => s + Number(r.quantity ?? 0), 0)
  const totalRevenue = orderItems.reduce(
    (s, r) => s + Number(r.quantity ?? 0) * Number(r.unit_price ?? 0),
    0,
  )
  const totalCommission = orderItems.reduce((s, r) => s + Number(r.commission ?? 0), 0)
  const totalServiceCharge = orderItems.reduce((s, r) => s + Number(r.service_charge ?? 0), 0)
  const totalEstimated = orderItems.reduce((s, r) => s + Number(r.estimated_income ?? 0), 0)

  return (
    <>
      <TopBar title={`SKU ${skuCode}`} />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <Link
            href="/shein/estoque"
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar
          </Link>
        </div>

        <div className="mb-lg">
          <h2 className="text-h2 font-semibold text-white">{productName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded bg-zinc-800/60 px-2 py-1 font-mono text-zinc-50">SKU: {skuCode}</span>
            {spu && <span className="font-mono text-zinc-500">SPU: {spu}</span>}
            {skc && <span className="font-mono text-zinc-500">SKC: {skc}</span>}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Disponível</p>
            <p className={cn('mt-1 text-3xl font-semibold', totalAvail <= 5 ? 'text-error' : 'text-white')}>
              {totalAvail.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Reservado</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-50">{totalReserved.toLocaleString('pt-BR')}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Total</p>
            <p className="mt-1 text-3xl font-semibold text-slate-300">{totalAll.toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Estoque por depósito ({stocks.length})</h3>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Depósito</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Disponível</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Reservado</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Atualizado</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {stocks.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/60">
                  <td className="px-6 py-3 font-mono text-xs text-slate-300">{s.warehouse || '—'}</td>
                  <td className={cn('px-6 py-3 text-right text-xs font-medium', Number(s.available_qty) <= 5 ? 'text-error' : 'text-white')}>
                    {Number(s.available_qty).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-3 text-right text-xs text-zinc-50">{Number(s.reserved_qty).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-3 text-right text-xs text-slate-400">{Number(s.total_qty).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-3 text-xs text-slate-400">{fmtDateTime(s.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Vendidos</p>
            <p className="mt-1 text-xl font-semibold text-white">{totalSold.toLocaleString('pt-BR')}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Receita bruta</p>
            <p className="mt-1 text-xl font-semibold text-white">{fmtBrl(totalRevenue)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Comissão</p>
            <p className="mt-1 text-xl font-semibold text-error">{fmtBrl(totalCommission)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Service</p>
            <p className="mt-1 text-xl font-semibold text-error">{fmtBrl(totalServiceCharge)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Líquido est.</p>
            <p className="mt-1 text-xl font-semibold text-secondary">{fmtBrl(totalEstimated)}</p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Pedidos com esse SKU ({orderItems.length})</h3>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Qtd</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Preço</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">Líquido est.</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Data</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {orderItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-500">
                    Nenhum pedido com esse SKU.
                  </td>
                </tr>
              ) : (
                orderItems.map((r) => (
                  <tr key={r.shein_orders.id} className="border-b border-zinc-800/60 hover:bg-white/5">
                    <td className="px-6 py-3">
                      <Link
                        href={`/shein/pedidos/${encodeURIComponent(r.shein_orders.order_no)}`}
                        className="font-mono text-xs text-zinc-50 transition-colors hover:underline"
                      >
                        {r.shein_orders.order_no}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-xs">
                      {(() => {
                        const m = mapOrderStatus(r.shein_orders.order_status)
                        return (
                          <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium', statusToneClass(m.tone))}>
                            {m.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-3 text-right text-xs">{r.quantity ?? 0}</td>
                    <td className="px-6 py-3 text-right text-xs">{fmtBrl(r.unit_price, r.shein_orders.currency ?? 'BRL')}</td>
                    <td className="px-6 py-3 text-right text-xs text-secondary">{fmtBrl(r.estimated_income, r.shein_orders.currency ?? 'BRL')}</td>
                    <td className="px-6 py-3 text-xs text-slate-400">{fmtDateTime(r.shein_orders.order_time)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
