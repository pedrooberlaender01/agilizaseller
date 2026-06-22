import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { ProdutosView, type ProductRow } from './produtos-view'

export const revalidate = 60

const PAGE_SIZE = 50

export default async function SheinProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; cost?: string; sort?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const statusFilter = (sp.status ?? '').trim()
  const costFilter = (sp.cost ?? '').trim() // '', 'missing', 'set'
  const sort = (sp.sort ?? 'recent').trim() // 'recent' | 'margin_desc' | 'margin_asc' | 'revenue'
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Produtos — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shein_sku_margins')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (costFilter === 'missing') query = query.is('cost_price', null)
  if (costFilter === 'set') query = query.not('cost_price', 'is', null)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`sku_code.ilike.%${term}%,spu.ilike.%${term}%,product_name.ilike.%${term}%`)
  }

  if (sort === 'margin_desc') query = query.order('real_margin_pct', { ascending: false, nullsFirst: false })
  else if (sort === 'margin_asc') query = query.order('real_margin_pct', { ascending: true, nullsFirst: false })
  else if (sort === 'revenue') query = query.order('gross_revenue', { ascending: false, nullsFirst: false })
  else query = query.order('cost_updated_at', { ascending: false, nullsFirst: true })

  const [pageResult, statsResult] = await Promise.all([
    query.range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('shein_produtos_stats', { p_connection_id: conn.id }),
  ])
  const { data, count } = pageResult
  const statsRow = (statsResult.data ?? [])[0] as {
    total: number | string | null
    with_cost: number | string | null
    statuses: string[] | null
  } | undefined
  const totalProducts = Number(statsRow?.total ?? 0)
  const withCost = Number(statsRow?.with_cost ?? 0)
  const uniqueStatuses = statsRow?.statuses ?? []

  return (
    <ProdutosView
      products={(data ?? []) as ProductRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      status={statusFilter}
      statuses={uniqueStatuses}
      costFilter={costFilter}
      sort={sort}
      stats={{
        withCost: withCost ?? 0,
        totalProducts: totalProducts ?? 0,
      }}
    />
  )
}
