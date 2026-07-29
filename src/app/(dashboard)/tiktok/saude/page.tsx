import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { KpiCard, fmtNum, fmtPct } from '../_ui'

export const revalidate = 60

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

export default async function TiktokSaudePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const sp = await searchParams
  const period = parsePeriod(sp.period)

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
        <TopBar title="Saúde da Conta — TikTok Shop" />
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
  const { data } = await supabase.rpc('tt_operational_health', { p_from: from, p_to: to })
  const h = (data ?? {}) as {
    pedidos_total?: number; envio_com_sla?: number; envio_atrasado?: number; envio_atrasado_pct?: number
    coleta_atrasada?: number; cancelados?: number; cancel_pct?: number; cancel_comprador?: number
    cancel_sistema?: number; devolucoes?: number; devolucao_pct?: number
  }

  const atrasoPct = Number(h.envio_atrasado_pct ?? 0)
  const cancelPct = Number(h.cancel_pct ?? 0)
  const devPct = Number(h.devolucao_pct ?? 0)

  return (
    <>
      <TopBar title="Saúde da Conta — TikTok Shop" />
      <main className="overflow-y-auto p-margin">
        {/* Aviso: metricas proprias, nao o score oficial */}
        <div className="mb-lg flex flex-wrap items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-lg">
          <span className="material-symbols-outlined text-lg text-blue-300">info</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-100">Métricas operacionais (cálculo próprio)</p>
            <p className="mt-1 text-xs text-slate-400">
              O TikTok não expõe a Pontuação de Desempenho da Loja, pontos de integridade nem violações via API —
              esses dados existem apenas no Seller Center. Os números abaixo são calculados a partir dos prazos (SLA)
              dos próprios pedidos e podem divergir das taxas oficiais, que usam definições proprietárias.
            </p>
            <a
              href="https://seller-br.tiktok.com/health-center"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 hover:text-blue-200"
            >
              Ver score e violações no Seller Center
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <Link
                key={p}
                href={`?period=${p}`}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {p}
              </Link>
            ))}
          </div>
        </div>

        {/* KPIs operacionais */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Envio no Prazo"
            value={fmtPct(100 - atrasoPct)}
            icon="schedule"
            tone={atrasoPct <= 5 ? 'green' : atrasoPct <= 10 ? 'gold' : 'red'}
            sub={`${fmtNum(h.envio_atrasado ?? 0)} atrasados de ${fmtNum(h.envio_com_sla ?? 0)}`}
          />
          <KpiCard
            label="Envio Atrasado"
            value={fmtPct(atrasoPct)}
            icon="running_with_errors"
            tone={atrasoPct <= 5 ? 'green' : 'red'}
            sub="rts_time acima do SLA"
          />
          <KpiCard
            label="Cancelamentos"
            value={fmtPct(cancelPct)}
            icon="remove_shopping_cart"
            tone="red"
            sub={`${fmtNum(h.cancel_comprador ?? 0)} comprador · ${fmtNum(h.cancel_sistema ?? 0)} sistema`}
          />
          <KpiCard
            label="Taxa de Devolução"
            value={fmtPct(devPct)}
            icon="keyboard_return"
            tone={devPct <= 5 ? 'green' : devPct <= 12 ? 'gold' : 'red'}
            sub={`${fmtNum(h.devolucoes ?? 0)} de ${fmtNum(h.pedidos_total ?? 0)} pedidos`}
          />
          <KpiCard
            label="Coleta Atrasada"
            value={fmtNum(h.coleta_atrasada ?? 0)}
            icon="local_shipping"
            tone={(h.coleta_atrasada ?? 0) === 0 ? 'green' : 'red'}
            sub="coleta após prazo"
          />
        </div>

        {/* Métricas só no painel oficial */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Somente no Seller Center</h3>
            <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">Sem endpoint na API</p>
          </div>
          <div className="grid grid-cols-1 divide-y divide-zinc-800/60 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="flex flex-col gap-3 p-lg">
              {[
                'Pontuação de Desempenho da Loja (score / 5)',
                'Pontos de integridade (escala 0–1000)',
                'Violações de política e advertências',
              ].map((l) => (
                <div key={l} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{l}</span>
                  <span className="text-zinc-600">—</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 p-lg">
              {[
                'Taxa de avaliação negativa',
                'Taxa de resposta em 24h (chat)',
                'Cancelamento por falha do vendedor',
              ].map((l) => (
                <div key={l} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{l}</span>
                  <span className="text-zinc-600">—</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
