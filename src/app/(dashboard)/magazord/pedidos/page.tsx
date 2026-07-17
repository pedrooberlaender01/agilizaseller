import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { PedidosView, type OrderRow } from './pedidos-view'

const PAGE_SIZE = 50

// Situacoes faturaveis (padrao): Aprovado, Aprovado e Integrado, NF Emitida,
// Transporte, Entregue, Aprovado Analise Pagto. Mesma base de /metricas.
const SITUACOES_FATURAVEIS = [4, 5, 6, 7, 8, 12]

type Period = '7d' | '30d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === 'custom' ? raw : '30d'
}

function periodCutoffIso(period: '7d' | '30d'): string {
  const days = period === '7d' ? 7 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// Range personalizado no fuso BRT (-03:00)
const isDateOnly = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const brtStart = (d: string) => `${d}T00:00:00-03:00`
const brtEnd = (d: string) => `${d}T23:59:59-03:00`

function NoConnectionState() {
  return (
    <>
      <TopBar title="Pedidos — Magazord" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="flex max-w-md flex-col items-center gap-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Magazord ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Configure a conexão Magazord em Configurações para começar a sincronizar pedidos.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-sm font-medium text-on-tertiary transition-colors hover:bg-tertiary/90"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function MagazordPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; situacao?: string; origem?: string; from?: string; to?: string; q?: string; page?: string; mkt?: string }>
}) {
  const sp = await searchParams
  let period = parsePeriod(sp.period)
  const fromParam = isDateOnly(sp.from) ? sp.from : null
  const toParam = isDateOnly(sp.to) ? sp.to : null
  let cutoffIso: string
  let endIso: string | null = null
  if (period === 'custom' && fromParam && toParam) {
    cutoffIso = brtStart(fromParam)
    endIso = brtEnd(toParam)
  } else {
    if (period === 'custom') period = '30d'
    cutoffIso = periodCutoffIso(period)
  }
  // Situacao: sem param = faturaveis (padrao); 'all' = todas; senao csv escolhido
  const situacaoParam = (sp.situacao ?? '').trim()
  const situacoes =
    situacaoParam === '' ? SITUACOES_FATURAVEIS
    : situacaoParam === 'all' ? []
    : situacaoParam.split(',').map(Number).filter(Number.isFinite)
  // Origem: sem param = Site (1); 'all' = todas
  const origemParam = (sp.origem ?? '1').trim()
  const origemFilter = origemParam === 'all' ? null : /^[0-9]+$/.test(origemParam) ? Number(origemParam) : 1
  const marketplaceFilter = (sp.mkt ?? '').trim()
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'magazord')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('mag_orders')
    .select(
      '*, mag_order_items(codigo_produto, codigo_derivacao, titulo, quantidade, valor_unitario, valor_desconto, valor_acrescimo, brinde, presente)',
      { count: 'exact' },
    )
    .eq('connection_id', conn.id)
    .gte('data_hora', cutoffIso)

  if (endIso) query = query.lte('data_hora', endIso)
  if (situacoes.length > 0) query = query.in('situacao', situacoes)
  if (origemFilter != null) query = query.eq('origem', origemFilter)
  if (marketplaceFilter) {
    query = query.eq('marketplace_origem', marketplaceFilter)
  }
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,pessoa_nome.ilike.%${term}%,codigo_marketplace.ilike.%${term}%`)
  }

  const [pageResult, marketplacesResult] = await Promise.all([
    query
      .order('data_hora', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('mag_marketplaces', { p_connection_id: conn.id }),
  ])
  const { data, count } = pageResult
  const uniqueMarketplaces = ((marketplacesResult.data ?? []) as Array<{ marketplace: string | null }>)
    .map((r) => r.marketplace)
    .filter((m): m is string => !!m)
    .sort()

  return (
    <PedidosView
      orders={(data ?? []) as OrderRow[]}
      totalCount={count ?? 0}
      page={page}
      period={period}
      from={fromParam}
      to={toParam}
      situacao={situacoes.join(',')}
      origem={origemFilter}
      marketplace={marketplaceFilter}
      search={search}
      marketplaces={uniqueMarketplaces}
    />
  )
}
