'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type UpdateCostInput = {
  product_id: string
  sku_code: string
  cost_price: number | null
  packaging_cost: number | null
  cost_notes: string | null
}

export async function updateProductCost(input: UpdateCostInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('shein_products')
    .update({
      cost_price: input.cost_price,
      packaging_cost: input.packaging_cost ?? 0,
      cost_notes: input.cost_notes,
      cost_updated_at: new Date().toISOString(),
    })
    .eq('id', input.product_id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/shein/produtos/${encodeURIComponent(input.sku_code)}`)
  revalidatePath('/shein/produtos')
  revalidatePath('/shein/metricas')
  return { ok: true }
}
