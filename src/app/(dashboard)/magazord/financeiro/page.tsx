import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { FinanceiroView, type ContaReceber, type ContaPagar, type FormaRow, type Resumo } from './financeiro-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Period = '7d' | '30d' | '90d' | 'custom'

function parsePeriod(raw: string | undefined): Period {
  return raw === '7d' || raw === '90d' || raw === 'custom' ? raw : '30d'
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateOnly(s: string | undefined): string | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export default async function MagazordFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  let period = parsePeriod(sp.period)
  const fromParam = parseDateOnly(sp.from)
  const toParam = parseDateOnly(sp.to)

  let inicio: string
  let fim: string
  if (period === 'custom' && fromParam && toParam) {
    inicio = fromParam
    fim = toParam
  } else {
    if (period === 'custom') period = '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const d = new Date()
    d.setDate(d.getDate() - days)
    inicio = isoDate(d)
    fim = isoDate(new Date())
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
        <TopBar title="Financeiro — Magazord" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-outline">Sem conexão Magazord ativa.</p>
        </main>
      </>
    )
  }

  const [{ data: resumoRows }, { data: formasRows }, { data: receberRows }, { data: pagarRows }] = await Promise.all([
    supabase.rpc('mag_financeiro_resumo', { p_connection_id: conn.id, p_inicio: inicio, p_fim: fim }),
    supabase.rpc('mag_financeiro_formas', { p_connection_id: conn.id, p_inicio: inicio, p_fim: fim }),
    supabase
      .from('mag_contas_receber')
      .select('titulo_id, numero, pessoa_nome, pedido_codigo, valor_original, valor_liquidado, saldo, data_vencimento, data_geracao, situacao_descricao, forma_recebimento_nome, parcela')
      .eq('connection_id', conn.id)
      .order('data_geracao', { ascending: false })
      .limit(100),
    supabase
      .from('mag_contas_pagar')
      .select('titulo_id, numero, pessoa_nome, valor_original, valor_liquidado, saldo, data_vencimento, data_geracao, situacao_descricao')
      .eq('connection_id', conn.id)
      .order('data_geracao', { ascending: false })
      .limit(100),
  ])

  const resumo = ((resumoRows ?? [])[0] ?? {}) as Resumo

  return (
    <FinanceiroView
      period={period}
      from={fromParam}
      to={toParam}
      resumo={resumo}
      formas={(formasRows ?? []) as FormaRow[]}
      receber={(receberRows ?? []) as ContaReceber[]}
      pagar={(pagarRows ?? []) as ContaPagar[]}
      nickname={conn.nickname}
    />
  )
}
