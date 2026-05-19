import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import type { ShopeeItem } from '@/types'
import { AnunciosView, type CostEntry } from './anuncios-view'

function NoConnectionState() {
  return (
    <>
      <TopBar title="Anúncios — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Shopee ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Shopee em Configurações para começar a sincronizar anúncios.
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

function NoItemsState() {
  return (
    <>
      <TopBar title="Anúncios — Shopee" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">hourglass_empty</span>
          <h2 className="text-h2 font-semibold text-on-surface">Nenhum anúncio sincronizado</h2>
          <p className="text-sm text-on-surface-variant">
            Aguardando próxima execução do workflow{' '}
            <span className="font-mono text-on-surface">Shopee — Reconciliar Anúncios</span> (cron 2h).
          </p>
        </div>
      </main>
    </>
  )
}

type ProductCostJoin = {
  cost_unit: number | null
  packaging_cost: number | null
  tax_rate: number | null
  valid_from: string | null
  valid_to: string | null
}

type ProductRow = {
  seller_sku: string
  product_costs: ProductCostJoin[] | null
}

export default async function ShopeeAnunciosPage() {
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, external_user_id')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const { data: itemsRaw } = await supabase
    .from('shopee_items')
    .select('*')
    .eq('connection_id', conn.id)
    .order('sold_quantity', { ascending: false, nullsFirst: false })

  const items = (itemsRaw ?? []) as ShopeeItem[]
  if (items.length === 0) return <NoItemsState />

  const skus = items
    .map((i) => i.item_sku)
    .filter((s): s is string => !!s)

  const costsBySku: Record<string, CostEntry> = {}
  if (skus.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('seller_sku, product_costs(cost_unit, packaging_cost, tax_rate, valid_from, valid_to)')
      .in('seller_sku', skus)

    for (const p of (products ?? []) as ProductRow[]) {
      const active = (p.product_costs ?? [])
        .filter((c) => c.valid_to === null)
        .sort((a, b) => (b.valid_from ?? '').localeCompare(a.valid_from ?? ''))[0]
      if (active && active.cost_unit !== null) {
        costsBySku[p.seller_sku] = {
          cost_unit: active.cost_unit,
          packaging_cost: active.packaging_cost ?? 0,
          tax_rate: active.tax_rate ?? 0,
        }
      }
    }
  }

  return (
    <AnunciosView
      items={items}
      costsBySku={costsBySku}
      shopExternalId={conn.external_user_id ?? null}
    />
  )
}
