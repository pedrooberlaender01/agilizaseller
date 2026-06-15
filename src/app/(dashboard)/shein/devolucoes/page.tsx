import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { DevolucoesView, type ReturnRow } from './devolucoes-view'

export const revalidate = 60

const PAGE_SIZE = 50

export default async function SheinDevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; site?: string; page?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const statusFilter = (sp.status ?? '').trim()
  const siteFilter = (sp.site ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

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
        <TopBar title="Devoluções — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shein_returns_enriched')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (statusFilter) query = query.eq('return_order_status', Number(statusFilter))
  if (siteFilter) query = query.eq('site', siteFilter)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`return_order_no.ilike.%${term}%,order_no.ilike.%${term}%,goods_title.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('request_return_time', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: siteRows } = await supabase
    .from('shein_returns')
    .select('site')
    .eq('connection_id', conn.id)
    .not('site', 'is', null)

  const sites = Array.from(
    new Set(((siteRows ?? []) as Array<{ site: string }>).map((r) => r.site)),
  ).sort()

  const { count: totalCount } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)

  const { count: solicitadasCount } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('return_order_status', 2)

  const { count: recebidasCount } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .in('return_order_status', [5, 6])

  const { count: concluidasCount } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('return_order_status', 9)

  const { count: canceladasCount } = await supabase
    .from('shein_returns')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('return_order_status', 3)

  return (
    <DevolucoesView
      returns={(data ?? []) as ReturnRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      status={statusFilter}
      site={siteFilter}
      sites={sites}
      stats={{
        total: totalCount ?? 0,
        solicitadas: solicitadasCount ?? 0,
        recebidas: recebidasCount ?? 0,
        concluidas: concluidasCount ?? 0,
        canceladas: canceladasCount ?? 0,
      }}
      nickname={conn.nickname}
    />
  )
}
