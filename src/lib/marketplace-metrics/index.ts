export * from './types'
export * from './period'
export { loadShopeeMetrics } from './loader-shopee'
export { loadSheinMetrics } from './loader-shein'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanalFilter, CanalSlug, UnifiedMetrics, DespesaKey, DeltaPair } from './types'
import type { DateRange } from './period'
import { loadShopeeMetrics } from './loader-shopee'
import { loadSheinMetrics } from './loader-shein'

function pair(cur: number, prev: number): DeltaPair {
  return { cur, prev }
}

function mergeDespesas(
  a: UnifiedMetrics['despesas'],
  b: UnifiedMetrics['despesas'],
): UnifiedMetrics['despesas'] {
  const keys: DespesaKey[] = ['ads', 'afiliados', 'taxa', 'comissao', 'antecipacoes']
  const out: UnifiedMetrics['despesas'] = {}
  for (const k of keys) {
    const av = a[k]
    const bv = b[k]
    if (!av && !bv) continue
    out[k] = pair((av?.cur ?? 0) + (bv?.cur ?? 0), (av?.prev ?? 0) + (bv?.prev ?? 0))
  }
  return out
}

function mergeDaily(a: UnifiedMetrics['daily'], b: UnifiedMetrics['daily']): UnifiedMetrics['daily'] {
  const map = new Map<string, UnifiedMetrics['daily'][number]>()
  for (const r of a) map.set(r.date, { ...r })
  for (const r of b) {
    const prev = map.get(r.date)
    if (prev) {
      map.set(r.date, {
        date: r.date,
        faturamento: prev.faturamento + r.faturamento,
        pedidos: prev.pedidos + r.pedidos,
        cancelamentos: prev.cancelamentos + r.cancelamentos,
        liquido: prev.liquido + r.liquido,
      })
    } else {
      map.set(r.date, { ...r })
    }
  }
  return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date))
}

async function loadAllMetrics(
  supabase: SupabaseClient,
  range: DateRange,
): Promise<UnifiedMetrics | null> {
  const [shopee, shein] = await Promise.all([
    loadShopeeMetrics(supabase, range),
    loadSheinMetrics(supabase, range),
  ])
  if (!shopee && !shein) return null
  if (!shopee) return shein ? { ...shein, canal: 'all' } : null
  if (!shein) return { ...shopee, canal: 'all' }

  const faturamento = pair(shopee.faturamento.cur + shein.faturamento.cur, shopee.faturamento.prev + shein.faturamento.prev)
  const pedidos = pair(shopee.pedidos.cur + shein.pedidos.cur, shopee.pedidos.prev + shein.pedidos.prev)
  const cancelamentos = pair(shopee.cancelamentos.cur + shein.cancelamentos.cur, shopee.cancelamentos.prev + shein.cancelamentos.prev)
  const ticketCur = pedidos.cur > 0 ? faturamento.cur / pedidos.cur : 0
  const ticketPrev = pedidos.prev > 0 ? faturamento.prev / pedidos.prev : 0

  return {
    canal: 'all',
    faturamento,
    pedidos,
    ticketMedio: pair(ticketCur, ticketPrev),
    cancelamentos,
    despesas: mergeDespesas(shopee.despesas, shein.despesas),
    daily: mergeDaily(shopee.daily, shein.daily),
    extras: undefined,
    nickname: null,
  }
}

export async function loadMetricsForCanal(
  canal: CanalFilter,
  supabase: SupabaseClient,
  range: DateRange,
): Promise<UnifiedMetrics | null> {
  if (canal === 'all') return loadAllMetrics(supabase, range)
  if (canal === 'shopee') return loadShopeeMetrics(supabase, range)
  if (canal === 'shein') return loadSheinMetrics(supabase, range)
  return null
}
