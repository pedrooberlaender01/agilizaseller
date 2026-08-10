import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { Period } from '@/components/metrics-chart'
import { FinanceiroView, type FinDailyRow, type PaymentMixRow } from './financeiro-view'

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

  const [{ data: finData }, { data: mixData }, { data: adsData }, { data: affData }, { data: billingData }] = await Promise.all([
    supabase.rpc('ml_financeiro_daily', { p_connection_id: conn.id, p_from: pFrom, p_to: pTo }),
    supabase.rpc('ml_payment_mix', { p_connection_id: conn.id, p_from: pFrom, p_to: pTo }),
    supabase.rpc('ml_ads_total', { p_connection_id: conn.id, p_from: adsFrom, p_to: adsTo }),
    supabase.rpc('ml_affiliates_periodo', { p_connection_id: conn.id, p_from: adsFrom, p_to: adsTo }),
    supabase.rpc('ml_billing_resumo_all', { p_conn: conn.id }),
  ])
  const adsCost = Number(adsData) || 0

  const billingAll = (billingData ?? []) as Array<{ period_key: string; date_from: string; date_to: string; period_status: string; categoria: string; valor: number | string }>
  const bp = new Map<string, { key: string; from: string; to: string; status: string; rows: { categoria: string; valor: number }[] }>()
  for (const r of billingAll) {
    if (!bp.has(r.period_key)) bp.set(r.period_key, { key: r.period_key, from: r.date_from, to: r.date_to, status: r.period_status, rows: [] })
    bp.get(r.period_key)!.rows.push({ categoria: r.categoria, valor: Number(r.valor) || 0 })
  }
  const billingPeriods = Array.from(bp.values()).map((p) => ({ ...p, total: p.rows.reduce((a, x) => a + x.valor, 0) }))

  const aff = ((affData ?? []) as Array<{ cost: number | string; vendas: number | string; unidades: number | string; afiliados: number }>)[0]
  const afiliadoCost = Number(aff?.cost) || 0
  const afiliadoVendas = Number(aff?.vendas) || 0
  const afiliadoUnidades = Number(aff?.unidades) || 0


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
      adsCost={adsCost}
      afiliadoCost={afiliadoCost}
      afiliadoVendas={afiliadoVendas}
      afiliadoUnidades={afiliadoUnidades}
      billingPeriods={billingPeriods}
      defaultFrom={adsFrom}
      defaultTo={adsTo}
      period={period}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
    />
  )
}
