'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'custom'

export type DailyMetric = {
  connection_id: string
  date: string
  origem: number | null
  marketplace_origem: string | null
  orders_count: number
  orders_cancelled_count: number
  orders_aprovados_count: number
  gross_revenue: number | string
  total_frete: number | string
  total_desconto: number | string
  ticket_medio: number | string
}

const fmtBrl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const fmtDateBRFull = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const fmtDateBRShort = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const origemLabel: Record<number, string> = {
  1: 'Site',
  2: 'Marketplace Próprio',
  3: 'Marketplace',
  4: 'Manual',
  5: 'PDV',
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function StatCard({ label, value, icon, tone = 'default' }: { label: string; value: string; icon: string; tone?: 'default' | 'green' | 'red' | 'blue' }) {
  const toneCls = {
    default: 'text-white',
    green: 'text-secondary',
    red: 'text-error',
    blue: 'text-primary',
  }[tone]
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <Icon name={icon} size={18} className="text-outline" />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', toneCls)}>{value}</p>
    </div>
  )
}

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
  const firstWeekday = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayIso()

  const cells: Array<{ iso: string; day: number; inMonth: boolean } | null> = []
  // Leading blanks from previous month
  const prevMonthDays = new Date(year, month, 0).getDate()
  for (let i = 0; i < firstWeekday; i++) {
    const day = prevMonthDays - firstWeekday + 1 + i
    const d = new Date(year, month - 1, day)
    cells.push({ iso: toIso(d), day, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toIso(new Date(year, month, d)), day: d, inMonth: true })
  }
  // Trailing blanks
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

  function prevMonth() {
    onChangeMonth(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    onChangeMonth(new Date(year, month + 1, 1))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Mês anterior"
        >
          <Icon name="chevron_left" size={16} />
        </button>
        <p className="text-sm font-semibold text-white">
          <span>{MONTH_NAMES[month]}</span>
          <span className="ml-1.5 font-mono text-xs text-slate-400">{year}</span>
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
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

      <div
        className="grid grid-cols-7 gap-0.5"
        onMouseLeave={() => onHover(null)}
      >
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
                c.inMonth && !isEdge && !isInRange && 'text-slate-200 hover:bg-white/5',
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

// Shopee — real Simple Icons brand path
const SHOPEE_PATH = "M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z"

// TikTok — real Simple Icons brand path
const TIKTOK_PATH = "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"

function BrandTile({ size, bg, children, ring }: { size: number; bg: string; children: React.ReactNode; ring?: string }) {
  return (
    <span
      style={{ width: size, height: size, background: bg, boxShadow: ring ?? undefined }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[6px]"
    >
      {children}
    </span>
  )
}

function ShopeeLogo({ size }: { size: number }) {
  const inner = Math.floor(size * 0.65)
  return (
    <BrandTile size={size} bg="#EE4D2D">
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d={SHOPEE_PATH} />
      </svg>
    </BrandTile>
  )
}

function TikTokLogo({ size }: { size: number }) {
  const inner = Math.floor(size * 0.6)
  return (
    <BrandTile size={size} bg="#000">
      <span className="relative" style={{ width: inner, height: inner }}>
        <svg
          width={inner}
          height={inner}
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, color: '#25F4EE', transform: 'translate(-1.2px,0.8px)', mixBlendMode: 'screen' }}
        >
          <path d={TIKTOK_PATH} fill="currentColor" />
        </svg>
        <svg
          width={inner}
          height={inner}
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, color: '#FE2C55', transform: 'translate(1.2px,-0.4px)', mixBlendMode: 'screen' }}
        >
          <path d={TIKTOK_PATH} fill="currentColor" />
        </svg>
        <svg
          width={inner}
          height={inner}
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ position: 'relative' }}
        >
          <path d={TIKTOK_PATH} fill="#fff" />
        </svg>
      </span>
    </BrandTile>
  )
}

