'use server'

import { revalidatePath } from 'next/cache'

const WEBHOOK_URL =
  process.env.SHEIN_EXPORT_ADDRESS_WEBHOOK ??
  'https://n8n-gend.srv1431760.hstgr.cloud/webhook/shein/export-address'

export type ExportResult = {
  ok: boolean
  buyer_name?: string
  error?: string
}

export async function exportAddress(orderNo: string, connectionId: string): Promise<ExportResult> {
  try {
    const resp = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_no: orderNo, connection_id: connectionId }),
      cache: 'no-store',
    })
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` }
    }
    const data = (await resp.json()) as ExportResult
    if (data.ok) {
      revalidatePath(`/shein/pedidos/${orderNo}`)
    }
    return data
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}
