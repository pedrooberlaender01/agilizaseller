'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { CopyableCode } from '@/components/copyable-code'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import type { ShopeeReturn, ShopeeReturnItem } from '@/types'

export type DevolucoesPeriod = '7d' | '30d' | '90d' | 'mes' | 'custom'

const periods: { key: DevolucoesPeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

const PAGE_SIZE = 25

const statusLabel: Record<string, string> = {
  REQUESTED: 'Solicitada',
  PROCESSING: 'Em andamento',
  ACCEPTED: 'Aceita',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
  JUDGING: 'Em julgamento',
  CLOSED: 'Encerrada',
  SELLER_DISPUTE: 'Disputa aberta',
  REFUND_PAID: 'Reembolsada',
}

const statusTone: Record<string, string> = {
  REQUESTED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ACCEPTED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  REJECTED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  CANCELLED: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
  JUDGING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  CLOSED: 'bg-zinc-700/30 text-zinc-300 border-zinc-700/40',
  SELLER_DISPUTE: 'bg-red-500/10 text-red-400 border-red-500/30',
  REFUND_PAID: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
}

const reasonLabel: Record<string, string> = {
  ITEM_NOT_FIT: 'Não serviu (tamanho)',
  NOT_FIT: 'Não serviu',
  WRONG_ITEM: 'Item errado enviado',
  NOT_RECEIPT: 'Não recebido',
  ITEM_MISSING: 'Item faltando no pacote',
  CHANGE_MIND: 'Desistência',
  DAMAGED_OTHERS: 'Danificado (outros)',
  PHYSICAL_DMG: 'Dano físico',
  FUNCTIONAL_DMG: 'Defeito funcional',
  ITEM_DAMAGED: 'Item danificado',
  SUSPICIOUS_PARCEL: 'Pacote suspeito',
  SUSPICIOUS: 'Suspeito',
  COUNTERFEIT: 'Falsificado',
  ITEM_WRONG_DESCRIPTION: 'Descrição errada',
  NOT_AS_DESCRIBED: 'Não como descrito',
  CANNOT_USE: 'Não funciona',
  EXPIRED: 'Vencido',
  RECEIVED_WRONG_ITEM: 'Recebeu errado',
  DAMAGED: 'Danificado',
  MISSING: 'Faltando',
  OTHER: 'Outro',
}

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => n.toLocaleString('pt-BR')
const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const fmtShortDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type ReasonAgg = { reason: string; count: number; value_cents: number }

function topReasons(returns: ShopeeReturn[]): ReasonAgg[] {
  const map = new Map<string, ReasonAgg>()
  for (const r of returns) {
    const key = r.reason || 'OTHER'
    if (!map.has(key)) map.set(key, { reason: key, count: 0, value_cents: 0 })
    const agg = map.get(key)!
    agg.count++
    agg.value_cents += Number(r.refund_amount_cents) || 0
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function buildDaily(returns: ShopeeReturn[]) {
  const byDate = new Map<string, { count: number; value_cents: number }>()
  for (const r of returns) {
    if (!r.create_time) continue
    const d = r.create_time.slice(0, 10)
    if (!byDate.has(d)) byDate.set(d, { count: 0, value_cents: 0 })
    const e = byDate.get(d)!
    e.count++
    e.value_cents += Number(r.refund_amount_cents) || 0
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, count: v.count, value: v.value_cents / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

type DailyPoint = { date: string; count: number; value: number }

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

function ChartStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: 'error' | 'warn' | 'ok'
}) {
  const valueTone =
    tone === 'error' ? 'text-error' : tone === 'warn' ? 'text-amber-400' : tone === 'ok' ? 'text-emerald-400' : 'text-zinc-50'
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <span className="text-[9px] text-zinc-500 uppercase tracking-[0.12em] font-semibold">{label}</span>
      <span className={cn('text-sm font-bold font-mono leading-tight', valueTone)}>{value}</span>
      <span className="text-[9px] text-zinc-600 leading-tight">{sub}</span>
    </div>
  )
}

function DailyReturnsChart({
  daily,
  totalReturns,
  totalValue,
}: {
  daily: DailyPoint[]
  totalReturns: number
  totalValue: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (daily.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/40">
        <div className="px-lg py-md border-b border-white/5">
          <h3 className="font-h3 text-h3 text-zinc-50 flex items-center gap-2">
            <span className="inline-block w-1 h-5 rounded-sm bg-gradient-to-b from-red-400 to-red-700" />
            Devoluções por Dia
          </h3>
        </div>
        <div className="text-center text-zinc-500 py-16 text-sm">Sem devoluções no período</div>
      </div>
    )
  }

  const maxCount = Math.max(...daily.map(d => d.count), 1)
  const niceMax = Math.ceil(maxCount / 5) * 5 || 5
  const gridLevels = [niceMax, Math.round(niceMax * 0.75), Math.round(niceMax * 0.5), Math.round(niceMax * 0.25), 0]

  const avg = totalReturns / daily.length
  const avgPct = (avg / maxCount) * 100

  const half = Math.max(1, Math.floor(daily.length / 2))
  const firstHalfCount = daily.slice(0, half).reduce((a, d) => a + d.count, 0)
  const secondHalfCount = daily.slice(half).reduce((a, d) => a + d.count, 0)
  const firstHalfAvg = firstHalfCount / half
  const secondHalfAvg = secondHalfCount / Math.max(1, daily.length - half)
  const trend = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0

  const maxDay = daily.reduce((a, d) => (d.count > a.count ? d : a), daily[0])
  const worstDay = daily.reduce((a, d) => (d.value > a.value ? d : a), daily[0])

  const tickStep = Math.max(1, Math.ceil(daily.length / 10))

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(24,24,27,0.6), rgba(24,24,27,0.4), rgba(9,9,11,0.4))',
        border: '1px solid #27272a',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'block',
        width: '100%',
        minHeight: '440px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className="font-h3 text-h3 text-zinc-50 flex items-center gap-2">
            <span
              className="inline-block w-1 h-5 rounded-sm bg-gradient-to-b from-red-400 to-red-700 shadow-[0_0_12px_rgba(248,113,113,0.4)]"
            />
            Devoluções por Dia
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-[0.15em] font-medium">
            {daily.length} {daily.length === 1 ? 'dia monitorado' : 'dias monitorados'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <ChartStat label="Total" value={fmtNum(totalReturns)} sub="devoluções" />
          <div style={{ height: '36px', width: '1px', background: '#27272a', flexShrink: 0 }} />
          <ChartStat label="Valor" value={fmtBrlInt(totalValue)} sub="perdido" tone="error" />
          <div style={{ height: '36px', width: '1px', background: '#27272a', flexShrink: 0 }} />
          <ChartStat label="Média/dia" value={avg.toFixed(1)} sub="devoluções" />
          <div style={{ height: '36px', width: '1px', background: '#27272a', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            <span className="text-[9px] text-zinc-500 uppercase tracking-[0.12em] font-semibold">Tendência</span>
            <div className={cn('flex items-center gap-1 text-sm font-bold leading-tight', trend > 0 ? 'text-error' : trend < 0 ? 'text-emerald-400' : 'text-zinc-50')}>
              <span className="material-symbols-outlined text-[14px]">
                {trend > 0 ? 'north_east' : trend < 0 ? 'south_east' : 'east'}
              </span>
              {Math.abs(trend).toFixed(1)}%
            </div>
            <span className="text-[9px] text-zinc-600 leading-tight">2ª vs 1ª metade</span>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div
        onMouseLeave={() => setHover(null)}
        style={{ position: 'relative', padding: '20px 20px 12px 20px', display: 'block' }}
      >
        <div style={{ display: 'flex', height: '240px', width: '100%' }}>
          {/* Y axis labels */}
          <div className="relative" style={{ width: '40px', flexShrink: 0 }}>
            {gridLevels.map((level) => {
              const pct = niceMax > 0 ? (level / niceMax) * 100 : 0
              return (
                <div
                  key={level}
                  className="text-[9px] text-zinc-500 font-mono leading-none"
                  style={{ position: 'absolute', right: '8px', bottom: `${pct}%`, transform: 'translateY(50%)' }}
                >
                  {level}
                </div>
              )
            })}
          </div>

          {/* Plot area */}
          <div
            className="border-l border-b border-zinc-700"
            style={{ position: 'relative', flex: '1 1 0%', minWidth: 0 }}
          >
            {/* Gridlines */}
            {gridLevels.map((level) => {
              if (level === 0) return null
              const pct = niceMax > 0 ? (level / niceMax) * 100 : 0
              return (
                <div
                  key={`grid-${level}`}
                  className="border-t border-dashed border-zinc-800"
                  style={{ position: 'absolute', left: 0, right: 0, bottom: `${pct}%` }}
                />
              )
            })}

            {/* Average line */}
            <div
              className="border-t border-dashed border-yellow-400/60"
              style={{ position: 'absolute', left: 0, right: 0, bottom: `${avgPct}%`, zIndex: 1 }}
            >
              <span
                className="bg-yellow-400/15 border border-yellow-400/40 rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold text-yellow-400"
                style={{ position: 'absolute', right: '-4px', transform: 'translateY(-50%)' }}
              >
                {avg.toFixed(1)} méd
              </span>
            </div>

            {/* Bars */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px',
                padding: '0 4px',
              }}
            >
              {daily.map((d, i) => {
                const h = (d.count / maxCount) * 100
                const isHover = hover === i
                return (
                  <div
                    key={d.date}
                    onMouseEnter={() => setHover(i)}
                    style={{
                      flex: '1 1 0%',
                      minWidth: '4px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      cursor: 'crosshair',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: `${Math.max(h, 0.5)}%`,
                        width: '100%',
                        maxWidth: '20px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        borderTopLeftRadius: '3px',
                        borderTopRightRadius: '3px',
                        background: isHover
                          ? 'linear-gradient(to bottom, #fecaca 0%, #f87171 50%, #991b1b 100%)'
                          : 'linear-gradient(to bottom, #fca5a5 0%, #ef4444 50%, rgba(127,29,29,0.4) 100%)',
                        boxShadow: isHover ? '0 0 12px rgba(248,113,113,0.6)' : 'none',
                        transition: 'all 150ms',
                      }}
                    />
                    {isHover && (
                      <span
                        className="font-mono font-bold text-red-200"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          bottom: `calc(${Math.max(h, 0.5)}% + 4px)`,
                          fontSize: '10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.count}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* X axis */}
        <div className="flex pl-10 mt-1">
          <div className="flex-1 flex justify-between px-1 text-[9px] text-zinc-500 font-mono">
            {daily.map((d, i) => {
              if (i % tickStep !== 0 && i !== daily.length - 1) return <span key={d.date} className="flex-1" />
              return (
                <span key={d.date} className="flex-1 text-center">
                  {fmtShortDate(d.date)}
                </span>
              )
            })}
          </div>
        </div>

        {/* Tooltip */}
        {hover != null && daily[hover] && (() => {
          const d = daily[hover]
          const leftPct = daily.length === 1 ? 50 : (hover / (daily.length - 1)) * 100
          const clamped = Math.max(10, Math.min(90, leftPct))
          return (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-zinc-700 bg-zinc-950/95 backdrop-blur-md px-3 py-2.5 shadow-2xl shadow-black/60 min-w-[180px] -translate-x-1/2"
              style={{
                left: `calc(40px + ${clamped}% * 0.92)`,
                top: 8,
              }}
            >
              <div className="text-[9px] text-zinc-500 uppercase tracking-[0.12em] font-semibold mb-1.5 flex items-center gap-1.5">
                <span className="block w-1 h-1 rounded-full bg-error" />
                {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                })}
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Devoluções</div>
                  <div className="text-xl font-bold text-zinc-50 font-mono leading-none mt-1">{d.count}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Valor</div>
                  <div className="text-sm font-bold text-error font-mono leading-none mt-1">R$ {fmtBrl(d.value)}</div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Footer / legend */}
        <div className="flex items-center justify-between pt-md mt-md border-t border-white/5 text-[10px] text-zinc-500 gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="block w-3 h-2 rounded-sm bg-gradient-to-b from-red-300 via-red-500 to-red-900 opacity-90" />
              <span className="uppercase tracking-wider font-medium">Volume diário</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="block w-3 border-t border-dashed border-yellow-400 opacity-60" />
              <span className="uppercase tracking-wider font-medium">Média</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span>
              <span className="text-zinc-600 uppercase tracking-wider">Pico:</span>{' '}
              <span className="text-zinc-300 font-mono font-semibold">{maxDay.count}</span>
              <span className="text-zinc-500 font-mono ml-1">{fmtShortDate(maxDay.date)}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              <span className="text-zinc-600 uppercase tracking-wider">Pior:</span>{' '}
              <span className="text-error font-mono font-semibold">{fmtBrlInt(worstDay.value)}</span>
              <span className="text-zinc-500 font-mono ml-1">{fmtShortDate(worstDay.date)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DevolucoesView({
  returns,
  ordersCount,
  period,
  statusFilter,
  customFrom,
  customTo,
  nickname,
}: {
  returns: ShopeeReturn[]
  ordersCount: number
  period: DevolucoesPeriod
  statusFilter: string
  customFrom: string | null
  customTo: string | null
  nickname: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<ShopeeReturn | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [page, setPage] = useState(0)
  const datePickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showDatePicker) return
    function onDown(e: MouseEvent) {
      if (!datePickerRef.current) return
      if (!datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false)
    }
    document.addEventListener('mousedown', onDown)
    const t = setTimeout(() => {
      const el = datePickerRef.current?.querySelector('[role="dialog"]') as HTMLElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
    return () => {
      document.removeEventListener('mousedown', onDown)
      clearTimeout(t)
    }
  }, [showDatePicker])

  useEffect(() => {
    setPage(0)
  }, [statusFilter, period, customFrom, customTo, returns.length])

  function setPeriod(p: DevolucoesPeriod) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    if (p !== 'custom') {
      sp.delete('from')
      sp.delete('to')
    }
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', 'custom')
    sp.set('from', from)
    sp.set('to', to)
    setShowDatePicker(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function setStatus(s: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (s === 'all') sp.delete('status')
    else sp.set('status', s)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const reasons = useMemo(() => topReasons(returns), [returns])
  const daily = useMemo(() => buildDaily(returns), [returns])

  const totalReturns = returns.length
  const totalValueCents = returns.reduce((a, r) => a + (Number(r.refund_amount_cents) || 0), 0)
  const totalValue = totalValueCents / 100
  const returnRate = ordersCount > 0 ? (totalReturns / ordersCount) * 100 : 0

  const activeDisputes = returns.filter(r =>
    r.return_status === 'SELLER_DISPUTE' || r.return_status === 'JUDGING' || (r.dispute_status && r.dispute_status !== 'CLOSED' && r.dispute_status !== 'RESOLVED'),
  ).length

  const now = Date.now()
  const awaitingAction = returns.filter(r => {
    if (r.return_status !== 'REQUESTED' && r.return_status !== 'PROCESSING') return false
    if (!r.needs_response_due_date) return r.return_status === 'REQUESTED'
    const due = new Date(r.needs_response_due_date).getTime()
    return due > now
  }).length

  const topReason = reasons[0]
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return returns
    return returns.filter(r => r.return_status === statusFilter)
  }, [returns, statusFilter])

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of returns) {
      const k = r.return_status || 'UNKNOWN'
      m.set(k, (m.get(k) || 0) + 1)
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [returns])

  return (
    <>
      <TopBar title="Devoluções — Shopee" />
      <main
        className={cn(
          'flex flex-1 flex-col gap-gutter overflow-y-auto p-margin',
          pending && 'opacity-70 pointer-events-none',
        )}
        style={showDatePicker ? { paddingBottom: '560px' } : undefined}
      >
        <div>
          <h1 className="font-h1 text-h1 text-zinc-50 flex items-center gap-sm">
            Devoluções
            <span className="text-zinc-500 font-normal">—</span>
            <span className="text-zinc-50">Shopee</span>
          </h1>
          <p className="font-body-md text-body-md text-zinc-400 mt-1">
            {nickname ? `Conta ${nickname}` : 'Conta Shopee ativa'} · monitoramento de devoluções e disputas.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
          {[
            { label: 'Devoluções', value: fmtNum(totalReturns), icon: 'undo', tone: 'text-zinc-50' },
            { label: 'Taxa de Devolução', value: `${returnRate.toFixed(2)}%`, icon: 'percent', tone: returnRate > 5 ? 'text-error' : 'text-zinc-50' },
            { label: 'Valor Perdido', value: fmtBrlInt(totalValue), icon: 'money_off', tone: 'text-error' },
            { label: 'Disputas Ativas', value: fmtNum(activeDisputes), icon: 'gavel', tone: activeDisputes > 0 ? 'text-amber-400' : 'text-zinc-50' },
            { label: 'Aguardando Ação', value: fmtNum(awaitingAction), icon: 'pending_actions', tone: awaitingAction > 0 ? 'text-yellow-400' : 'text-zinc-50' },
            {
              label: 'Top Motivo',
              value: topReason ? (reasonLabel[topReason.reason] || topReason.reason) : '—',
              icon: 'priority_high',
              tone: 'text-tertiary',
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
                <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
              </div>
              <div className={cn('font-h2 text-h2 truncate', kpi.tone)}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Gráfico evolução */}
        <DailyReturnsChart daily={daily} totalReturns={totalReturns} totalValue={totalValue} />

        {/* Top motivos */}
        {reasons.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
            <div className="p-lg border-b border-white/10">
              <h3 className="font-h3 text-h3 text-zinc-50">Top Motivos</h3>
              <p className="text-xs text-zinc-500 mt-1">Distribuição de motivos no período</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
                <thead className="bg-zinc-900/60">
                  <tr>
                    <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Motivo</th>
                    <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Qtd</th>
                    <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">% Total</th>
                    <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor</th>
                    <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Distribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reasons.slice(0, 8).map((r) => {
                    const pct = (r.count / totalReturns) * 100
                    return (
                      <tr key={r.reason} className="hover:bg-white/[0.02]">
                        <td className="px-lg py-3 text-zinc-50">
                          <div className="flex flex-col">
                            <span>{reasonLabel[r.reason] || r.reason}</span>
                            <span className="text-[10px] text-zinc-600 font-mono">{r.reason}</span>
                          </div>
                        </td>
                        <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtNum(r.count)}</td>
                        <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{pct.toFixed(1)}%</td>
                        <td className="px-md py-3 text-right font-mono-sm text-error font-semibold">
                          {fmtBrlInt(r.value_cents / 100)}
                        </td>
                        <td className="px-lg py-3 min-w-[160px]">
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-error" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lista devoluções */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
          {/* Header + filtros */}
          <div className="p-lg border-b border-white/10 flex flex-col gap-md">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-h3 text-h3 text-zinc-50">
                Devoluções {statusFilter !== 'all' && (
                  <span className="text-zinc-500 font-normal text-sm ml-2">{statusLabel[statusFilter] || statusFilter}</span>
                )}
              </h3>
              <span className="text-xs text-zinc-500">
                {fmtNum(filtered.length)} {filtered.length === 1 ? 'devolução' : 'devoluções'} no filtro
              </span>
            </div>

            {/* Filtro período + custom */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center rounded-lg p-1 border border-zinc-800 bg-zinc-900/60">
                {periods.map((p) => {
                  const active = period === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPeriod(p.key)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        active ? 'bg-zinc-50 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-50',
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <div ref={datePickerRef} className="relative z-30">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(v => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    period === 'custom'
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-50',
                  )}
                >
                  <span className="material-symbols-outlined text-[14px]">event</span>
                  {period === 'custom' && customFrom && customTo
                    ? `${fmtDateBRShort(customFrom)} → ${fmtDateBRShort(customTo)}`
                    : 'Personalizado'}
                </button>
                {showDatePicker && (
                  <DateRangePopover
                    from={customFrom}
                    to={customTo}
                    onApply={applyCustomRange}
                    onClose={() => setShowDatePicker(false)}
                    align="left"
                  />
                )}
              </div>
            </div>

            {/* Filtro status pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setStatus('all')}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-medium border transition-colors',
                  statusFilter === 'all'
                    ? 'bg-zinc-50 text-zinc-900 border-zinc-50'
                    : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-zinc-50',
                )}
              >
                Todos ({fmtNum(totalReturns)})
              </button>
              {statusCounts.map(([s, n]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-medium border transition-colors',
                    statusFilter === s
                      ? 'bg-zinc-50 text-zinc-900 border-zinc-50'
                      : `${statusTone[s] || 'bg-zinc-900/40 text-zinc-400 border-zinc-800'} hover:opacity-80`,
                  )}
                >
                  {statusLabel[s] || s} ({fmtNum(n)})
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap border-separate border-spacing-0">
              <thead className="sticky top-0 z-20">
                <tr className="bg-zinc-950">
                  <th className="bg-zinc-950 px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Data</th>
                  <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Return SN</th>
                  <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Pedido</th>
                  <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Status</th>
                  <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Motivo</th>
                  <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right border-b border-white/10">Reembolso</th>
                  <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-zinc-500 py-8">Sem devoluções</td>
                  </tr>
                ) : (
                  filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r) => {
                    const value = Number(r.refund_amount_cents) / 100
                    const due = r.needs_response_due_date ? new Date(r.needs_response_due_date) : null
                    const urgent = due && due.getTime() < now + 24 * 3600 * 1000 && due.getTime() > now
                    const overdue = due && due.getTime() < now
                    const firstItem = Array.isArray(r.item_list) && r.item_list.length > 0 ? r.item_list[0] : null
                    const itemName = firstItem?.name || null
                    const extraItems = Array.isArray(r.item_list) ? r.item_list.length - 1 : 0
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-white/[0.04] cursor-pointer"
                        onClick={() => setSelected(r)}
                      >
                        <td className="px-lg py-2 text-zinc-400 text-xs">
                          {r.create_time ? fmtDate(r.create_time) : '—'}
                        </td>
                        <td className="px-md py-2">
                          <CopyableCode code={r.return_sn} monoOnly />
                        </td>
                        <td className="px-md py-2 max-w-[280px]">
                          {r.order_sn ? (
                            <CopyableCode
                              code={r.order_sn}
                              label={itemName ? `${itemName}${extraItems > 0 ? ` +${extraItems}` : ''}` : null}
                            />
                          ) : '—'}
                        </td>
                        <td className="px-md py-2">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded text-[10px] font-semibold border',
                            statusTone[r.return_status || ''] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
                          )}>
                            {statusLabel[r.return_status || ''] || r.return_status || '—'}
                          </span>
                        </td>
                        <td className="px-md py-2 text-zinc-400 text-xs">
                          {r.reason ? (reasonLabel[r.reason] || r.reason) : '—'}
                        </td>
                        <td className="px-md py-2 text-right font-mono-sm text-error font-semibold">
                          R$ {fmtBrl(value)}
                        </td>
                        <td className="px-md py-2 text-xs">
                          {due ? (
                            <span className={cn(
                              overdue ? 'text-red-500 font-semibold' : urgent ? 'text-yellow-400' : 'text-zinc-500',
                            )}>
                              {overdue ? 'Vencido' : fmtDate(due.toISOString())}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Paginação */}
          {filtered.length > 0 && (() => {
            const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
            const safePage = Math.min(page, totalPages - 1)
            const startIdx = safePage * PAGE_SIZE + 1
            const endIdx = Math.min((safePage + 1) * PAGE_SIZE, filtered.length)
            return (
              <div className="p-md border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-zinc-500">
                  {fmtNum(startIdx)}–{fmtNum(endIdx)} de {fmtNum(filtered.length)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(0)}
                    disabled={safePage === 0}
                    className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    title="Primeira página"
                  >
                    <span className="material-symbols-outlined text-[16px]">first_page</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    title="Anterior"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <span className="px-3 text-xs text-zinc-300 font-mono">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    title="Próxima"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages - 1)}
                    disabled={safePage >= totalPages - 1}
                    className="p-1.5 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    title="Última página"
                  >
                    <span className="material-symbols-outlined text-[16px]">last_page</span>
                  </button>
                </div>
                <span className="text-[10px] text-zinc-600">{PAGE_SIZE} itens por página</span>
              </div>
            )
          })()}
        </div>
      </main>

      {/* Drawer detalhe */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-2xl h-full bg-zinc-950 border-l border-zinc-800 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 p-lg flex items-start justify-between gap-3 z-10">
              <div className="flex-1 min-w-0">
                <h2 className="font-h2 text-h2 text-zinc-50">Devolução</h2>
                <div className="mt-1 flex flex-col gap-0.5">
                  <CopyableCode code={selected.return_sn} monoOnly size="sm" />
                  {selected.order_sn && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span>Pedido:</span>
                      <CopyableCode code={selected.order_sn} monoOnly />
                    </div>
                  )}
                  <span className="text-[10px] text-zinc-600 mt-1">
                    {selected.create_time ? fmtDate(selected.create_time) : '—'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-900"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-lg flex flex-col gap-lg">
              {/* Status + valor */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Status</div>
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded text-xs font-semibold border',
                    statusTone[selected.return_status || ''] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
                  )}>
                    {statusLabel[selected.return_status || ''] || selected.return_status || '—'}
                  </span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Reembolso</div>
                  <div className="font-h3 text-h3 text-error">
                    R$ {fmtBrl(Number(selected.refund_amount_cents) / 100)}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Solução</div>
                  <div className="text-sm text-zinc-50">{selected.return_solution || '—'}</div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Comprador</div>
                  <div className="text-sm text-zinc-50 font-mono">{selected.buyer_username || '—'}</div>
                </div>
              </div>

              {/* Motivo */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Motivo</div>
                <div className="text-sm text-zinc-50 mb-1">
                  {selected.reason ? (reasonLabel[selected.reason] || selected.reason) : '—'}
                </div>
                {selected.text_reason && (
                  <p className="text-xs text-zinc-400 italic mt-2 border-l-2 border-zinc-700 pl-2">
                    “{selected.text_reason}”
                  </p>
                )}
              </div>

              {/* Disputa */}
              {(selected.dispute_status || selected.dispute_reason) && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-md">
                  <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">gavel</span>
                    Disputa
                  </div>
                  <div className="text-sm text-zinc-50">{selected.dispute_status || '—'}</div>
                  {selected.dispute_reason && (
                    <p className="text-xs text-zinc-400 mt-1">{selected.dispute_reason}</p>
                  )}
                </div>
              )}

              {/* Items */}
              {Array.isArray(selected.item_list) && selected.item_list.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <div className="px-md py-2 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                    Itens devolvidos ({selected.item_list.length})
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {selected.item_list.map((it: ShopeeReturnItem, idx: number) => (
                      <div key={idx} className="p-md flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-zinc-50">{it.name || `Item ${idx + 1}`}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {it.item_id != null && (
                              <CopyableCode code={String(it.item_id)} label={null} monoOnly />
                            )}
                            {it.model_id != null && (
                              <CopyableCode code={String(it.model_id)} label={null} monoOnly />
                            )}
                            {it.sku && (
                              <CopyableCode code={it.sku} label={null} monoOnly />
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="text-zinc-50">Qtd {it.amount ?? '—'}</div>
                          {(it.item_price ?? it.refund_amount) != null && (
                            <div className="text-error font-mono mt-1">
                              R$ {fmtBrl(Number(it.refund_amount ?? it.item_price ?? 0))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidências */}
              {selected.evidence_urls && selected.evidence_urls.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                    Evidências ({selected.evidence_urls.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.evidence_urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Logística */}
              {(selected.tracking_number || selected.shipping_carrier) && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Rastreio</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-zinc-500">Transportadora:</span>{' '}
                      <span className="text-zinc-50">{selected.shipping_carrier || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 shrink-0">Código:</span>
                      {selected.tracking_number
                        ? <CopyableCode code={selected.tracking_number} monoOnly />
                        : <span className="text-zinc-50">—</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Prazos */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Prazo resposta</div>
                  <div className="text-zinc-50">
                    {selected.needs_response_due_date ? fmtDate(selected.needs_response_due_date) : '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Encerramento</div>
                  <div className="text-zinc-50">
                    {selected.due_date ? fmtDate(selected.due_date) : '—'}
                  </div>
                </div>
              </div>

              {/* Última atualização */}
              <div className="text-[10px] text-zinc-600 text-center">
                Sincronizado em {fmtDate(selected.synced_at)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
