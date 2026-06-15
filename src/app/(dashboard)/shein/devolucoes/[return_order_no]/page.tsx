import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { mapReturnStatus, statusToneClass } from '@/lib/shein-status'

export const revalidate = 60

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  if (days < 7) return `há ${days}d`
  return fmtDateTime(iso)
}

function fmtBRL(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function invoiceLabel(code: number | null): string {
  if (code == null) return '—'
  if (code === 0) return 'Sem NF'
  if (code === 1) return 'NF pendente'
  if (code === 2) return 'NF solicitada'
  if (code === 3) return 'NF emitida'
  return `NF ${code}`
}

function stockModeLabel(code: number | null): string {
  if (code == null) return '—'
  if (code === 1) return 'Devolver vendedor'
  if (code === 2) return 'Manter armazém SHEIN'
  if (code === 3) return 'Descartar'
  return `Modo ${code}`
}

function receiveTypeLabel(code: number | null): string {
  if (code == null) return '—'
  if (code === 0) return 'Devolução cliente'
  if (code === 1) return 'Devolução armazém'
  if (code === 2) return 'Sem devolução física'
  return `Tipo ${code}`
}

type ReturnReason = { reason?: string; language?: string }

type ReturnItem = {
  id: string
  goods_id: number | null
  sku: string | null
  skc: string | null
  goods_title: string | null
  image_url: string | null
  goods_status: number | null
  return_image_list: unknown
  return_reason_list: unknown
  currency: string | null
  seller_currency_price: number | string | null
  cost_price: number | string | null
  estimate_commission: number | string | null
  performance_price: number | string | null
  return_expense: number | string | null
  estimate_income_money: number | string | null
}

function pickReasonsPtBr(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const list = raw as ReturnReason[]
  if (list.length === 0) return []
  // Shein emite N razões em CN, depois N em EN, N em PT, etc. Filtrar direto por language.
  const dedupe = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))
  const pt = dedupe(list.filter((r) => (r.language || '').toUpperCase() === 'PT').map((r) => (r.reason || '').trim()))
  if (pt.length) return pt
  const en = dedupe(list.filter((r) => (r.language || '').toUpperCase() === 'EN').map((r) => (r.reason || '').trim()))
  return en
}

type ReturnDetail = {
  id: string
  return_order_no: string
  return_order_status: number | null
  no_return_goods_sign: number | null
  return_order_tag_code: number | null
  order_no: string | null
  site: string | null
  shipping_code: string | null
  platform_express_no: string | null
  member_express_no: string | null
  express_company_name: string | null
  refund_order_nos: unknown
  refund_express_company_name: string | null
  performance_cost: number | string | null
  invoice_status: number | null
  check_status: number | null
  stock_mode: number | null
  receive_type: number | null
  request_return_time: string | null
  allocate_time: string | null
  last_update_time: string | null
  seller_signed_time: string | null
  cancel_time: string | null
  completed_time: string | null
  raw: Record<string, unknown> | null
  buyer_name: string | null
  parent_order_status: string | null
}

