export type CanalSlug = 'shopee' | 'shein'
export type CanalFilter = CanalSlug | 'all'

export interface CanalConfig {
  slug: CanalSlug
  label: string
  brand: 'shopee' | 'shein'
}

export const CANAIS: Record<CanalSlug, CanalConfig> = {
  shopee: { slug: 'shopee', label: 'Shopee', brand: 'shopee' },
  shein: { slug: 'shein', label: 'Shein', brand: 'shein' },
}

export interface DeltaPair {
  cur: number
  prev: number
}

export type DespesaKey = 'ads' | 'afiliados' | 'taxa' | 'comissao' | 'antecipacoes'

export interface UnifiedMetrics {
  canal: CanalFilter
  faturamento: DeltaPair
  pedidos: DeltaPair
  ticketMedio: DeltaPair
  cancelamentos: DeltaPair
  despesas: Partial<Record<DespesaKey, DeltaPair>>
  daily: UnifiedDailyPoint[]
  extras?: ShopeeExtras | SheinExtras
  nickname: string | null
}

export interface UnifiedDailyPoint {
  date: string
  faturamento: number
  pedidos: number
  cancelamentos: number
  liquido: number
}

export interface ShopeeExtras {
  type: 'shopee'
  lucroBrutoMacro: DeltaPair
  margemMacro: DeltaPair
}

export interface SheinExtras {
  type: 'shein'
  lucroReal: number
  margemRealPct: number
  custoTotal: number
  cobertaPct: number
  unidadesCobertas: number
  unidadesSemCusto: number
}
