import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { Period } from '@/components/metrics-chart'
import { FinanceiroView, type FinDailyRow, type PaymentMixRow } from './financeiro-view'
import type { AffiliateEntry } from '@/app/actions/mercadolivre'

export const revalidate = 60

function NoConnectionState() {
  return (
    <>
      <TopBar title="Financeiro — Mercado Livre" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Mercado Livre ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Mercado Livre em Configurações para começar a sincronizar dados financeiros.
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

function parsePeriod(raw: string | undefined): Period {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'mes') return raw
  return '30d'
}

function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function periodFromIso(period: Period): string {
  const d = new Date()
  if (period === 'mes') {
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  d.setDate(d.getDate() - days + 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

type RpcRow = { date: string; pedidos: number; faturamento: number | string; comissao: number | string; frete: number | string; cupom: number | string }
type MixRpcRow = { payment_type: string | null; qtd: number; valor: number | string }

export default async function MercadoLivreFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const isCustom = !!(customFrom && customTo)

  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'mercado_livre')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const pFrom = isCustom ? `${customFrom}T00:00:00-03:00` : periodFromIso(period)
  const pTo = isCustom ? `${customTo}T23:59:59-03:00` : null

  const adsFrom = isCustom ? customFrom! : periodFromIso(period).slice(0, 10)
  const adsTo = isCustom ? customTo! : new Date().toISOString().slice(0, 10)

  const [{ data: finData }, { data: mixData }, { data: freteMlData }, { data: adsData }, { data: affData }, { data: affListData }] = await Promise.all([
    supabase.rpc('ml_financeiro_daily', { p_connection_id: conn.id, p_from: pFrom, p_to: pTo }),
    supabase.rpc('ml_payment_mix', { p_connection_id: conn.id, p_from: pFrom, p_to: pTo }),
    supabase.rpc('ml_frete_por_venda', { p_connection_id: conn.id, p_from: pFrom, p_to: pTo }),
    supabase.rpc('ml_ads_total', { p_connection_id: conn.id, p_from: adsFrom, p_to: adsTo }),
    supabase.rpc('ml_affiliates_periodo', { p_connection_id: conn.id, p_from: adsFrom, p_to: adsTo }),
    supabase.rpc('ml_affiliates_list', { p_connection_id: conn.id }),
  ])
  const freteMl = Number(freteMlData) || 0
  const adsCost = Number(adsData) || 0

  const aff = ((affData ?? []) as Array<{ cost: number | string; vendas: number | string; unidades: number | string; afiliados: number }>)[0]
  const afiliadoCost = Number(aff?.cost) || 0
  const afiliadoVendas = Number(aff?.vendas) || 0
  const afiliadoUnidades = Number(aff?.unidades) || 0
  const afiliadoCount = aff?.afiliados ?? 0

  const affiliateEntries: AffiliateEntry[] = ((affListData ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    date_from: String(r.date_from),
    date_to: String(r.date_to),
    affiliates_count: Number(r.affiliates_count) || 0,
    sold_amount: Number(r.sold_amount) || 0,
    sold_units: Number(r.sold_units) || 0,
    estimated_cost: Number(r.estimated_cost) || 0,
  }))

  const rows: FinDailyRow[] = ((finData ?? []) as RpcRow[]).map((r) => ({
    date: r.date,
    pedidos: r.pedidos,
    faturamento: Number(r.faturamento) || 0,
    comissao: Number(r.comissao) || 0,
    frete: Number(r.frete) || 0,
    cupom: Number(r.cupom) || 0,
  }))

  const paymentMix: PaymentMixRow[] = ((mixData ?? []) as MixRpcRow[]).map((r) => ({
    payment_type: r.payment_type ?? 'desconhecido',
    qtd: r.qtd,
    valor: Number(r.valor) || 0,
  }))

  return (
    <FinanceiroView
      rows={rows}
      paymentMix={paymentMix}
      freteMl={freteMl}
      adsCost={adsCost}
      afiliadoCost={afiliadoCost}
      afiliadoVendas={afiliadoVendas}
      afiliadoUnidades={afiliadoUnidades}
      afiliadoCount={afiliadoCount}
      affiliateEntries={affiliateEntries}
      defaultFrom={adsFrom}
      defaultTo={adsTo}
      period={period}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
    />
  )
}
