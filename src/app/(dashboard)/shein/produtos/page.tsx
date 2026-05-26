import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { ProdutosView, type ProductRow } from './produtos-view'

const PAGE_SIZE = 50

export default async function SheinProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const statusFilter = (sp.status ?? '').trim()
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
    .from('shein_products')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`sku_code.ilike.%${term}%,spu.ilike.%${term}%,product_name.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: statusRows } = await supabase
    .from('shein_products')
    .select('status')
    .eq('connection_id', conn.id)
    .not('status', 'is', null)
    .neq('status', '')

  const uniqueStatuses = Array.from(
    new Set((statusRows ?? []).map((r) => r.status as string)),
  ).sort()

  return (
    <ProdutosView
      products={(data ?? []) as ProductRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      status={statusFilter}
      statuses={uniqueStatuses}
    />
  )
}
