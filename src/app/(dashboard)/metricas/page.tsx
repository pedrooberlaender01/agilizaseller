import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

import {
  loadMetricsForCanal,
  parsePeriod,
  parseIsoDateOnly,
  periodRange,
  customRange,
  type CanalFilter,
} from '@/lib/marketplace-metrics'
import { MetricasView } from './metricas-view'

function parseCanal(raw: string | undefined): CanalFilter {
  if (raw === 'shopee' || raw === 'shein') return raw
  return 'all'
}

function canalLabel(c: CanalFilter): string {
  if (c === 'shopee') return 'Shopee'
  if (c === 'shein') return 'Shein'
  return 'Todos marketplaces'
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string; period?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const canal = parseCanal(sp.canal)
  const period = parsePeriod(sp.period)
  const customFrom = parseIsoDateOnly(sp.from)
  const customTo = parseIsoDateOnly(sp.to)

  const isCustom = !!(customFrom && customTo)
  const range = isCustom ? customRange(customFrom!, customTo!) : periodRange(period)

  const supabase = await createClient()
  const metrics = await loadMetricsForCanal(canal, supabase, range)

  if (!metrics) {
    return (
      <>
        <TopBar title={`Métricas — ${canalLabel(canal)}`} />
        <main className="flex flex-1 items-center justify-center p-margin">
          <div className="border border-zinc-800 bg-zinc-900/40 flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
            <span className="material-symbols-outlined text-4xl text-zinc-500">link_off</span>
            <h2 className="text-lg font-semibold text-white">Sem conexão {canalLabel(canal)} ativa</h2>
            <p className="text-sm text-zinc-400">
              Conecte uma conta {canal === 'all' ? 'de marketplace' : canalLabel(canal)} em Configurações pra começar a sincronizar métricas.
            </p>
            <Link
              href="/configuracoes"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              Ir pra Configurações
            </Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <MetricasView
      metrics={metrics}
      canal={canal}
      period={period}
      customFrom={isCustom ? customFrom : null}
      customTo={isCustom ? customTo : null}
    />
  )
}
