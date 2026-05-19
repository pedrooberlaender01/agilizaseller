import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { FinanceiroView, type SettlementRow } from './financeiro-view'

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'all'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'all' ? raw : '30d'
}

function periodCutoffIso(period: Period): string | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export default async function SheinFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
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
          <p className="text-sm text-outline">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('shein_settlements')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  const cutoff = periodCutoffIso(period)
  if (cutoff) query = query.gte('settlement_date', cutoff)
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
      search={search}
      nickname={conn.nickname}
    />
  )
}
