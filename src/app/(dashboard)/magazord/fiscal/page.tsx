import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { FiscalView, type InvoiceRow } from './fiscal-view'

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

export default async function MagazordFiscalPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string
    tipo?: string
    situacao?: string
    q?: string
    page?: string
  }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const tipoFilter = (sp.tipo ?? '').trim()
  const situacaoFilter = (sp.situacao ?? '').trim()
  const search = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page ?? 1) || 1)

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
        <TopBar title="Fiscal — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-outline">Sem conexão Magazord ativa.</p>
        </main>
      </>
    )
  }

  const offset = (page - 1) * PAGE_SIZE
  let query = supabase
    .from('mag_invoices')
    .select('*', { count: 'exact' })
    .eq('connection_id', conn.id)

  const cutoff = periodCutoffIso(period)
  if (cutoff) query = query.gte('data_emissao', cutoff)

  if (tipoFilter !== '') {
    const tipoNum = Number(tipoFilter)
    if (Number.isFinite(tipoNum)) query = query.eq('tipo', tipoNum)
  }

  if (situacaoFilter !== '') {
    const situacoes = situacaoFilter.split(',').map((s) => Number(s)).filter((n) => Number.isFinite(n))
    if (situacoes.length > 0) query = query.in('situacao', situacoes)
  }

  if (search) {
    const term = search.replace(/%/g, '')
    query = query.or(
      `chave.ilike.%${term}%,identificador.ilike.%${term}%`,
    )
  }

  const { data, count } = await query
    .order('data_emissao', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  return (
    <FiscalView
      invoices={(data ?? []) as InvoiceRow[]}
      totalCount={count ?? 0}
      page={page}
      period={period}
      tipo={tipoFilter}
      situacao={situacaoFilter}
      search={search}
      nickname={conn.nickname}
    />
  )
}
