import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { MetricasView, type DailyMetric } from './metricas-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}

// Boundaries no fuso BRT (-03:00). Magazord opera em horário de Brasília;
// usar UTC desloca pedidos entre dias (bug antigo).
function isoBRTStart(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}T00:00:00-03:00`
}

function isoBRTEnd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}T23:59:59-03:00`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function parseIsoDateOnly(s: string | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [, y, mo, da] = m
  const d = new Date(Number(y), Number(mo) - 1, Number(da))
  if (Number.isNaN(d.getTime())) return null
  return d
}

function periodCutoff(period: Period): Date {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export default async function MagazordMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; mkt?: string; origem?: string }>
}) {
  const sp = await searchParams
  let period = parsePeriod(sp.period)

  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  // Multi-select: lista separada por virgula (vazio = todos)
  const mktList = (sp.mkt ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const origemRaw = (sp.origem ?? '').trim()
  const origemFilter = origemRaw && /^[0-9]+$/.test(origemRaw) ? Number(origemRaw) : null

  let cutoff: Date
  let endAt: Date | null = null

  if (period === 'custom' && customFrom && customTo) {
    cutoff = startOfDay(customFrom)
    endAt = endOfDay(customTo)
  } else if (customFrom && customTo) {
    period = 'custom'
    cutoff = startOfDay(customFrom)
    endAt = endOfDay(customTo)
  } else {
    if (period === 'custom') period = '30d'
    cutoff = periodCutoff(period)
  }

  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'magazord')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Métricas — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-outline">Sem conexão Magazord ativa.</p>
        </main>
      </>
    )
  }

  const [{ data: rawRows, error }, { data: mktRows }, { data: freteRaw }] = await Promise.all([
    supabase.rpc('mag_faturamento_realtime', {
      p_connection_id: conn.id,
      p_cutoff: isoBRTStart(cutoff),
      p_end: endAt ? isoBRTEnd(endAt) : null,
      p_marketplace: null,
      p_origem: origemFilter,
    }),
    supabase.rpc('mag_marketplaces', { p_connection_id: conn.id }),
    // Frete = valorFreteTransportadora, pedidos situacao 4,5,6,7,8,12, por data do pedido
    supabase.rpc('mag_frete_realtime', {
      p_connection_id: conn.id,
      p_cutoff: isoBRTStart(cutoff),
      p_end: endAt ? isoBRTEnd(endAt) : null,
      p_marketplace: null,
      p_origem: origemFilter,
    }),
  ])

  const freteRows = ((freteRaw ?? []) as Array<{ marketplace_origem: string | null; frete: number | string }>).map(
    (r) => ({ marketplace_origem: r.marketplace_origem, frete: Number(r.frete) }),
  )

  // Eixo = data de faturamento (emissão NF venda). Mapeia p/ shape da view.
  const rows = ((rawRows ?? []) as Array<{
    connection_id: string
    date: string
    origem: number | null
    marketplace_origem: string | null
    orders_faturados: number
    faturamento: number | string
    total_frete: number | string
    ticket_medio: number | string
  }>).map((r) => ({
    connection_id: r.connection_id,
    date: r.date,
    origem: r.origem,
    marketplace_origem: r.marketplace_origem,
    orders_count: r.orders_faturados,
    orders_cancelled_count: 0,
    orders_aprovados_count: r.orders_faturados,
    gross_revenue: r.faturamento,
    total_frete: r.total_frete,
    total_desconto: 0,
    ticket_medio: r.ticket_medio,
  }))

  if (error) {
    return (
      <>
        <TopBar title="Métricas — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-error">Erro ao calcular métricas: {error.message}</p>
        </main>
      </>
    )
  }

  const marketplaces = ((mktRows ?? []) as Array<{ marketplace: string }>).map((r) => r.marketplace)

  return (
    <MetricasView
      rows={(rows ?? []) as DailyMetric[]}
      period={period}
      from={customFrom ? customFrom.toISOString().slice(0, 10) : null}
      to={customTo ? customTo.toISOString().slice(0, 10) : null}
      mkt={mktList}
      marketplaces={marketplaces}
      origem={origemFilter}
      nickname={conn.nickname}
      freteRows={freteRows}
    />
  )
}
