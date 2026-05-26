'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

export type Marketplace = 'shein' | 'magazord'

export type StockAlertSku = {
  sku_code: string
  warehouse: string | null
  available_qty: number
  total_qty: number
  detail_path?: string | null
}

export type StockAlertGroup = {
  marketplace: Marketplace
  product_name: string
  severity: 'critical' | 'warning'
  warehouses: string[]
  skus: StockAlertSku[]
  zeroCount: number
  lowCount: number
  updated_at: string | null
}

const MARKETPLACE_LABEL: Record<Marketplace, string> = {
  shein: 'Shein',
  magazord: 'Magazord',
}

const MARKETPLACE_BADGE: Record<Marketplace, string> = {
  shein: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  magazord: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
}

const severityCfg = {
  critical: { bar: 'bg-error', iconColor: 'text-error', iconName: 'error', filled: true },
  warning: { bar: 'bg-tertiary', iconColor: 'text-tertiary', iconName: 'warning', filled: false },
}

function fmtRelTime(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ontem'
  if (days < 7) return `há ${days}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function StockAlertCard({ group }: { group: StockAlertGroup }) {
  const [open, setOpen] = useState(false)
  const cfg = severityCfg[group.severity]
  const totalSkus = group.skus.length
  const labelParts: string[] = []
  if (group.zeroCount > 0) labelParts.push(`${group.zeroCount} zerado${group.zeroCount === 1 ? '' : 's'}`)
  if (group.lowCount > 0) labelParts.push(`${group.lowCount} baixo${group.lowCount === 1 ? '' : 's'}`)
  const summary = labelParts.join(' · ')
  const warehouseLabel = group.warehouses.length === 1 ? group.warehouses[0] : `${group.warehouses.length} depósitos`

  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center justify-between overflow-hidden p-md text-left transition-colors hover:bg-white/5"
      >
        <div className={cn('absolute bottom-0 left-0 top-0 w-1', cfg.bar)} />
        <div className="flex flex-1 items-center pl-3">
          <Icon name={cfg.iconName} filled={cfg.filled} className={cn('mr-4', cfg.iconColor)} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider', MARKETPLACE_BADGE[group.marketplace])}>
                {MARKETPLACE_LABEL[group.marketplace]}
              </span>
              <h4 className="line-clamp-1 text-base font-medium text-white">{group.product_name}</h4>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {summary} · {totalSkus} SKU{totalSkus === 1 ? '' : 's'} · {warehouseLabel}
            </p>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-3">
          <span className="text-xs text-slate-500">{fmtRelTime(group.updated_at)}</span>
          <Icon
            name={open ? 'expand_less' : 'expand_more'}
            className="text-slate-400"
            size={18}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 bg-black/20 p-md">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-slate-500">SKU</th>
                <th className="px-3 py-2 font-medium uppercase tracking-wider text-slate-500">Depósito</th>
                <th className="px-3 py-2 text-right font-medium uppercase tracking-wider text-slate-500">Disponível</th>
                <th className="px-3 py-2 text-right font-medium uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {group.skus.map((s) => (
                <tr key={`${s.sku_code}-${s.warehouse}`} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-300">{s.sku_code}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{s.warehouse || '—'}</td>
                  <td className={cn('px-3 py-2 text-right font-mono', s.available_qty === 0 ? 'text-error' : 'text-tertiary')}>
                    {s.available_qty}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">{s.total_qty}</td>
                  <td className="px-3 py-2 text-right">
                    {s.detail_path ? (
                      <Link
                        href={s.detail_path}
                        className="text-[11px] text-tertiary transition-colors hover:underline"
                      >
                        abrir →
                      </Link>
                    ) : (
                      <span className="text-[11px] text-outline">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
