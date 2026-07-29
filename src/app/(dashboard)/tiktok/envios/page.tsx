import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, type ShipmentRow } from './envios-view'

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

export default async function TiktokEnviosPage({
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
        <TopBar title="Envios — TikTok Shop" />
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

  const [summaryRes, listRes] = await Promise.all([
    supabase.rpc('tt_shipments_summary', { p_from: from, p_to: to }),
    supabase.rpc('tt_shipments_list', {
      p_from: from,
      p_to: to,
      p_status: status || null,
      p_search: search || null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
  ])

  const s = (summaryRes.data ?? {}) as { enviado?: number; concluido?: number; a_enviar?: number; cancelado?: number; sem_rastreio?: number }

  return (
    <EnviosView
      summary={{
        enviado: Number(s.enviado ?? 0),
        concluido: Number(s.concluido ?? 0),
        aEnviar: Number(s.a_enviar ?? 0),
        cancelado: Number(s.cancelado ?? 0),
        semRastreio: Number(s.sem_rastreio ?? 0),
      }}
      shipments={(listRes.data ?? []) as ShipmentRow[]}
      page={page}
      period={period}
      status={status}
      search={search}
    />
  )
}
