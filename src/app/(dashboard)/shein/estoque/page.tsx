import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EstoqueView, type StockRow } from './estoque-view'

export const revalidate = 60

const PAGE_SIZE = 50

export default async function SheinEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; warehouse?: string; baixo?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const warehouseFilter = (sp.warehouse ?? '').trim()
  const baixo = sp.baixo === 'true'
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
        <TopBar title="Estoque — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shein_stock_enriched')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (warehouseFilter) query = query.eq('warehouse', warehouseFilter)
  if (baixo) query = query.lte('available_qty', 5)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`sku_code.ilike.%${term}%,product_name.ilike.%${term}%`)
  }

  const [pageResult, whResult] = await Promise.all([
    query
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('shein_distinct_warehouses', { p_connection_id: conn.id }),
  ])
  const { data, count } = pageResult
  const warehouses = ((whResult.data ?? []) as Array<{ warehouse: string | null }>)
    .map((r) => r.warehouse)
    .filter((w): w is string => !!w)

  return (
    <EstoqueView
      stock={(data ?? []) as StockRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      warehouse={warehouseFilter}
      baixo={baixo}
      warehouses={warehouses}
    />
  )
}
