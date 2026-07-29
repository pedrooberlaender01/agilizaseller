import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { SaudeCards } from './saude-cards'

export const revalidate = 60

const UN_PROCESS_REASON: Record<string, string> = {
  '1': 'Sistema processando',
  '2': 'Atendimento verificando',
  '3': 'NF brasileira pendente',
  '4': 'Pacote não gerou',
  '5': 'Sistema processando',
  '6': 'Produto zerado',
  '7': 'Sistema processando',
  '8': 'Sistema processando',
  '9': 'Produto zerado',
  '13': 'NF brasileira reenviar',
}

function parseUnProcessReasons(raw: unknown): string[] {
  if (!raw) return []
  let arr: unknown = raw
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { arr = [raw] }
  }
  if (!Array.isArray(arr)) return []
  return arr.map((c) => UN_PROCESS_REASON[String(c)] || `Code ${c}`)
}

function fmtRel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `há ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `há ${days}d`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const SHIPMENT_WINDOW_DAYS = 30

export default async function SheinSaudePage() {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Saúde — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const windowSince = new Date(Date.now() - SHIPMENT_WINDOW_DAYS * 86400000).toISOString()

  // Pedidos
  const { count: ordersTotal } = await supabase
    .from('shein_orders')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)

  const { count: ordersWindow } = await supabase
    .from('shein_orders')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .gte('order_time', windowSince)

  const { count: shipExceptionWindow } = await supabase
    .from('shein_orders')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('shipping_status', '2')
    .gte('order_time', windowSince)

  const { count: invoiceResendWindow } = await supabase
    .from('shein_orders')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('payment_status', '3')
    .gte('order_time', windowSince)

  const { count: invoicePendingWindow } = await supabase
    .from('shein_orders')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('payment_status', '2')
    .gte('order_time', windowSince)

  // Devoluções
  const { count: returnsWindow } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .gte('request_return_time', windowSince)

  const { count: returnsLost } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('return_order_tag_code', 2)

  // Produtos
  const { count: productsTotal } = await supabase
    .from('shein_products')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)

  const { count: productsInactive } = await supabase
    .from('shein_products')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('status', 'inativo')

  // Listas detalhe
  const { data: exceptionList } = await supabase
    .from('shein_orders')
    .select('order_no, order_time, total_amount, currency, raw')
    .eq('connection_id', conn.id)
    .eq('shipping_status', '2')
    .gte('order_time', windowSince)
    .order('order_time', { ascending: false })
    .limit(10)

  const { data: invoiceList } = await supabase
    .from('shein_orders')
    .select('order_no, order_time, total_amount, currency')
    .eq('connection_id', conn.id)
    .eq('payment_status', '3')
    .gte('order_time', windowSince)
    .order('order_time', { ascending: false })
    .limit(10)

  const { data: lostList } = await supabase
    .from('shein_returns')
    .select('return_order_no, order_no, request_return_time')
    .eq('connection_id', conn.id)
    .eq('return_order_tag_code', 2)
    .order('request_return_time', { ascending: false })
    .limit(10)

  const ordersDen = ordersWindow ?? 0

  return (
    <>
      <TopBar title="Saúde — Shein" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Saúde da conta</h2>
            <p className="mt-1 text-xs text-slate-400">
              {conn.nickname && <>Conexão: {conn.nickname} · </>}
              Janela: últimos {SHIPMENT_WINDOW_DAYS} dias ({ordersWindow ?? 0} pedidos · {ordersTotal ?? 0} totais)
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">
              ⚠️ Shein não expõe Account Health API. Métricas derivadas dos dados sincronizados.
            </p>
          </div>
        </div>

        <SaudeCards
          shipException={shipExceptionWindow ?? 0}
          invoiceResend={invoiceResendWindow ?? 0}
          invoicePending={invoicePendingWindow ?? 0}
          returns={returnsWindow ?? 0}
          returnsLost={returnsLost ?? 0}
          productsInactive={productsInactive ?? 0}
          productsTotal={productsTotal ?? 0}
          ordersDen={ordersDen}
        />

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-white">Últimos envios com exceção</h3>
            </div>
            <ul className="divide-y divide-zinc-800/60 text-sm text-slate-200">
              {(exceptionList ?? []).length === 0 ? (
                <li className="px-6 py-8 text-center text-xs text-zinc-500">Nenhuma exceção na janela.</li>
              ) : (
                (exceptionList ?? []).map((o) => {
                  const rawObj = (o.raw && typeof o.raw === 'object') ? (o.raw as Record<string, unknown>) : null
                  const reasons = rawObj ? parseUnProcessReasons(rawObj.unProcessReason) : []
                  return (
                    <li key={o.order_no} className="px-6 py-3">
                      <Link
                        href={`/shein/pedidos/${encodeURIComponent(o.order_no)}`}
                        className="flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-rose-300">{o.order_no}</p>
                          {reasons.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {reasons.map((r, i) => (
                                <span key={i} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">{r}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-zinc-500">{fmtRel(o.order_time)}</span>
                      </Link>
                    </li>
                  )
                })
              )}
            </ul>
          </div>

          <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-white">Últimas NF para reenviar</h3>
            </div>
            <ul className="divide-y divide-zinc-800/60 text-sm text-slate-200">
              {(invoiceList ?? []).length === 0 ? (
                <li className="px-6 py-8 text-center text-xs text-zinc-500">Nenhuma NF para reenviar na janela.</li>
              ) : (
                (invoiceList ?? []).map((o) => (
                  <li key={o.order_no} className="px-6 py-3">
                    <Link
                      href={`/shein/pedidos/${encodeURIComponent(o.order_no)}`}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <p className="font-mono text-amber-300">{o.order_no}</p>
                      <span className="text-zinc-500">{fmtRel(o.order_time)}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {(lostList ?? []).length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-white">Items perdidos (devoluções)</h3>
            </div>
            <ul className="divide-y divide-zinc-800/60 text-sm text-slate-200">
              {(lostList ?? []).map((r) => (
                <li key={r.return_order_no} className="px-6 py-3">
                  <Link
                    href={`/shein/devolucoes/${encodeURIComponent(r.return_order_no)}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-mono text-rose-300">{r.return_order_no}</p>
                      {r.order_no && <p className="mt-0.5 font-mono text-zinc-500">Pedido: {r.order_no}</p>}
                    </div>
                    <span className="text-zinc-500">{fmtRel(r.request_return_time)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  )
}
