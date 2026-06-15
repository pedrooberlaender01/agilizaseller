import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { ProdutosView, type ProductRow } from './produtos-view'

const PAGE_SIZE = 50

export default async function MagazordProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; ativo?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const ativo = sp.ativo === 'false' ? false : sp.ativo === 'true' ? true : null
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'magazord')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Produtos — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-outline">Sem conexão Magazord ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('mag_products')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (ativo !== null) query = query.eq('ativo', ativo)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`codigo.ilike.%${term}%,nome.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  return (
    <ProdutosView
      products={(data ?? []) as ProductRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      ativo={ativo}
    />
  )
}
