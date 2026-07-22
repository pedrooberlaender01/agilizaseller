import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { FinanceiroView, type StatementRow } from './financeiro-view'

export const revalidate = 60

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}
function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : null
}
function periodRangeIso(period: Period, cf: string | null, ct: string | null): { from: string; to: string } {
  const now = new Date()
  if (period === 'custom' && cf && ct) {
    const f = new Date(cf + 'T00:00:00-03:00')
    const t = new Date(ct + 'T00:00:00-03:00')
    t.setDate(t.getDate() + 1)
    return { from: f.toISOString(), to: t.toISOString() }
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return { from: d.toISOString(), to: now.toISOString() }
}

function NoConnectionState() {
  return (
    <>
      <TopBar title="Financeiro — TikTok Shop" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="border border-zinc-800 bg-zinc-900/40 flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-zinc-50">link_off</span>
          <h2 className="text-h2 font-semibold text-zinc-50">Sem conexão TikTok Shop ativa</h2>
          <Link href="/configuracoes" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100">
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function TiktokFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; page?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'tiktok_shop')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const { from, to } = periodRangeIso(period, customFrom, customTo)
  const offset = (page - 1) * PAGE_SIZE

  const [kpiResult, affiliateResult, listResult] = await Promise.all([
    supabase.rpc('tt_finance_realtime', { p_from: from, p_to: to }),
    supabase.rpc('tt_affiliate_realtime', { p_from: from, p_to: to }),
    supabase
      .from('tt_settlements')
      .select('statement_id, settlement_amount, fee, revenue, currency, statement_time, raw', { count: 'exact' })
      .eq('connection_id', conn.id)
      .gte('statement_time', from)
      .lt('statement_time', to)
      .order('statement_time', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ])

  const kpi = (kpiResult.data ?? { statements: 0, repasse: 0, taxas: 0, receita: 0 }) as {
    statements: number; repasse: number | string; taxas: number | string; receita: number | string
  }
  const af = (affiliateResult.data ?? {}) as { affiliate_commission?: number | string }
  const affiliateCommission = Number(af.affiliate_commission ?? 0)

  return (
    <FinanceiroView
      kpi={{
        statements: Number(kpi.statements ?? 0),
        repasse: Number(kpi.repasse ?? 0),
        taxas: Number(kpi.taxas ?? 0),
        receita: Number(kpi.receita ?? 0),
        afiliados: affiliateCommission,
      }}
      statements={(listResult.data ?? []) as StatementRow[]}
      totalCount={listResult.count ?? 0}
      page={page}
      period={period}
      customFrom={period === 'custom' ? customFrom : null}
      customTo={period === 'custom' ? customTo : null}
    />
  )
}
