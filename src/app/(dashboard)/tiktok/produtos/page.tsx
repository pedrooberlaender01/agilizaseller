import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { ProdutosView, type ProductRow } from './produtos-view'

export const revalidate = 60

const PAGE_SIZE = 50

function NoConnectionState() {
  return (
    <>
      <TopBar title="Produtos — TikTok Shop" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="border border-zinc-800 bg-zinc-900/40 flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-zinc-50">link_off</span>
          <h2 className="text-h2 font-semibold text-zinc-50">Sem conexão TikTok Shop ativa</h2>
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

export default async function TiktokProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
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
  let query = supabase
    .from('tt_products')
    .select('id, product_id, title, status, price, stock', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`title.ilike.%${term}%,product_id.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  // status distintos (catalogo pequeno, dedupe client-side)
  const { data: allStatus } = await supabase
    .from('tt_products')
    .select('status')
    .eq('connection_id', conn.id)
  const statuses = Array.from(
    new Set(((allStatus ?? []) as Array<{ status: string | null }>).map((r) => r.status).filter((s): s is string => !!s)),
  ).sort()

  return (
    <ProdutosView
      products={(data ?? []) as ProductRow[]}
      totalCount={count ?? 0}
      page={page}
      status={statusFilter}
      search={search}
      statuses={statuses}
    />
  )
}
