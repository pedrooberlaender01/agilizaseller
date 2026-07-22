import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { createClient } from '@/lib/supabase/server'
import type { AccountHealth } from '@/types'

export const revalidate = 60

// 2 casas: taxas de reputação são pequenas (0,01%); com 1 casa 0,01% virava "0,0%".
const fmtPct = (n: number | null) => (n == null ? '—' : `${(Number(n) * 100).toFixed(2).replace('.', ',')}%`)

function NoConnectionState() {
  return (
    <>
      <TopBar title="Saúde da Conta — Mercado Livre" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Mercado Livre ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Mercado Livre em Configurações para acompanhar a saúde da conta.
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

function PageHeader({ updatedAt }: { updatedAt: string | null }) {
  return (
    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="mb-1 text-[36px] font-bold leading-tight text-white">Saúde da Conta</h1>
        <p className="text-sm text-outline">
          Monitore a reputação e métricas operacionais para manter alta performance.
        </p>
      </div>
      <span className="rounded-full border border-white/10 bg-surface-container px-3 py-1 text-xs text-outline w-fit">
        {updatedAt ? `Última atualização: ${new Date(updatedAt).toLocaleString('pt-BR')}` : 'Sem sincronização ainda'}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass-card col-span-12 flex flex-col items-center gap-md rounded-xl p-xl text-center">
      <span className="material-symbols-outlined text-5xl text-outline-variant">monitor_heart</span>
      <h3 className="text-h2 font-semibold text-on-surface">Sem dados de saúde ainda</h3>
      <p className="max-w-md text-sm text-on-surface-variant">
        Os indicadores de reputação, cancelamentos, atrasos e reclamações do Mercado Livre ainda não foram
        sincronizados. Assim que o primeiro snapshot chegar, eles aparecerão aqui automaticamente.
      </p>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-tertiary/20 bg-tertiary/10 px-4 py-1.5">
        <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary" />
        <span className="text-xs font-medium uppercase tracking-wider text-tertiary">Aguardando sincronização</span>
      </div>
    </div>
  )
}

function MetricPlaceholder({ label }: { label: string }) {
  return (
    <div className="glass-card relative flex flex-col justify-between overflow-hidden p-lg">
      <div className="relative z-10 mb-4 flex items-start justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-outline">{label}</h3>
        <Icon name="remove" size={14} className="text-outline-variant" />
      </div>
      <div className="relative z-10">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-[32px] font-bold leading-none text-outline-variant">—</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest" />
      </div>
    </div>
  )
}

export default async function MercadoLivreSaudePage() {
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'mercado_livre')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const { data } = await supabase
    .from('account_health')
    .select('*')
    .eq('connection_id', conn.id)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const health = (data as AccountHealth | null) ?? null

  return (
    <>
      <TopBar title="Saúde da Conta — Mercado Livre" />
      <main className="flex-1 space-y-gutter p-margin">
        <PageHeader updatedAt={health?.snapshot_at ?? null} />

        {!health ? (
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 grid grid-cols-1 gap-gutter md:grid-cols-3">
              <MetricPlaceholder label="Cancelamentos" />
              <MetricPlaceholder label="Atraso no Envio" />
              <MetricPlaceholder label="Reclamações" />
            </div>
            <EmptyState />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 grid grid-cols-1 gap-gutter md:grid-cols-3">
              <div className="glass-card flex flex-col gap-2 p-lg">
                <h3 className="text-xs font-medium uppercase tracking-wider text-outline">Cancelamentos</h3>
                <span className="text-[32px] font-bold leading-none text-white">{fmtPct(health.cancellations_rate)}</span>
              </div>
              <div className="glass-card flex flex-col gap-2 p-lg">
                <h3 className="text-xs font-medium uppercase tracking-wider text-outline">Atraso no Envio</h3>
                <span className="text-[32px] font-bold leading-none text-white">{fmtPct(health.delayed_handling_rate)}</span>
              </div>
              <div className="glass-card flex flex-col gap-2 p-lg">
                <h3 className="text-xs font-medium uppercase tracking-wider text-outline">Reclamações</h3>
                <span className="text-[32px] font-bold leading-none text-white">{fmtPct(health.claims_rate)}</span>
              </div>
              <p className="col-span-full flex items-start gap-1.5 text-[11px] leading-relaxed text-outline-variant">
                <Icon name="help" size={13} className="mt-0.5 shrink-0" />
                <span title="Taxas oficiais da API de reputação do Mercado Livre (campo 'rate', janela móvel de 60 dias). Batem com Vendas → Reputação. Mostradas com 2 casas porque são pequenas (ex: cancelamentos 0,01%).">
                  Taxas oficiais do ML — janela de 60 dias. Batem com Vendas → Reputação.
                </span>
              </p>
            </div>

            <div className="glass-card col-span-12 flex flex-col gap-4 p-lg md:col-span-6">
              <div className="flex items-center gap-2">
                <Icon name="receipt_long" className="text-outline-variant" />
                <h3 className="text-base font-semibold text-white">Volume de Transações</h3>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-surface-container/50 p-3">
                <span className="text-sm text-white">Completadas</span>
                <span className="font-mono text-xs font-bold text-secondary">
                  {(health.transactions_completed ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-surface-container/50 p-3">
                <span className="text-sm text-white">Canceladas</span>
                <span className="font-mono text-xs font-bold text-error">
                  {(health.transactions_canceled ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-surface-container-highest p-3">
                <span className="text-xs font-medium uppercase tracking-wider text-outline">Total</span>
                <span className="font-mono text-xs font-bold text-[#3b82f6]">
                  {(health.transactions_total ?? 0).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="glass-card col-span-12 flex flex-col justify-center gap-3 p-lg md:col-span-6">
              <div className="flex items-center gap-2">
                <Icon name="verified" className="text-secondary" />
                <h3 className="text-base font-semibold text-white">Reputação</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[32px] font-bold leading-none text-secondary">
                  {health.level_id ?? '—'}
                </span>
                {health.power_seller_status && (
                  <span className="rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
                    {health.power_seller_status}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
