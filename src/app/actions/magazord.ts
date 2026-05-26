'use server'

import { createClient } from '@/lib/supabase/server'

export type MagInvoiceItem = {
  id?: number
  codigo: string
  descricao: string
  quantidade: number
  valorUnitario: number
  valorProduto: number
  valorFrete: number
  valorDesconto: number
  valorImposto: number
  valorTotal: number
  unidadeMedida?: number
  ncm?: number
  deposito?: number
}

export type MagInvoiceDetail = {
  id: string
  identificador: string | null
  chave: string | null
  numero: number | null
  serie: number | null
  tipo: number | null
  situacao: number | null
  data_emissao: string | null
  valor: number | null
  valor_frete: number | null
  xml: string | null
  order_id: string | null
  raw_payload: {
    id?: number
    chave?: string
    numero?: number
    serie?: string
    situacao?: number
    descricaoSituacao?: string
    tipo?: number
    valorTotal?: string | number
    dataEmissao?: string
    dataAtualizacao?: string
    pedidoCodigo?: string
    pedidoId?: number
    url?: string | null
    titulos?: string[]
    itens?: MagInvoiceItem[]
  } | null
  mag_orders: {
    external_id: string
    pessoa_nome: string | null
    marketplace_origem: string | null
    valor_total: number | string
    uf: string | null
    cidade: string | null
  } | null
}

export async function getMagInvoiceDetail(id: string): Promise<MagInvoiceDetail | null> {
  if (!id) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mag_invoices')
    .select(
      'id, identificador, chave, numero, serie, tipo, situacao, data_emissao, valor, valor_frete, xml, order_id, raw_payload, mag_orders(external_id, pessoa_nome, marketplace_origem, valor_total, uf, cidade)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const rawOrder = (data as unknown as { mag_orders: unknown }).mag_orders
  const order = Array.isArray(rawOrder) ? rawOrder[0] ?? null : rawOrder ?? null

  return {
    ...(data as Omit<MagInvoiceDetail, 'mag_orders'>),
    mag_orders: order as MagInvoiceDetail['mag_orders'],
  }
}
