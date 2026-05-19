'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DisconnectState = { ok: boolean; error?: string }

export async function disconnectMarketplace(connectionId: string): Promise<DisconnectState> {
  if (!connectionId) return { ok: false, error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('marketplace_connections')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', connectionId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/configuracoes')
  return { ok: true }
}

export async function reauthShopee(): Promise<{ ok: boolean; error?: string; url?: string }> {
  return {
    ok: false,
    error: 'Re-autorização Shopee ainda não implementada. Workflow Gerar URL Autorização (n8n) precisa ser exposto via webhook.',
  }
}
