import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EstoqueView, type StockRow } from './estoque-view'

const PAGE_SIZE = 50

export default async function MagazordEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; deposito?: string; baixo?: string }>
}) {
  const sp = await searchParams
  const search = (sp.q ?? '').trim()
  const deposito = sp.deposito ? Number(sp.deposito) : null
  const baixo = sp.baixo === 'true'
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
        <TopBar title="Estoque — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-outline">Sem conexão Magazord ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('mag_stock')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (deposito !== null && Number.isFinite(deposito)) query = query.eq('deposito', deposito)
  if (baixo) query = query.lte('saldo_fisico', 5)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.ilike('codigo_produto', `%${term}%`)
  }

  const [pageResult, depositosResult] = await Promise.all([
    query
      .order('data_hora_atualizacao', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('mag_distinct_depositos', { p_connection_id: conn.id }),
  ])
  const { data, count } = pageResult
  const uniqueDepositos = ((depositosResult.data ?? []) as Array<{ deposito: number | null }>)
    .map((r) => r.deposito)
    .filter((d): d is number => d !== null)

  return (
    <EstoqueView
      stock={(data ?? []) as StockRow[]}
      totalCount={count ?? 0}
      page={page}
      search={search}
      deposito={deposito}
      baixo={baixo}
      depositos={uniqueDepositos}
    />
  )
}
