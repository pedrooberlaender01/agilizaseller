'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

export type Period = '7d' | '30d' | 'all' | 'custom'

export function PeriodFilter({
  period,
  from,
  to,
}: {
  period: Period
  from: string | null
  to: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function setPeriod(p: Period) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', p)
    if (p !== 'custom') {
      next.delete('from')
      next.delete('to')
    }
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  function applyCustom(fromIso: string, toIso: string) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', 'custom')
    next.set('from', fromIso)
    next.set('to', toIso)
    setOpen(false)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  const customLabel = period === 'custom' && from && to
    ? `${fmtDateBRShort(from)} – ${fmtDateBRShort(to)}`
    : 'Personalizar'

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
        {(['7d', '30d', 'all'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              period === p ? 'bg-zinc-50 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-50',
            )}
          >
            {p === 'all' ? 'Tudo' : p === '7d' ? '7 dias' : '30 dias'}
          </button>
        ))}
      </div>

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-[36px] items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors',
            period === 'custom'
              ? 'border-zinc-50 bg-zinc-50 text-zinc-900'
              : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-50',
          )}
        >
          <Icon name="event" size={16} />
          <span>{customLabel}</span>
          <Icon name={open ? 'expand_less' : 'expand_more'} size={16} />
        </button>
        {open && (
          <DateRangePopover
            from={from}
            to={to}
            onApply={applyCustom}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
