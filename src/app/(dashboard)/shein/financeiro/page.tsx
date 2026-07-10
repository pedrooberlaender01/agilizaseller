import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { FinanceiroView, type SettlementRow } from './financeiro-view'

export const revalidate = 60

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'all' | 'mes' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === '90d' || raw === 'all' || raw === 'mes' || raw === 'custom') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

function periodRangeIso(period: Period, customFrom: string | null, customTo: string | null): { from: string | null; to: string | null } {
  if (period === 'all') return { from: null, to: null }
  const today = new Date()
  const toIso = today.toISOString()
  if (period === 'custom' && customFrom && customTo) {
    // BRT (data local BR) — bate painel Meus Pedidos Shein.
    const f = new Date(customFrom + 'T00:00:00-03:00')
    const t = new Date(customTo + 'T00:00:00-03:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  if (period === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: start.toISOString(), to: toIso }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date(today)
  d.setDate(d.getDate() - days + 1)
  d.setHours(0, 0, 0, 0)
  return { from: d.toISOString(), to: toIso }
}

export default async function SheinFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; q?: string; page?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Financeiro — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  const { from, to } = periodRangeIso(period, customFrom, customTo)
  let query = supabase
    .from('shein_settlements_enriched')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  if (from) query = query.gte('settlement_date', from)
  if (to) query = query.lte('settlement_date', to)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`settlement_id.ilike.%${term}%,order_no.ilike.%${term}%`)
  }

  const { data, count } = await query
    .order('settlement_date', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  return (
    <FinanceiroView
      rows={(data ?? []) as SettlementRow[]}
      totalCount={count ?? 0}
      page={page}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      search={search}
      nickname={conn.nickname}
    />
  )
}
