export type StatusTone = 'green' | 'blue' | 'yellow' | 'red' | 'gray'

export type StatusMapping = {
  label: string
  tone: StatusTone
}

// Codes confirmados pelo suporte Shein (queryType = order_status)
const ORDER_STATUS: Record<string, StatusMapping> = {
  '1': { label: 'Aguardando processamento', tone: 'yellow' },
  '2': { label: 'Endereço exportado', tone: 'blue' },
  '4': { label: 'Coletado', tone: 'blue' },
  '5': { label: 'Em trânsito', tone: 'green' },
  '6': { label: 'Entregue', tone: 'green' },
  '7': { label: 'Enviado (tracking)', tone: 'green' },
}

const INVOICE_STATUS: Record<string, StatusMapping> = {
  '1': { label: 'NF emitida', tone: 'green' },
  '2': { label: 'NF pendente', tone: 'yellow' },
  '3': { label: 'NF reenviar', tone: 'red' },
}

const PRINT_STATUS: Record<string, StatusMapping> = {
  '1': { label: 'Etiqueta pronta', tone: 'green' },
  '2': { label: 'Exceção envio', tone: 'red' },
}

const TONE_CLASSES: Record<StatusTone, string> = {
  yellow: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  blue: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  red: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  gray: 'bg-zinc-700/30 text-zinc-300 border border-zinc-600/40',
}

export function mapOrderStatus(code: string | null | undefined): StatusMapping {
  if (!code) return { label: '—', tone: 'gray' }
  const found = ORDER_STATUS[String(code).trim()]
  if (found) return found
  return { label: `Status ${code}`, tone: 'gray' }
}

export function mapInvoiceStatus(code: string | null | undefined): StatusMapping {
  if (!code) return { label: '—', tone: 'gray' }
  const found = INVOICE_STATUS[String(code).trim()]
  if (found) return found
  return { label: `NF ${code}`, tone: 'gray' }
}

export function mapPrintStatus(code: string | null | undefined): StatusMapping {
  if (!code) return { label: '—', tone: 'gray' }
  const found = PRINT_STATUS[String(code).trim()]
  if (found) return found
  return { label: `Envio ${code}`, tone: 'gray' }
}

export function statusToneClass(tone: StatusTone): string {
  return TONE_CLASSES[tone]
}