function MlLogo({ size }: { size: number }) {
  return (
    <BrandTile size={size} bg="linear-gradient(135deg, #FFF159 0%, #FFE600 100%)">
      <span
        style={{ fontSize: size * 0.4 }}
        className="font-black leading-none tracking-[-0.06em] text-[#2D3277]"
      >
        ML
      </span>
    </BrandTile>
  )
}

function MlFullLogo({ size }: { size: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <BrandTile size={size} bg="linear-gradient(135deg, #FFF159 0%, #FFE600 100%)">
        <span
          style={{ fontSize: size * 0.4 }}
          className="font-black leading-none tracking-[-0.06em] text-[#2D3277]"
        >
          ML
        </span>
      </BrandTile>
      <span
        style={{
          width: size * 0.42,
          height: size * 0.42,
          fontSize: size * 0.18,
          right: -2,
          bottom: -2,
        }}
        className="absolute flex items-center justify-center rounded-full bg-[#00A650] font-black uppercase leading-none tracking-tight text-white ring-2 ring-[#0d1117]"
      >
        F
      </span>
    </span>
  )
}

function SheinLogo({ size }: { size: number }) {
  return (
    <BrandTile size={size} bg="#000">
      <span
        style={{ fontSize: size * 0.32, letterSpacing: '-0.05em' }}
        className="font-black leading-none text-white"
      >
        SHEIN
      </span>
    </BrandTile>
  )
}

function NetshoesLogo({ size }: { size: number }) {
  return (
    <BrandTile size={size} bg="linear-gradient(135deg, #FF4A2B 0%, #E40521 100%)">
      <span
        style={{ fontSize: size * 0.5 }}
        className="font-black italic leading-none tracking-tighter text-white"
      >
        N
      </span>
    </BrandTile>
  )
}

function MarketplaceLogo({ name, size = 24 }: { name: string | null; size?: number }) {
  if (!name || name === '__unknown__') {
    return (
      <BrandTile size={size} bg="rgba(140, 144, 159, 0.12)">
        <Icon name="help" size={Math.floor(size * 0.55)} className="text-outline" />
      </BrandTile>
    )
  }
  switch (name) {
    case 'Mercado Livre':
      return <MlLogo size={size} />
    case 'Mercado Livre Full':
      return <MlFullLogo size={size} />
    case 'Shopee':
      return <ShopeeLogo size={size} />
    case 'Shein':
      return <SheinLogo size={size} />
    case 'Netshoes':
      return <NetshoesLogo size={size} />
    case 'TikTok Shop':
      return <TikTokLogo size={size} />
    default:
      return (
        <BrandTile size={size} bg="rgba(255, 255, 255, 0.05)">
          <span
            style={{ fontSize: size * 0.42 }}
            className="font-bold leading-none text-slate-300"
          >
            {name.slice(0, 2).toUpperCase()}
          </span>
        </BrandTile>
      )
  }
}

function marketplaceLabel(raw: string | null): string {
  if (!raw || raw === '__unknown__') return 'Origem desconhecida'
  return raw
}

