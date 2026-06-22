import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { ShopeeWalletTransaction, ShopeePayout, ShopeeDailyMetric } from '@/types'
import type { Period } from '@/components/metrics-chart'
import { FinanceiroView } from './financeiro-view'

export const revalidate = 60

export type FinanceiroPeriod = Period | 'custom'

function parsePeriod(raw: string | undefined): FinanceiroPeriod {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes' || raw === 'custom') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}

function periodRange(period: FinanceiroPeriod, customFrom: string | null, customTo: string | null): { from: string; to: string } {
  const today = new Date()
  const toStr = today.toISOString()
  if (period === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom + 'T00:00:00')
    const t = new Date(customTo + 'T23:59:59')
    return { from: f.toISOString(), to: t.toISOString() }
  }
  if (period === 'mes') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: start.toISOString(), to: toStr }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const from = new Date(today)
  from.setDate(from.getDate() - days + 1)
  from.setHours(0, 0, 0, 0)
  return { from: from.toISOString(), to: toStr }
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Financeiro — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-sm font-medium text-on-tertiary"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function ShopeeFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; type?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const typeFilter = sp.type || 'all'
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />
  const connId = conn.id

  const { from, to } = periodRange(period, customFrom, customTo)

  // Supabase JS hard cap 1000/query → paginar manual
  async function fetchAllTransactions(): Promise<ShopeeWalletTransaction[]> {
    const all: ShopeeWalletTransaction[] = []
    for (let page = 0; page < 20; page++) {
      const start = page * 1000
      const { data } = await supabase
        .from('shopee_wallet_transactions')
        .select('*')
        .eq('connection_id', connId)
        .gte('create_time', from)
        .lte('create_time', to)
        .order('create_time', { ascending: false })
        .range(start, start + 999)
      if (!data || data.length === 0) break
      all.push(...(data as ShopeeWalletTransaction[]))
      if (data.length < 1000) break
    }
    return all
  }

  const fromDate = from.slice(0, 10)
  const toDate = to.slice(0, 10)

  const [txRows, { data: payoutRows }, { data: latestTx }, { data: dailyRows }] = await Promise.all([
    fetchAllTransactions(),
    supabase
      .from('shopee_payouts')
      .select('*')
      .eq('connection_id', conn.id)
      .order('payout_time', { ascending: false })
      .limit(50),
    supabase
      .from('shopee_wallet_transactions')
      .select('current_balance_cents, create_time')
      .eq('connection_id', conn.id)
      .not('current_balance_cents', 'is', null)
      .order('create_time', { ascending: false })
      .limit(1),
    supabase
      .from('shopee_daily_metrics')
      .select('*')
      .eq('connection_id', conn.id)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true }),
  ])

  return (
    <FinanceiroView
      transactions={txRows}
      payouts={(payoutRows ?? []) as ShopeePayout[]}
      latestBalanceCents={
        latestTx && latestTx[0]?.current_balance_cents != null
          ? Number(latestTx[0].current_balance_cents)
          : null
      }
      dailyMetrics={(dailyRows ?? []) as ShopeeDailyMetric[]}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
      typeFilter={typeFilter}
      nickname={conn.nickname}
    />
  )
}
