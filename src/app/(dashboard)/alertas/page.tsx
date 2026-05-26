import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { StockAlertCard, type StockAlertGroup, type Marketplace } from './stock-alert-card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LOW_STOCK_THRESHOLD = 5

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: string
  tone?: 'critical' | 'warning' | 'info' | 'neutral'
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-l-2 border-l-error'
      : tone === 'warning'
        ? 'border-l-2 border-l-tertiary'
        : tone === 'info'
          ? 'border-l-2 border-l-[#3b82f6]'
          : ''
  const labelColor =
    tone === 'critical'
      ? 'text-error'
      : tone === 'warning'
        ? 'text-tertiary'
        : tone === 'info'
          ? 'text-[#3b82f6]'
          : 'text-slate-400'

  return (
    <div className={cn('glass-card flex h-[120px] flex-col justify-between rounded-xl p-lg', toneClass)}>
      <div className="flex items-start justify-between">
        <span className={cn('text-xs font-medium uppercase tracking-wider', labelColor)}>{label}</span>
        <Icon name={icon} filled={tone !== 'neutral' && tone !== undefined} className={labelColor} />
      </div>
      <div className="text-[36px] font-bold leading-none text-white">{value}</div>
    </div>
  )
}

type StockRow = {
  sku_code: string
  warehouse: string | null
  available_qty: number | string | null
  total_qty: number | string | null
  product_name: string | null
  updated_at: string | null
}

async function buildShein(supabase: Awaited<ReturnType<typeof createClient>>): Promise<StockAlertGroup[]> {
  const { data: rows } = await supabase
    .from('shein_stock_enriched')
    .select('sku_code, warehouse, available_qty, total_qty, product_name, updated_at')
    .lte('available_qty', LOW_STOCK_THRESHOLD)
    .order('available_qty', { ascending: true })
    .limit(500)

  const stocks = (rows ?? []) as StockRow[]
  if (stocks.length === 0) return []

  const cutoff30d = new Date()
  cutoff30d.setDate(cutoff30d.getDate() - 30)
  const cutoffIso = cutoff30d.toISOString()
  const zeroSkus = stocks.filter((s) => Number(s.available_qty) === 0).map((s) => s.sku_code)
  let activeZeroSkus = new Set<string>()
  if (zeroSkus.length > 0) {
    const { data: sales } = await supabase
      .from('shein_order_items')
      .select('sku_code, shein_orders!inner(order_time)')
      .in('sku_code', zeroSkus)
      .gte('shein_orders.order_time', cutoffIso)
    activeZeroSkus = new Set(((sales ?? []) as Array<{ sku_code: string }>).map((r) => r.sku_code))
  }

  return groupByProduct('shein', stocks, activeZeroSkus, (sku) => `/shein/estoque/${encodeURIComponent(sku)}`)
}

async function buildMagazord(supabase: Awaited<ReturnType<typeof createClient>>): Promise<StockAlertGroup[]> {
  const { data: rows } = await supabase
    .from('mag_stock_enriched')
    .select('sku_code, warehouse, available_qty, total_qty, product_name, updated_at')
    .lte('available_qty', LOW_STOCK_THRESHOLD)
    .order('available_qty', { ascending: true })
    .limit(500)

  const stocks = (rows ?? []) as StockRow[]
  if (stocks.length === 0) return []

  const cutoff30d = new Date()
  cutoff30d.setDate(cutoff30d.getDate() - 30)
  const cutoffIso = cutoff30d.toISOString()
  const zeroSkus = stocks.filter((s) => Number(s.available_qty) === 0).map((s) => s.sku_code)
  let activeZeroSkus = new Set<string>()
  if (zeroSkus.length > 0) {
    const { data: sales } = await supabase
      .from('mag_order_items')
      .select('codigo_derivacao, mag_orders!inner(data_hora)')
      .in('codigo_derivacao', zeroSkus)
      .gte('mag_orders.data_hora', cutoffIso)
    activeZeroSkus = new Set(
      ((sales ?? []) as Array<{ codigo_derivacao: string }>).map((r) => r.codigo_derivacao),
    )
  }

  return groupByProduct('magazord', stocks, activeZeroSkus, () => null)
}