function MarketplaceSelect({
  value,
  options,
  onChange,
}: {
  value: string | null
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isAll = !value
  const currentLabel = isAll ? 'Todos marketplaces' : marketplaceLabel(value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-[34px] items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors',
          !isAll
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-white/10 bg-[#050507] text-slate-300 hover:border-primary/30 hover:text-white',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isAll ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-outline">
            <Icon name="apps" size={12} />
          </span>
        ) : (
          <MarketplaceLogo name={value} size={20} />
        )}
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <Icon
          name="expand_more"
          size={14}
          className={cn('text-outline transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]/97 shadow-2xl shadow-black/70 backdrop-blur-xl"
        >
          <div className="border-b border-white/5 px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-outline">
              Filtrar por marketplace
            </p>
          </div>
          <div className="max-h-[340px] overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                isAll
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-200 hover:bg-white/5',
              )}
            >
              <span className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                isAll ? 'bg-blue-500/15 text-blue-300' : 'bg-white/5 text-outline',
              )}>
                <Icon name="apps" size={14} />
              </span>
              <span className="flex-1 font-medium">Todos marketplaces</span>
              {isAll && <Icon name="check" size={14} className="text-primary" />}
            </button>

            <div className="my-1 h-px bg-white/5" />

            {options.map((opt) => {
              const active = value === opt
              const isUnknown = opt === '__unknown__'
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-200 hover:bg-white/5',
                  )}
                >
                  <MarketplaceLogo name={opt} size={28} />
                  <span className={cn('flex-1', isUnknown && !active && 'text-slate-400')}>
                    {marketplaceLabel(opt)}
                  </span>
                  {active && <Icon name="check" size={14} className="text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function DateRangePopover({
  from,
  to,
  onApply,
  onClose,
}: {
  from: string | null
  to: string | null
  onApply: (from: string, to: string) => void
  onClose: () => void
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

  return (
    <div
      className="absolute right-0 top-full z-40 mt-2 w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/97 shadow-2xl shadow-black/70 backdrop-blur-xl"
      role="dialog"
    >
      <div className="border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Icon name="event" size={16} className="text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Período personalizado</h4>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-white/5 px-5 py-3">
        <div className={cn(
          'rounded-lg border px-3 py-2 transition-colors',
          selFrom ? 'border-primary/30 bg-primary/5' : 'border-white/10 bg-[#050507]',
        )}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-outline">De</p>
          <p className={cn('mt-0.5 font-mono text-sm', selFrom ? 'text-white' : 'text-outline')}>
            {selFrom ? fmtDateBRFull(selFrom) : '—'}
          </p>
        </div>
        <div className={cn(
          'rounded-lg border px-3 py-2 transition-colors',
          selTo ? 'border-primary/30 bg-primary/5' : 'border-white/10 bg-[#050507]',
        )}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-outline">Até</p>
          <p className={cn('mt-0.5 font-mono text-sm', selTo ? 'text-white' : 'text-outline')}>
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

        <div className="mt-4 border-t border-white/5 pt-3">
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
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 bg-black/20 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
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
              : 'cursor-not-allowed bg-white/5 text-outline',
          )}
        >
          <Icon name="check" size={14} />
          Aplicar
        </button>
      </div>
    </div>
  )
}

