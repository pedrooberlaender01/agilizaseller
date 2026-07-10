import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { ProdutosView, type ProductRow } from './produtos-view'

export const revalidate = 60

const PAGE_SIZE = 50

export default async function ShopeeProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; sort?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const statusFilter = (sp.status ?? '').trim()
  const sort = (sp.sort ?? 'sold_desc').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Produtos — Shopee" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shopee ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shopee_items')
    .select('id, external_id, item_sku, title, price, currency, stock, sold_quantity, item_status, raw_payload, synced_at', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (statusFilter) query = query.eq('item_status', statusFilter)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`item_sku.ilike.%${term}%,title.ilike.%${term}%,external_id.ilike.%${term}%`)
  }

  if (sort === 'sold_desc') query = query.order('sold_quantity', { ascending: false, nullsFirst: false })
  else if (sort === 'stock_asc') query = query.order('stock', { ascending: true, nullsFirst: false })
  else if (sort === 'stock_desc') query = query.order('stock', { ascending: false, nullsFirst: false })
  else if (sort === 'price_desc') query = query.order('price', { ascending: false, nullsFirst: false })
  else if (sort === 'price_asc') query = query.order('price', { ascending: true, nullsFirst: false })
  else query = query.order('synced_at', { ascending: false, nullsFirst: false })

  const [{ data, count }, { data: statusesRow }, { data: totals }] = await Promise.all([
    query.range(offset, offset + PAGE_SIZE - 1),
    supabase.from('shopee_items').select('item_status').eq('connection_id', conn.id),
    supabase.from('shopee_items').select('stock, sold_quantity').eq('connection_id', conn.id),
  ])

  const uniqueStatuses = Array.from(new Set((statusesRow ?? []).map(r => r.item_status).filter(Boolean) as string[]))
  const ativos = (statusesRow ?? []).filter(r => r.item_status === 'NORMAL').length
  const naoPublicados = (statusesRow ?? []).filter(r => r.item_status === 'UNLIST').length
  const totalStock = (totals ?? []).reduce((a, r) => a + (Number(r.stock) || 0), 0)
  const totalSold = (totals ?? []).reduce((a, r) => a + (Number(r.sold_quantity) || 0), 0)

  const rows: ProductRow[] = (data ?? []).map((r) => {
    const raw = r.raw_payload as { image?: { image_url_list?: string[] } } | null
    const image_url = raw?.image?.image_url_list?.[0] ?? null
    return {
      id: r.id as string,
      external_id: r.external_id as string,
      item_sku: r.item_sku as string | null,
      title: r.title as string,
      price: r.price as number | string | null,
      currency: r.currency as string | null,
      stock: r.stock as number | null,
      sold_quantity: r.sold_quantity as number | null,
      item_status: r.item_status as string | null,
      image_url,
    }
  })

  return (
    <ProdutosView
      products={rows}
      totalCount={count ?? 0}
      page={page}
      search={search}
      status={statusFilter}
      statuses={uniqueStatuses}
      sort={sort}
      stats={{ totalProducts: count ?? 0, totalStock, totalSold, ativos, naoPublicados }}
    />
  )
}