function groupByProduct(
  marketplace: Marketplace,
  stocks: StockRow[],
  activeZeroSkus: Set<string>,
  detailPath: (sku: string) => string | null,
): StockAlertGroup[] {
  const map = new Map<string, StockAlertGroup>()

  for (const s of stocks) {
    const avail = Number(s.available_qty ?? 0)
    const totalQty = Number(s.total_qty ?? 0)
    const isZero = avail === 0
    const isActiveZero = isZero && activeZeroSkus.has(s.sku_code)
    const productName = s.product_name?.trim() || s.sku_code

    const key = `${marketplace}::${productName}`
    const group = map.get(key) ?? {
      marketplace,
      product_name: productName,
      severity: 'warning' as const,
      warehouses: [],
      skus: [],
      zeroCount: 0,
      lowCount: 0,
      updated_at: s.updated_at,
    }

    group.skus.push({
      sku_code: s.sku_code,
      warehouse: s.warehouse,
      available_qty: avail,
      total_qty: totalQty,
      detail_path: detailPath(s.sku_code),
    })

    if (s.warehouse && !group.warehouses.includes(s.warehouse)) {
      group.warehouses.push(s.warehouse)
    }

    if (isZero) group.zeroCount++
    else group.lowCount++

    if (isActiveZero || avail <= 2 || group.severity === 'critical') {
      group.severity = 'critical'
    }

    if (s.updated_at && (!group.updated_at || new Date(s.updated_at) > new Date(group.updated_at))) {
      group.updated_at = s.updated_at
    }

    map.set(key, group)
  }

  return Array.from(map.values())
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ marketplace?: string }>
}) {
  const sp = await searchParams
  const filter = sp.marketplace === 'shein' || sp.marketplace === 'magazord' ? sp.marketplace : 'all'

  const supabase = await createClient()
  const [sheinGroups, magGroups] = await Promise.all([buildShein(supabase), buildMagazord(supabase)])

  const allGroups: StockAlertGroup[] = []
  if (filter === 'all' || filter === 'shein') allGroups.push(...sheinGroups)
  if (filter === 'all' || filter === 'magazord') allGroups.push(...magGroups)

  allGroups.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    if (a.zeroCount !== b.zeroCount) return b.zeroCount - a.zeroCount
    return b.skus.length - a.skus.length
  })

  let totalZero = 0
  let totalLow = 0
  let totalSkus = 0
  for (const g of allGroups) {
    totalZero += g.zeroCount
    totalLow += g.lowCount
    totalSkus += g.skus.length
  }

  const criticalGroups = allGroups.filter((g) => g.severity === 'critical')
  const warningGroups = allGroups.filter((g) => g.severity === 'warning')

  const tabs: { value: 'all' | Marketplace; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'shein', label: 'Shein' },
    { value: 'magazord', label: 'Magazord' },
  ]

  return (
    <>
      <TopBar title="Alertas & Notificações" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-xl flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-2 text-[36px] font-bold leading-tight text-white">Alertas &amp; Notificações</h2>
            <p className="text-base text-slate-400">Monitora anomalias de estoque em todos marketplaces. Atualização em tempo real.</p>
          </div>
          <div className="flex w-fit rounded-lg border border-white/10 bg-[#050507] p-1">
            {tabs.map((t) => {
              const isActive = filter === t.value
              const href = t.value === 'all' ? '/alertas' : `/alertas?marketplace=${t.value}`
              return (
                <a
                  key={t.value}
                  href={href}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {t.label}
                </a>
              )
            })}
          </div>
        </div>

        <div className="mb-xl grid grid-cols-2 gap-gutter md:grid-cols-4">
          <SummaryCard label="Produtos afetados" value={allGroups.length} icon="inventory_2" tone="neutral" />
          <SummaryCard label="Zerados" value={totalZero} icon="error" tone="critical" />
          <SummaryCard label="Baixos (≤5)" value={totalLow} icon="warning" tone="warning" />
          <SummaryCard label="SKUs total" value={totalSkus} icon="qr_code" tone="neutral" />
        </div>

        {allGroups.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-xl text-center">
            <Icon name="check_circle" filled className="text-secondary" size={32} />
            <p className="text-sm text-slate-300">Nenhum alerta ativo no momento.</p>
            <p className="text-xs text-slate-500">Estoques saudáveis e workflows operando normal.</p>
          </div>
        ) : (
          <div className="space-y-xl">
            {criticalGroups.length > 0 && (
              <div>
                <h3 className="mb-md pl-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                  Críticos — Zerado / muito baixo ({criticalGroups.length})
                </h3>
                <div className="space-y-sm">
                  {criticalGroups.map((g) => (
                    <StockAlertCard key={`${g.marketplace}::${g.product_name}`} group={g} />
                  ))}
                </div>
              </div>
            )}
            {warningGroups.length > 0 && (
              <div>
                <h3 className="mb-md pl-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                  Avisos — Estoque baixo ({warningGroups.length})
                </h3>
                <div className="space-y-sm">
                  {warningGroups.map((g) => (
                    <StockAlertCard key={`${g.marketplace}::${g.product_name}`} group={g} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