export function MetricasView({
  rows,
  period,
  from,
  to,
  mkt,
  marketplaces,
  origem,
  nickname,
}: {
  rows: DailyMetric[]
  period: Period
  from: string | null
  to: string | null
  mkt: string | null
  marketplaces: string[]
  origem: number | null
  nickname?: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

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

  function applyCustomRange(fromIsoVal: string, toIsoVal: string) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', 'custom')
    next.set('from', fromIsoVal)
    next.set('to', toIsoVal)
    setPopoverOpen(false)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  function setMarketplace(value: string) {
    const next = new URLSearchParams(sp.toString())
    if (!value) next.delete('mkt')
    else next.set('mkt', value)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  function setOrigem(value: string) {
    const next = new URLSearchParams(sp.toString())
    if (!value) next.delete('origem')
    else next.set('origem', value)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  const mktLabel = (raw: string | null) => raw ?? 'Origem desconhecida'

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.orders += r.orders_count
        acc.cancelled += r.orders_cancelled_count
        acc.aprovados += r.orders_aprovados_count
        acc.revenue += Number(r.gross_revenue)
        acc.frete += Number(r.total_frete)
        acc.desconto += Number(r.total_desconto)
        return acc
      },
      { orders: 0, cancelled: 0, aprovados: 0, revenue: 0, frete: 0, desconto: 0 },
    )
  }, [rows])

  const ticketMedio = totals.orders > 0 ? totals.revenue / totals.orders : 0
  const cancelRate = totals.orders + totals.cancelled > 0
    ? (totals.cancelled / (totals.orders + totals.cancelled)) * 100
    : 0

  const customLabel = period === 'custom' && from && to
    ? `${fmtDateBRShort(from)} – ${fmtDateBRShort(to)}`
    : 'Personalizar'

  const sectionTitle = period === 'custom' && from && to
    ? `${fmtDateBR(from)} → ${fmtDateBR(to)}`
    : period === '7d' ? '7 dias' : period === '90d' ? '90 dias' : '30 dias'

  return (
    <>
      <TopBar title="Métricas — Magazord" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Visão geral</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {marketplaces.length > 0 && (
              <MarketplaceSelect
                value={mkt}
                options={marketplaces}
                onChange={setMarketplace}
              />
            )}

            <div className="relative">
              <Icon name="public" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <select
                value={origem ?? ''}
                onChange={(e) => setOrigem(e.target.value)}
                className={cn(
                  'h-[34px] appearance-none rounded-lg border bg-zinc-900/60 py-1.5 pl-8 pr-8 text-xs font-medium outline-none transition-colors',
                  origem != null
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50',
                )}
              >
                <option value="">Todas origens</option>
                {Object.entries(origemLabel).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
              <Icon name="expand_more" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            </div>


            <div className="flex rounded-lg border border-white/10 bg-[#050507] p-1">
              {(['7d', '30d', '90d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>

            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'custom'
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-white/10 bg-[#050507] text-slate-400 hover:border-primary/30 hover:text-white',
                )}
              >
                <Icon name="event" size={14} />
                <span className={cn(period === 'custom' && 'font-mono tracking-tight')}>{customLabel}</span>
                <Icon name={popoverOpen ? 'expand_less' : 'expand_more'} size={14} className="text-outline" />
              </button>
              {popoverOpen && (
                <DateRangePopover
                  from={from}
                  to={to}
                  onApply={applyCustomRange}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Receita Bruta" value={fmtBrl(totals.revenue)} icon="payments" tone="green" />
          <StatCard label="Pedidos Válidos" value={fmtInt(totals.orders)} icon="shopping_cart" tone="blue" />
          <StatCard label="Ticket Médio" value={fmtBrl(ticketMedio)} icon="trending_up" />
          <StatCard label="Cancelados" value={`${fmtInt(totals.cancelled)} (${cancelRate.toFixed(1)}%)`} icon="cancel" tone="red" />
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="Aprovados" value={fmtInt(totals.aprovados)} icon="check_circle" tone="green" />
          <StatCard label="Total Frete" value={fmtBrl(totals.frete)} icon="local_shipping" />
          <StatCard label="Total Desconto" value={fmtBrl(totals.desconto)} icon="local_offer" />
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Diário — {sectionTitle}</h3>
            <p className="mt-1 text-xs text-slate-400">Agregado em tempo real direto da tabela mag_orders (sem cron).</p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Marketplace</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Origem</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Pedidos</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Aprovados</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Cancelados</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receita</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Ticket Médio</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-outline">
                    Sem pedidos no período selecionado.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isUnknownMkt = !r.marketplace_origem
                  return (
                    <tr key={`${r.date}-${r.origem}-${r.marketplace_origem ?? 'unknown'}`} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">{fmtDateBR(r.date)}</td>
                      <td className="px-6 py-4 text-xs">
                        <span className={cn(
                          'inline-flex rounded px-2 py-0.5 text-[10px] font-medium',
                          isUnknownMkt
                            ? 'bg-outline/15 text-outline border border-outline/20'
                            : 'bg-primary/10 text-primary border border-primary/20',
                        )}>
                          {mktLabel(r.marketplace_origem)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{origemLabel[r.origem ?? 0] ?? `#${r.origem}`}</td>
                      <td className="px-6 py-4 text-right">{fmtInt(r.orders_count)}</td>
                      <td className="px-6 py-4 text-right text-secondary">{fmtInt(r.orders_aprovados_count)}</td>
                      <td className="px-6 py-4 text-right text-error">{fmtInt(r.orders_cancelled_count)}</td>
                      <td className="px-6 py-4 text-right font-medium">{fmtBrl(r.gross_revenue)}</td>
                      <td className="px-6 py-4 text-right text-slate-400">{fmtBrl(r.ticket_medio)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
