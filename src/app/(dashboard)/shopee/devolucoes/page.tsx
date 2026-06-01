import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { ShopeeReturn } from '@/types'
import { DevolucoesView, type DevolucoesPeriod } from './devolucoes-view'

function parsePeriod(raw: string | undefined): DevolucoesPeriod {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes' || raw === 'custom') return raw
  return '30d'
}

function periodRange(period: DevolucoesPeriod, customFrom?: string, customTo?: string): { from: string; to: string } {
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
      <TopBar title="Devoluções — Shopee" />
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

export default async function ShopeeDevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const statusFilter = sp.status || 'all'
  const customFrom = sp.from
  const customTo = sp.to
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

  async function fetchAllReturns(): Promise<ShopeeReturn[]> {
    const all: ShopeeReturn[] = []
    for (let page = 0; page < 20; page++) {
      const start = page * 1000
      const { data } = await supabase
        .from('shopee_returns')
        .select('*')
        .eq('connection_id', connId)
        .gte('create_time', from)
        .lte('create_time', to)
        .order('create_time', { ascending: false })
        .range(start, start + 999)
      if (!data || data.length === 0) break
      all.push(...(data as ShopeeReturn[]))
      if (data.length < 1000) break
    }
    return all
  }

  const [returns, { count: ordersCount }] = await Promise.all([
    fetchAllReturns(),
    supabase
      .from('shopee_orders')
      .select('id', { count: 'exact', head: true })
      .eq('connection_id', connId)
      .gte('date_created', from)
      .lte('date_created', to),
  ])

  return (
    <DevolucoesView
      returns={returns}
      ordersCount={ordersCount ?? 0}
      period={period}
      statusFilter={statusFilter}
      customFrom={customFrom ?? null}
      customTo={customTo ?? null}
      nickname={conn.nickname}
    />
  )
}
