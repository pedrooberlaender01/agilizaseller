'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function todayIso(): string {
  return toIso(new Date())
}

function shiftDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toIso(d)
}

function firstDayMonthIso(offsetMonths = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths, 1)
  return toIso(d)
}

function lastDayMonthIso(offsetMonths = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMonths + 1, 0)
  return toIso(d)
}

function startOfWeekIso(): string {
  const d = new Date()
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - day)
  return toIso(d)
}

export function fmtDateBRFull(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function fmtDateBRShort(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function Calendar({
  from,
  to,
  hoverDate,
  onPick,
  onHover,
  viewMonth,
  onChangeMonth,
}: {
  from: string | null
  to: string | null
  hoverDate: string | null
  onPick: (iso: string) => void
  onHover: (iso: string | null) => void
  viewMonth: Date
  onChangeMonth: (d: Date) => void
}) {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayIso()

  const cells: Array<{ iso: string; day: number; inMonth: boolean } | null> = []
  const prevMonthDays = new Date(year, month, 0).getDate()
  for (let i = 0; i < firstWeekday; i++) {
    const day = prevMonthDays - firstWeekday + 1 + i
    const d = new Date(year, month - 1, day)
    cells.push({ iso: toIso(d), day, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toIso(new Date(year, month, d)), day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - daysInMonth - firstWeekday + 1)
    cells.push({ iso: toIso(d), day: d.getDate(), inMonth: false })
  }

  const previewEnd = to ?? hoverDate
  function inRange(iso: string): boolean {
    if (!from || !previewEnd) return false
    const a = from <= previewEnd ? from : previewEnd
    const b = from <= previewEnd ? previewEnd : from
    return iso > a && iso < b
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChangeMonth(new Date(year, month - 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-50"
          aria-label="Mês anterior"
        >
          <Icon name="chevron_left" size={16} />
        </button>
        <p className="text-sm font-semibold text-zinc-50">
          <span>{MONTH_NAMES[month]}</span>
          <span className="ml-1.5 font-mono text-xs text-zinc-500">{year}</span>
        </p>
        <button
          type="button"
          onClick={() => onChangeMonth(new Date(year, month + 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-50"
          aria-label="Próximo mês"
        >
          <Icon name="chevron_right" size={16} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="flex h-6 items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-outline">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => onHover(null)}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const isFrom = c.iso === from
          const isTo = c.iso === to
          const isToday = c.iso === today && c.inMonth
          const isInRange = inRange(c.iso)
          const isEdge = isFrom || isTo

          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(c.iso)}
              onMouseEnter={() => onHover(c.iso)}
              className={cn(
                'relative flex h-9 items-center justify-center rounded-md text-xs font-medium transition-all duration-100',
                !c.inMonth && 'text-outline/40',
                c.inMonth && !isEdge && !isInRange && 'text-zinc-200 hover:bg-zinc-800/60',
                isInRange && 'bg-blue-500/15 text-blue-300',
                isEdge && 'bg-primary text-on-primary shadow-md shadow-primary/30',
                isToday && !isEdge && 'ring-1 ring-inset ring-primary/40',
              )}
            >
              {c.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePopover({
  from,
  to,
  onApply,
  onClose,
  align = 'right',
}: {
  from: string | null
  to: string | null
  onApply: (from: string, to: string) => void
  onClose: () => void
  align?: 'left' | 'right'
}) {
  const [selFrom, setSelFrom] = useState<string | null>(from)
  const [selTo, setSelTo] = useState<string | null>(to)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const seed = from ? fromIso(from) : new Date()
    return new Date(seed.getFullYear(), seed.getMonth(), 1)
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handlePick(iso: string) {
    if (!selFrom || (selFrom && selTo)) {
      setSelFrom(iso)
      setSelTo(null)
      setHoverDate(null)
      return
    }
    if (iso < selFrom) {
      setSelFrom(iso)
      return
    }
    setSelTo(iso)
  }

  function applyShortcut(f: string, t: string) {
    setSelFrom(f)
    setSelTo(t)
    setViewMonth(new Date(fromIso(f).getFullYear(), fromIso(f).getMonth(), 1))
  }

  function handleApply() {
    if (!selFrom || !selTo) return
    onApply(selFrom, selTo)
  }

  const canApply = !!(selFrom && selTo)
  const alignCls = align === 'left' ? 'left-0' : 'right-0'

  return (
    <div
      className={cn(
        'absolute top-full z-40 mt-2 w-[360px] overflow-hidden rounded-2xl border border-zinc-800 bg-[#0a0a0c] shadow-2xl shadow-black/60 backdrop-blur-xl',
        alignCls,
      )}
      role="dialog"
    >
      <div className="border-b border-zinc-800/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon name="event" size={16} className="text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-50">Período personalizado</h4>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-zinc-800/60 px-5 py-3">
        <div className={cn(
          'rounded-lg border px-3 py-2 transition-colors',
          selFrom ? 'border-primary/30 bg-primary/5' : 'border-zinc-800 bg-zinc-900/50',
        )}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-outline">De</p>
          <p className={cn('mt-0.5 font-mono text-sm', selFrom ? 'text-zinc-50' : 'text-zinc-500')}>
            {selFrom ? fmtDateBRFull(selFrom) : '—'}
          </p>
        </div>
        <div className={cn(
          'rounded-lg border px-3 py-2 transition-colors',
          selTo ? 'border-primary/30 bg-primary/5' : 'border-zinc-800 bg-zinc-900/50',
        )}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-outline">Até</p>
          <p className={cn('mt-0.5 font-mono text-sm', selTo ? 'text-zinc-50' : 'text-zinc-500')}>
            {selTo ? fmtDateBRFull(selTo) : '—'}
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <Calendar
          from={selFrom}
          to={selTo}
          hoverDate={hoverDate}
          onPick={handlePick}
          onHover={setHoverDate}
          viewMonth={viewMonth}
          onChangeMonth={setViewMonth}
        />

        <div className="mt-4 border-t border-zinc-800/60 pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-outline">Atalhos</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Hoje', f: todayIso(), t: todayIso() },
              { label: 'Ontem', f: shiftDaysIso(-1), t: shiftDaysIso(-1) },
              { label: 'Esta semana', f: startOfWeekIso(), t: todayIso() },
              { label: 'Este mês', f: firstDayMonthIso(0), t: todayIso() },
              { label: 'Mês passado', f: firstDayMonthIso(-1), t: lastDayMonthIso(-1) },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applyShortcut(s.f, s.t)}
                className="rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800/60 bg-zinc-900/40 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canApply}
          onClick={handleApply}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
            canApply
              ? 'bg-primary text-on-primary hover:bg-primary/90'
              : 'cursor-not-allowed bg-zinc-800/60 text-zinc-600',
          )}
        >
          <Icon name="check" size={14} />
          Aplicar
        </button>
      </div>
    </div>
  )
}
