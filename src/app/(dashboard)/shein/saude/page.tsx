import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

export const revalidate = 60

function fmtPct(num: number, den: number): string {
  if (!den) return '0,00%'
  return ((num / den) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

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

function HealthCard({
  label,
  value,
  detail,
  tone,
  icon,
  threshold,
}: {
  label: string
  value: string
  detail: string
  tone: 'green' | 'yellow' | 'red' | 'gray'
  icon: string
  threshold?: string
}) {
  const cls =
    tone === 'green'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'yellow'
        ? 'border-amber-500/30 bg-amber-500/5'
        : tone === 'red'
          ? 'border-rose-500/30 bg-rose-500/5'
          : 'border-zinc-800 bg-zinc-900/40'
  const valCls =
    tone === 'green' ? 'text-emerald-300' : tone === 'yellow' ? 'text-amber-300' : tone === 'red' ? 'text-rose-300' : 'text-white'
  return (
    <div className={cn('rounded-2xl border p-5', cls)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', valCls)}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      {threshold && <p className="mt-0.5 text-[10px] text-zinc-500">Alvo: {threshold}</p>}
    </div>
  )
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

  // Auth events
  const { count: authChangeEvents } = await supabase
    .from('shein_webhook_events')
    .select('*', { count: 'exact', head: true })
    .ilike('event_type', '%authorization%change%')

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
  const exceptionPct = (shipExceptionWindow ?? 0) / Math.max(1, ordersDen) * 100
  const invoiceResendPct = (invoiceResendWindow ?? 0) / Math.max(1, ordersDen) * 100
  const returnPct = (returnsWindow ?? 0) / Math.max(1, ordersDen) * 100
  const productsDelistedPct = (productsInactive ?? 0) / Math.max(1, productsTotal ?? 0) * 100

  const tone = (pct: number, warn: number, danger: number): 'green' | 'yellow' | 'red' =>
    pct >= danger ? 'red' : pct >= warn ? 'yellow' : 'green'

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

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            label="Exceções envio"
            value={fmtPct(shipExceptionWindow ?? 0, ordersDen)}
            detail={`${shipExceptionWindow ?? 0} de ${ordersDen} pedidos`}
            tone={tone(exceptionPct, 1, 3)}
            icon="local_shipping"
            threshold="< 1%"
          />
          <HealthCard
            label="NF reenviar"
            value={fmtPct(invoiceResendWindow ?? 0, ordersDen)}
            detail={`${invoiceResendWindow ?? 0} reenviar · ${invoicePendingWindow ?? 0} pendentes`}
            tone={tone(invoiceResendPct, 0.5, 2)}
            icon="receipt_long"
            threshold="0%"
          />
          <HealthCard
            label="Taxa devolução"
            value={fmtPct(returnsWindow ?? 0, ordersDen)}
            detail={`${returnsWindow ?? 0} devoluções na janela`}
            tone={tone(returnPct, 5, 10)}
            icon="keyboard_return"
            threshold="< 5%"
          />
          <HealthCard
            label="Produtos deslistados"
            value={fmtPct(productsInactive ?? 0, productsTotal ?? 0)}
            detail={`${productsInactive ?? 0} de ${productsTotal ?? 0} SKUs`}
            tone={tone(productsDelistedPct, 10, 25)}
            icon="block"
            threshold="< 10%"
          />
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Items perdidos</span>
              <Icon name="error" size={18} className="text-zinc-500" />
            </div>
            <p className={cn('mt-2 text-2xl font-semibold', (returnsLost ?? 0) > 0 ? 'text-rose-300' : 'text-white')}>
              {returnsLost ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Devoluções marcadas como perdidas (penalidade Shein)</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Eventos autorização</span>
              <Icon name="key" size={18} className="text-zinc-500" />
            </div>
            <p className={cn('mt-2 text-2xl font-semibold', (authChangeEvents ?? 0) > 0 ? 'text-amber-300' : 'text-white')}>
              {authChangeEvents ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Mudanças de autorização recebidas via webhook</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">NF pendente</span>
              <Icon name="hourglass_top" size={18} className="text-zinc-500" />
            </div>
            <p className={cn('mt-2 text-2xl font-semibold', (invoicePendingWindow ?? 0) > 0 ? 'text-amber-300' : 'text-white')}>
              {invoicePendingWindow ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-400">Pedidos aguardando emissão NF</p>
          </div>
        </div>

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
