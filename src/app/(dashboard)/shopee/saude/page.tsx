import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { ShopeeAccountHealth } from '@/types'
import { SaudeView, type HistoryPoint, type PeriodDays } from './saude-view'

function parsePeriod(raw: string | undefined): PeriodDays {
  if (raw === '60d') return 60
  if (raw === '90d') return 90
  return 30
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Saúde — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações para começar a sincronizar saúde da conta.
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

export default async function ShopeeSaudePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - period)
  const fromIso = fromDate.toISOString()

  const [latestRes, historyRes] = await Promise.all([
    supabase
      .from('shopee_account_health')
      .select('*')
      .eq('connection_id', conn.id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('shopee_account_health')
      .select('snapshot_at, penalty_points, listing_violation_count, overall_performance_rating')
      .eq('connection_id', conn.id)
      .gte('snapshot_at', fromIso)
      .order('snapshot_at', { ascending: true }),
  ])

  const latest = (latestRes.data as ShopeeAccountHealth | null) ?? null
  const history = (historyRes.data ?? []) as HistoryPoint[]

  return (
    <SaudeView
      latest={latest}
      history={history}
      period={period}
      nickname={conn.nickname}
    />
  )
}
