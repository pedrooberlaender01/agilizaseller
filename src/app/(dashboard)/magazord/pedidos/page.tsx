import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { PedidosView, type OrderRow } from './pedidos-view'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' ? raw : '30d'
}

function periodCutoffIso(period: Period): string {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Pedidos — Magazord" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
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
  searchParams: Promise<{ period?: string; situacao?: string; q?: string; page?: string; mkt?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const situacaoFilter = (sp.situacao ?? '').trim()
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
    .select('*, mag_order_items(count)', { count: 'exact' })
    .eq('connection_id', conn.id)
    .gte('data_hora', periodCutoffIso(period))

  if (situacaoFilter) {
    const situacoes = situacaoFilter.split(',').map((s) => Number(s)).filter((n) => Number.isFinite(n))
    if (situacoes.length > 0) query = query.in('situacao', situacoes)
  }
  if (marketplaceFilter) {
    query = query.eq('marketplace_origem', marketplaceFilter)
  }
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,pessoa_nome.ilike.%${term}%,codigo_marketplace.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('data_hora', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const { data: marketplaces } = await supabase
    .from('mag_orders')
    .select('marketplace_origem')
    .eq('connection_id', conn.id)
    .not('marketplace_origem', 'is', null)
    .neq('marketplace_origem', '')

  const uniqueMarketplaces = Array.from(
    new Set((marketplaces ?? []).map((r) => r.marketplace_origem as string)),
  ).sort()

  return (
    <PedidosView
      orders={(data ?? []) as OrderRow[]}
      totalCount={count ?? 0}
      page={page}
      period={period}
      situacao={situacaoFilter}
      marketplace={marketplaceFilter}
      search={search}
      marketplaces={uniqueMarketplaces}
    />
  )
}
