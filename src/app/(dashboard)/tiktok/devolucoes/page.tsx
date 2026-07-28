import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { DevolucoesView, type ReturnRow } from './devolucoes-view'

export const revalidate = 60

const PAGE_SIZE = 50

type Period = '7d' | '30d' | '90d'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' ? raw : '30d'
}
function periodRangeIso(period: Period): { from: string; to: string } {
  const now = new Date()
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return { from: d.toISOString(), to: now.toISOString() }
}

export default async function TiktokDevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const status = (sp.status ?? '').trim()
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'tiktok_shop')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Devoluções — TikTok Shop" />
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

  const { from, to } = periodRangeIso(period)
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('tt_returns')
    .select('return_id, order_id, return_type, return_status, return_reason_text, role, refund_amount, currency, create_time', { count: 'exact' })
    .eq('connection_id', conn.id)
    .gte('create_time', from)
    .lt('create_time', to)

  if (status) query = query.eq('return_status', status)
  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(`return_id.ilike.%${term}%,order_id.ilike.%${term}%`)
  }

  const [summaryRes, listRes, statusRes] = await Promise.all([
    supabase.rpc('tt_returns_summary', { p_from: from, p_to: to }),
    query.order('create_time', { ascending: false, nullsFirst: false }).range(offset, offset + PAGE_SIZE - 1),
    supabase.from('tt_returns').select('return_status').eq('connection_id', conn.id),
  ])

  const s = (summaryRes.data ?? {}) as { total?: number; valor_perdido?: number | string; reembolsadas?: number; pendentes?: number; em_disputa?: number; top_motivo?: string }
  const statuses = Array.from(
    new Set(((statusRes.data ?? []) as Array<{ return_status: string | null }>).map((r) => r.return_status).filter((x): x is string => !!x)),
  ).sort()

  return (
    <DevolucoesView
      summary={{
        total: Number(s.total ?? 0),
        valorPerdido: Number(s.valor_perdido ?? 0),
        reembolsadas: Number(s.reembolsadas ?? 0),
        pendentes: Number(s.pendentes ?? 0),
        emDisputa: Number(s.em_disputa ?? 0),
        topMotivo: s.top_motivo ?? null,
      }}
      returns={(listRes.data ?? []) as ReturnRow[]}
      totalCount={listRes.count ?? 0}
      page={page}
      period={period}
      status={status}
      search={search}
      statuses={statuses}
    />
  )
}
