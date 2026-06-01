import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const revalidate = 60

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtRel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `há ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days}d`
  return fmtDateTime(iso)
}

type TrackingEvent = {
  nodeCode?: string
  nodeCodeName?: string
  description?: string
  updateTimeMillis?: number
}

type ShipmentRow = {
  id: string
  order_id: string | null
  order_no: string
  package_no: string | null
  waybill_no: string
  carrier: string | null
  carrier_code: string | null
  waybill_type: number | null
  last_node: string | null
  last_node_name: string | null
  last_update_at: string | null
  tracking_events: TrackingEvent[] | string | null
  raw: Record<string, unknown> | null
  product_name: string | null
  buyer_name: string | null
}

function nodeColor(code: string | undefined | null): string {
  if (!code) return 'bg-zinc-700'
  const c = code.toLowerCase()
  if (['sign_for', 'signed', 'delivered'].includes(c)) return 'bg-emerald-500'
  if (c.includes('return') || c.includes('exception') || c.includes('fail')) return 'bg-rose-500'
  if (c.includes('transport') || c.includes('transit')) return 'bg-blue-500'
  return 'bg-zinc-500'
}

function waybillTypeLabel(t: number | null): string {
  if (t === 1) return 'Envio inicial (head)'
  if (t === 2) return 'Envio final (tail)'
  if (t === 3) return 'Devolução cliente'
  if (t === 4) return 'Devolução plataforma'
  if (t === 5) return 'Cumprimento vendedor'
  if (t === 6) return 'Devolução fornecedor'
  return t == null ? '—' : `Tipo ${t}`
}

export default async function EnvioDetalhePage({
  params,
}: {
  params: Promise<{ waybill_no: string }>
}) {
  const { waybill_no: raw } = await params
  const waybillNo = decodeURIComponent(raw)

  const supabase = await createClient()
  const { data: shipment } = await supabase
    .from('shein_shipments_enriched')
    .select('*')
    .eq('waybill_no', waybillNo)
    .maybeSingle()

  if (!shipment) notFound()
  const s = shipment as ShipmentRow

  let events: TrackingEvent[] = []
  if (Array.isArray(s.tracking_events)) events = s.tracking_events
  else if (typeof s.tracking_events === 'string') {
    try { events = JSON.parse(s.tracking_events) } catch { events = [] }
  }
  events = events.sort((a, b) => (Number(b.updateTimeMillis) || 0) - (Number(a.updateTimeMillis) || 0))

  // Outros waybills do mesmo pedido
  const { data: siblingsData } = await supabase
    .from('shein_shipments')
    .select('waybill_no, carrier, last_node_name, waybill_type, last_update_at')
    .eq('order_no', s.order_no)
    .neq('waybill_no', waybillNo)

  const siblings = (siblingsData ?? []) as Array<{
    waybill_no: string
    carrier: string | null
    last_node_name: string | null
    waybill_type: number | null
    last_update_at: string | null
  }>

  return (
    <>
      <TopBar title={`Envio ${waybillNo}`} />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <Link
            href="/shein/envios"
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar
          </Link>
        </div>

        <div className="mb-lg">
          <h2 className="text-h2 font-semibold text-white">{s.product_name || waybillNo}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded bg-zinc-800/60 px-2 py-1 font-mono text-zinc-50">Waybill: {waybillNo}</span>
            {s.package_no && <span className="font-mono text-zinc-500">Package: {s.package_no}</span>}
            <Link
              href={`/shein/pedidos/${encodeURIComponent(s.order_no)}`}
              className="rounded bg-blue-500/15 px-2 py-1 font-mono text-blue-300 transition-colors hover:bg-blue-500/25"
            >
              Pedido: {s.order_no}
            </Link>
            <span className="rounded bg-white/5 px-2 py-1 text-slate-300">{waybillTypeLabel(s.waybill_type)}</span>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Transportadora</p>
            <p className="mt-1 text-xl font-semibold text-white">{s.carrier || '—'}</p>
            {s.carrier_code && <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{s.carrier_code}</p>}
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Status Atual</p>
            <p className="mt-1 text-xl font-semibold text-white">{s.last_node_name || 'Aguardando'}</p>
            {s.last_node && <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{s.last_node}</p>}
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Última Atualização</p>
            <p className="mt-1 text-xl font-semibold text-white">{fmtRel(s.last_update_at)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{fmtDateTime(s.last_update_at)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Eventos</p>
            <p className="mt-1 text-xl font-semibold text-white">{events.length}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{s.buyer_name ? `Compr: ${s.buyer_name}` : 'Sem comprador'}</p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Timeline de rastreamento ({events.length} eventos)</h3>
          </div>
          <div className="p-lg">
            {events.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">
                Sem eventos de rastreamento ainda. Sync pode atualizar quando transportadora postar dados.
              </p>
            ) : (
              <ol className="relative ml-3 border-l-2 border-zinc-800">
                {events.map((e, i) => {
                  const dotColor = nodeColor(e.nodeCode)
                  const timeIso = e.updateTimeMillis ? new Date(Number(e.updateTimeMillis)).toISOString() : null
                  return (
                    <li key={i} className="mb-md ml-6">
                      <span className={cn('absolute -ml-[1.45rem] mt-1.5 h-3 w-3 rounded-full', dotColor)} />
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className={cn('text-sm font-medium', i === 0 ? 'text-white' : 'text-slate-300')}>
                          {e.nodeCodeName || e.nodeCode || '—'}
                        </h4>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-500">{fmtDateTime(timeIso)}</span>
                      </div>
                      {e.description && <p className="mt-0.5 text-xs text-slate-400">{e.description}</p>}
                      {e.nodeCode && <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{e.nodeCode}</p>}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        {siblings.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
            <div className="border-b border-zinc-800 px-6 py-4">
              <h3 className="text-sm font-semibold text-white">Outros waybills do pedido ({siblings.length})</h3>
            </div>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Waybill</th>
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Tipo</th>
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Transportadora</th>
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Atualizado</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-200">
                {siblings.map((sb) => (
                  <tr key={sb.waybill_no} className="border-b border-zinc-800/60">
                    <td className="px-6 py-3 font-mono text-xs text-white">{sb.waybill_no}</td>
                    <td className="px-6 py-3 text-xs text-slate-300">{waybillTypeLabel(sb.waybill_type)}</td>
                    <td className="px-6 py-3 text-xs text-slate-300">{sb.carrier || '—'}</td>
                    <td className="px-6 py-3 text-xs text-slate-300">{sb.last_node_name || '—'}</td>
                    <td className="px-6 py-3 text-xs text-slate-400">{fmtRel(sb.last_update_at)}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/shein/envios/${encodeURIComponent(sb.waybill_no)}`}
                        className="text-[11px] text-blue-300 transition-colors hover:underline"
                      >
                        abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </main>
    </>
  )
}
