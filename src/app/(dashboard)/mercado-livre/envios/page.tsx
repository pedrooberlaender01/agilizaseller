import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { EnviosView, type ShipmentRow } from './envios-view'

export const revalidate = 60

function NoConnectionState() {
  return (
    <>
      <TopBar title="Envios — Mercado Livre" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Mercado Livre ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Mercado Livre em Configurações para começar a sincronizar envios.
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

type EnvPeriod = '7d' | '30d' | 'custom'

function parsePeriod(raw: string | undefined): EnvPeriod {
  return raw === '7d' || raw === '30d' ? raw : '30d'
}
function parseIsoDateOnly(s: string | undefined): string | null {
  if (!s) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
function periodFromIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days + 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function MercadoLivreEnviosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)
  const isCustom = !!(customFrom && customTo)
  const period: EnvPeriod = isCustom ? 'custom' : parsePeriod(sp.period)

  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'mercado_livre')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  // Filtra por sale_date do pedido vinculado (mesma data que o ML usa nas vendas).
  const pFrom = isCustom ? `${customFrom}T00:00:00-03:00` : periodFromIso(period === '7d' ? 7 : 30)
  const pTo = isCustom ? `${customTo}T23:59:59-03:00` : null

  let listQuery = supabase
    .from('ml_shipments')
    .select(
      'id, external_id, status, substatus, logistic_type, tracking_number, estimated_delivery_limit, delivered_at, cost_seller, receiver_city, receiver_state, receiver_zip, ml_orders!inner(buyer_nickname, date_created, total_amount, sale_date)',
    )
    .eq('connection_id', conn.id)
    .gte('ml_orders.sale_date', pFrom)
  if (pTo) listQuery = listQuery.lte('ml_orders.sale_date', pTo)

  const { data } = await listQuery.order('synced_at', { ascending: false }).limit(1000)
  const shipments = (data ?? []) as unknown as ShipmentRow[]

  // Contagem por status no período (não capada nos 1000 da lista).
  const { data: bucketData } = await supabase.rpc('ml_shipment_buckets', {
    p_connection_id: conn.id,
    p_from: pFrom,
    p_to: pTo,
  })
  const counts = { transito: 0, entregue: 0, problema: 0, pendente: 0 }
  const countsFull = { transito: 0, entregue: 0, problema: 0, pendente: 0 }
  for (const b of (bucketData ?? []) as { bucket: string; qtd: number; full_qtd: number }[]) {
    if (b.bucket in counts) {
      counts[b.bucket as keyof typeof counts] = b.qtd
      countsFull[b.bucket as keyof typeof countsFull] = Number(b.full_qtd) || 0
    }
  }

  return (
    <EnviosView
      shipments={shipments}
      counts={counts}
      countsFull={countsFull}
      period={period}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
    />
  )
}
