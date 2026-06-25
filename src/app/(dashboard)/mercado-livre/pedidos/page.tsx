import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { PedidosView, type MlOrderRow } from './pedidos-view'

export const revalidate = 60

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

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Pedidos — Mercado Livre" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Mercado Livre ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Mercado Livre em Configurações para começar a sincronizar pedidos.
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

export default async function MercadoLivrePedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; q?: string; page?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const isCustom = !!(customFrom && customTo)
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'mercado_livre')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />
  const connId = conn.id

  // Offset -03:00 (BRT) alinha a janela com o dia local. Sem isso 'T00:00:00' vira UTC e desloca ~3h.
  const fromIso = isCustom ? `${customFrom}T00:00:00-03:00` : periodCutoffIso(period)
  const toIso = isCustom ? `${customTo}T23:59:59-03:00` : null

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('ml_orders')
    .select(
      '*, ml_order_items(count), order_margins(gross_profit, margin_pct, cost_missing), ml_shipments(status, tracking_number)',
      { count: 'exact' },
    )
    .eq('connection_id', connId)
    .gte('date_created', fromIso)
  if (toIso) query = query.lte('date_created', toIso)

  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`external_id.ilike.%${term}%,buyer_nickname.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('date_created', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  // KPIs agregados via RPC no Postgres (evita cap de 1000 linhas; margens vazias → lucro "—")
  const { data: kpiData } = await supabase.rpc('ml_daily_metrics', {
    p_connection_id: connId,
    p_from: fromIso,
    p_to: toIso,
  })
  const krows = (kpiData ?? []) as { pedidos: number; cancel: number; fat: number | string }[]
  let totalOrders = 0
  let cancelled = 0
  let totalRevenue = 0
  for (const r of krows) {
    totalOrders += r.pedidos
    cancelled += r.cancel
    totalRevenue += Number(r.fat) || 0
  }
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return (
    <PedidosView
      orders={(data ?? []) as unknown as MlOrderRow[]}
      totalCount={count ?? 0}
      page={page}
      period={period}
      search={search}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
      kpis={{ totalOrders, totalRevenue, avgTicket, cancelled }}
    />
  )
}
