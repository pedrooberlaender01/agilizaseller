// Mapa status logístico → categoria. Arquivo SEM 'use client':
// importável tanto pelo Server Component (page) quanto pelo client (view).
// Import de módulo 'use client' em RSC vira client-reference opaca — Object.entries() vazio.
export type Category = 'in_transit' | 'delivered' | 'problem' | 'pending'

export const STATUS_CATEGORY: Record<string, Category> = {
  LOGISTICS_PICKUP_DONE: 'in_transit',
  LOGISTICS_DELIVERY_PENDING: 'in_transit',
  LOGISTICS_DELIVERY_DONE: 'delivered',
  LOGISTICS_FAILED: 'problem',
  LOGISTICS_PICKUP_RETRY: 'problem',
  LOGISTICS_PICKUP_FAILED: 'problem',
  LOGISTICS_DELIVERY_FAILED: 'problem',
  LOGISTICS_RTS: 'problem',
  LOGISTICS_RETURNING: 'problem',
  LOGISTICS_RETURNED: 'problem',
  LOGISTICS_LOST: 'problem',
  LOGISTICS_INVOICE_PENDING: 'pending',
  LOGISTICS_READY: 'pending',
  LOGISTICS_REQUEST_CREATED: 'pending',
  LOGISTICS_PICKUP_REQUESTED: 'pending',
}

export function categoryOf(status: string | null): Category {
  if (!status) return 'pending'
  return STATUS_CATEGORY[status] ?? 'pending'
}

export function statusesForCategory(cat: Category): string[] {
  return Object.entries(STATUS_CATEGORY)
    .filter(([, c]) => c === cat)
    .map(([s]) => s)
}
