import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { PedidosView, type OrderRow } from './pedidos-view'

export const revalidate = 60

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

function periodRangeIso(
  period: Period,
  customFrom: string | null,
  customTo: string | null,
): { from: string; to: string | null } {
  if (period === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00-03:00')
    const t = new Date(customTo + 'T00:00:00-03:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return { from: d.toISOString(), to: null }
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Pedidos — TikTok Shop" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="border border-zinc-800 bg-zinc-900/40 flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-zinc-50">link_off</span>
          <h2 className="text-h2 font-semibold text-zinc-50">Sem conexão TikTok Shop ativa</h2>
          <p className="text-sm text-zinc-400">
            Configure a conexão TikTok Shop para começar a sincronizar pedidos.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function TiktokPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; q?: string; page?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const statusFilter = (sp.status ?? '').trim()
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'tiktok_shop')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const offset = (page - 1) * PAGE_SIZE
  const { from, to } = periodRangeIso(period, customFrom, customTo)
  let query = supabase
    .from('tt_orders')
    .select('*, tt_order_items(quantity, unit_price, product_name)', { count: 'exact' })
    .eq('connection_id', conn.id)
    .gte('create_time', from)

  if (to) query = query.lt('create_time', to)
  const statusesArr = statusFilter ? statusFilter.split(',').filter(Boolean) : null
  if (statusesArr && statusesArr.length > 0) query = query.in('order_status', statusesArr)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`order_id.ilike.%${term}%,buyer_name.ilike.%${term}%`)
  }

  const [pageResult, statusesResult, totalsResult] = await Promise.all([
    query
      .order('create_time', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('tt_distinct_order_statuses'),
    supabase.rpc('tt_pedidos_totals', {
      p_from: from,
      p_to: to,
      p_statuses: statusesArr,
      p_search: search || null,
    }),
  ])
  const { data, count } = pageResult
  const uniqueStatuses = ((statusesResult.data ?? []) as Array<{ status: string | null }>)
    .map((r) => r.status)
    .filter((s): s is string => !!s)

  const totals = (totalsResult.data ?? { count: 0, gmv: 0 }) as { count: number; gmv: number | string }
  const periodTotals = { gmv: Number(totals.gmv ?? 0), count: Number(totals.count ?? 0) }

  return (
    <PedidosView
      orders={(data ?? []) as OrderRow[]}
      totalCount={count ?? 0}
      periodTotals={periodTotals}
      page={page}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      status={statusFilter}
      search={search}
      statuses={uniqueStatuses}
    />
  )
}