export default async function DevolucaoDetalhePage({
  params,
}: {
  params: Promise<{ return_order_no: string }>
}) {
  const { return_order_no: raw } = await params
  const returnNo = decodeURIComponent(raw)

  const supabase = await createClient()
  const { data: ret } = await supabase
    .from('shein_returns_enriched')
    .select('*')
    .eq('return_order_no', returnNo)
    .maybeSingle()

  if (!ret) notFound()
  const r = ret as ReturnDetail

  const { data: itemsData } = await supabase
    .from('shein_return_items')
    .select('*')
    .eq('return_id', r.id)
    .order('created_at', { ascending: true })

  const items = (itemsData ?? []) as ReturnItem[]

  const totalIncome = items.reduce((acc, it) => acc + (Number(it.estimate_income_money) || 0), 0)
  const totalCommission = items.reduce((acc, it) => acc + (Number(it.estimate_commission) || 0), 0)
  const totalReturnExpense = items.reduce((acc, it) => acc + (Number(it.return_expense) || 0), 0)

  const statusBadge = mapReturnStatus(r.return_order_status)
  const refundList = Array.isArray(r.refund_order_nos) ? r.refund_order_nos as string[] : []

  return (
    <>
      <TopBar title={`Devolução ${returnNo}`} />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <Link
            href="/shein/devolucoes"
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar
          </Link>
        </div>

        <div className="mb-lg">
          <h2 className="text-h2 font-semibold text-white">Devolução {returnNo}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className={cn('rounded px-2 py-1 font-medium', statusToneClass(statusBadge.tone))}>
              {statusBadge.label}
            </span>
            <span className="rounded bg-zinc-800/60 px-2 py-1 font-mono text-zinc-50">{returnNo}</span>
            {r.order_no && (
              <Link
                href={`/shein/pedidos/${encodeURIComponent(r.order_no)}`}
                className="rounded bg-blue-500/15 px-2 py-1 font-mono text-blue-300 transition-colors hover:bg-blue-500/25"
              >
                Pedido: {r.order_no}
              </Link>
            )}
            {r.site && <span className="rounded bg-white/5 px-2 py-1 text-slate-300">{r.site}</span>}
            {r.no_return_goods_sign === 1 && (
              <span className="rounded bg-amber-500/15 px-2 py-1 text-amber-300">Sem devolução física</span>
            )}
            {r.return_order_tag_code === 1 && (
              <span className="rounded bg-violet-500/15 px-2 py-1 text-violet-300">KOL</span>
            )}
            {r.return_order_tag_code === 2 && (
              <span className="rounded bg-rose-500/15 px-2 py-1 text-rose-300">Item perdido</span>
            )}
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Líquido estimado</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{fmtBRL(totalIncome)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{items.length} {items.length === 1 ? 'item' : 'itens'}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Comissão</p>
            <p className="mt-1 text-xl font-semibold text-white">{fmtBRL(totalCommission)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Performance: {fmtBRL(r.performance_cost)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Despesa devolução</p>
            <p className="mt-1 text-xl font-semibold text-white">{fmtBRL(totalReturnExpense)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">NF: {invoiceLabel(r.invoice_status)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Solicitada</p>
            <p className="mt-1 text-xl font-semibold text-white">{fmtRel(r.request_return_time)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{fmtDateTime(r.request_return_time)}</p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Logística devolução</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 text-xs md:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Transportadora</p>
              <p className="mt-0.5 text-slate-200">{r.express_company_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Tracking plataforma</p>
              <p className="mt-0.5 font-mono text-slate-200">{r.platform_express_no || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Tracking cliente</p>
              <p className="mt-0.5 font-mono text-slate-200">{r.member_express_no || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Shipping code</p>
              <p className="mt-0.5 font-mono text-slate-200">{r.shipping_code || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Modo estoque</p>
              <p className="mt-0.5 text-slate-200">{stockModeLabel(r.stock_mode)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Tipo recebimento</p>
              <p className="mt-0.5 text-slate-200">{receiveTypeLabel(r.receive_type)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Conciliação</p>
              <p className="mt-0.5 text-slate-200">{r.check_status === 1 ? 'Conciliada' : r.check_status === 2 ? 'Não conciliada' : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Refunds</p>
              <p className="mt-0.5 text-slate-200">{refundList.length > 0 ? refundList.join(', ') : '—'}</p>
            </div>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Linha do tempo</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6 text-xs md:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Solicitada</p>
              <p className="mt-0.5 text-slate-200">{fmtDateTime(r.request_return_time)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Alocada</p>
              <p className="mt-0.5 text-slate-200">{fmtDateTime(r.allocate_time)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Recebida vendedor</p>
              <p className="mt-0.5 text-slate-200">{fmtDateTime(r.seller_signed_time)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Concluída</p>
              <p className="mt-0.5 text-slate-200">{fmtDateTime(r.completed_time)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Cancelada</p>
              <p className="mt-0.5 text-slate-200">{fmtDateTime(r.cancel_time)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Última atualização</p>
              <p className="mt-0.5 text-slate-200">{fmtDateTime(r.last_update_time)}</p>
            </div>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Itens devolvidos ({items.length})</h3>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Produto</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">SKU</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Preço seller</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Custo</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Líquido estimado</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Razões</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-500">
                    Sem itens registrados.
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const reasons = pickReasonsPtBr(it.return_reason_list)
                  return (
                    <tr key={it.id} className="border-b border-zinc-800/60">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {it.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-[10px] text-zinc-500">—</div>
                          )}
                          <div>
                            <p className="line-clamp-1 max-w-[260px] text-xs font-medium text-white">{it.goods_title || '—'}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-zinc-500">{it.skc || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 font-mono text-[11px] text-slate-300">{it.sku || '—'}</td>
                      <td className="px-6 py-3 text-xs text-slate-300">{fmtBRL(it.seller_currency_price)}</td>
                      <td className="px-6 py-3 text-xs text-slate-300">{fmtBRL(it.cost_price)}</td>
                      <td className="px-6 py-3 text-xs text-emerald-300">{fmtBRL(it.estimate_income_money)}</td>
                      <td className="px-6 py-3 text-[11px] text-slate-400">
                        {reasons.length === 0 ? '—' : (
                          <div className="flex flex-wrap gap-1">
                            {reasons.map((r, i) => (
                              <span key={i} className="inline-block rounded bg-zinc-800/60 px-1.5 py-0.5 text-slate-200">{r}</span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </main>
    </>
  )
}
