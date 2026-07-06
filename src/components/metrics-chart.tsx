'use client'

import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type MetricKey = 'faturamento' | 'pedidos' | 'lucro'
export type Period = '7d' | '30d' | '90d' | 'mes'

const TODAY = new Date(2026, 3, 30) // 30/04/2026

const pad = (n: number) => String(n).padStart(2, '0')
const fmtFull = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
const fmtShort = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

function getDates(period: Period): Date[] {
  if (period === 'mes') {
    const len = TODAY.getDate()
    return Array.from(
      { length: len },
      (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth(), i + 1),
    )
  }
  const len = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return Array.from(
    { length: len },
    (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - (len - 1 - i)),
  )
}

const shapeParams: Record<MetricKey, { base: number; growth: number; noise: number; freq: number }> = {
  faturamento: { base: 3000, growth: 5000, noise: 600, freq: 0.7 },
  pedidos:     { base: 55,   growth: 85,   noise: 10,  freq: 0.6 },
  lucro:       { base: 800,  growth: 1350, noise: 160, freq: 0.7 },
}

function genSeries(metric: MetricKey, len: number, prev: boolean): number[] {
  const p = shapeParams[metric]
  const mult = prev ? 0.85 : 1
  const offset = prev ? 5 : 0
  return Array.from({ length: len }, (_, i) => {
    const t = len <= 1 ? 1 : i / (len - 1)
    const v = (p.base + p.growth * t + Math.sin((i + offset) * p.freq) * p.noise) * mult
    return Math.max(0, Math.round(v))
  })
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`
const num = (n: number) => n.toLocaleString('pt-BR')

const seriesMeta: Record<MetricKey, { label: string; color: string; format: (n: number) => string; axis: (n: number) => string }> = {
  faturamento: {
    label: 'Faturamento',
    color: '#3b82f6',
    format: brl,
    axis: (n) => (n >= 1000 ? `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `R$ ${Math.round(n)}`),
  },
  pedidos: {
    label: 'Pedidos',
    color: '#34d399',
    format: num,
    axis: (n) => `${Math.round(n)}`,
  },
  lucro: {
    label: 'Lucro',
    color: '#facc3c',
    format: brl,
    axis: (n) => (n >= 1000 ? `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `R$ ${Math.round(n)}`),
  },
}

const tabs: MetricKey[] = ['faturamento', 'pedidos', 'lucro']

function niceMax(m: number) {
  if (m <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(m)))
  return Math.ceil(m / exp) * exp
}

function buildPoints(values: number[], max: number) {
  const dx = values.length === 1 ? 0 : 100 / (values.length - 1)
  return values
    .map((v, i) => `${(i * dx).toFixed(3)},${(100 - (v / max) * 100).toFixed(3)}`)
    .join(' ')
}

export type MetricsChartData = {
  dates: Date[]
  current: { faturamento: number[]; pedidos: number[]; lucro: number[] }
  previous: { faturamento: number[]; pedidos: number[]; lucro: number[] }
}

export function MetricsChart({
  period = '30d',
  data,
}: {
  period?: Period
  data?: MetricsChartData
}) {
  const [tab, setTab] = useState<MetricKey>('faturamento')
  const [showCurrent, setShowCurrent] = useState(true)
  const [showPrevious, setShowPrevious] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const meta = seriesMeta[tab]

  const { dates, current, previous } = useMemo(() => {
    if (data) {
      return {
        dates: data.dates,
        current: data.current[tab],
        previous: data.previous[tab],
      }
    }
    const d = getDates(period)
    const len = d.length
    return {
      dates: d,
      current: genSeries(tab, len, false),
      previous: genSeries(tab, len, true),
    }
  }, [tab, period, data])

  const len = current.length
  const lastIdx = Math.max(0, len - 1)

  const max = useMemo(
    () => niceMax(Math.max(...current, ...previous) * 1.05),
    [current, previous],
  )
  const currentPoints = useMemo(() => buildPoints(current, max), [current, max])
  const previousPoints = useMemo(() => buildPoints(previous, max), [previous, max])

  const ticks = [1, 0.75, 0.5, 0.25, 0]
  const dateMarkers = useMemo(() => {
    if (len === 0) return []
    const count = Math.min(7, len)
    if (count <= 1) return [0]
    return Array.from({ length: count }, (_, i) => Math.round((i * (len - 1)) / (count - 1)))
  }, [len])

  const idx = Math.min(hovered ?? Math.floor(lastIdx / 2), lastIdx)
  const hasHover = hovered !== null && len > 0 && current[idx] != null
  const cx = lastIdx === 0 ? 50 : (idx / lastIdx) * 100
  const curY = 100 - (current[idx] / max) * 100
  const prevY = 100 - (previous[idx] / max) * 100
  const curVal = current[idx]
  const prevVal = previous[idx]
  const delta = prevVal === 0 ? 0 : ((curVal - prevVal) / prevVal) * 100

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = overlayRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const r = (e.clientX - rect.left) / rect.width
    const i = Math.max(0, Math.min(lastIdx, Math.round(r * lastIdx)))
    setHovered(i)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col relative">
      <div className="flex flex-wrap items-end gap-3 border-b border-white/10 px-lg pt-3">
        <div className="flex items-end gap-1">
          {tabs.map((k) => {
            const s = seriesMeta[k]
            const active = k === tab
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={cn(
                  'relative px-3 pb-3 pt-2 font-label-md text-label-md transition-colors',
                  active ? 'text-zinc-50' : 'text-zinc-400 hover:text-zinc-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full transition-shadow"
                    style={{
                      background: s.color,
                      boxShadow: active ? `0 0 8px ${s.color}` : 'none',
                    }}
                  />
                  {s.label}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                    style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 pb-3">
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1 text-label-md font-label-md transition-colors',
              showCurrent ? 'text-zinc-50' : 'text-zinc-600',
            )}
            aria-pressed={showCurrent}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: showCurrent ? meta.color : 'transparent',
                border: `1.5px solid ${meta.color}`,
                boxShadow: showCurrent ? `0 0 8px ${meta.color}80` : 'none',
              }}
            />
            Atual
          </button>
          <button
            type="button"
            onClick={() => setShowPrevious((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1 text-label-md font-label-md transition-colors',
              showPrevious ? 'text-zinc-50' : 'text-zinc-600',
            )}
            aria-pressed={showPrevious}
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-dashed"
              style={{
                borderColor: '#8c909f',
                background: showPrevious ? 'rgba(140,144,159,0.25)' : 'transparent',
              }}
            />
            Período Ant.
          </button>
        </div>
      </div>

      <div className="relative h-[320px] pb-9 pl-16 pr-lg pt-lg">
        <div className="pointer-events-none absolute bottom-9 left-3 top-lg flex flex-col justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          {ticks.map((t) => (
            <span key={t} className="tabular-nums">{meta.axis(max * t)}</span>
          ))}
        </div>

        <div
          ref={overlayRef}
          className="relative h-full w-full cursor-crosshair"
          onMouseMove={handleMove}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <div
                key={i}
                className="h-px w-full bg-gradient-to-r from-white/0 via-white/8 to-white/0"
              />
            ))}
          </div>

          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`grad-${tab}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {showPrevious && (
              <polyline
                fill="none"
                points={previousPoints}
                stroke="#5a6477"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {showCurrent && len > 1 && (
              <>
                <polygon fill={`url(#grad-${tab})`} points={`0,100 ${currentPoints} 100,100`} />
                <polyline
                  fill="none"
                  points={currentPoints}
                  stroke={meta.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            {showCurrent && len === 1 && (
              <line
                x1="50"
                x2="50"
                y1={100 - (current[0] / max) * 100}
                y2="100"
                stroke={meta.color}
                strokeOpacity="0.35"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {hovered !== null && (
              <line
                x1={cx}
                x2={cx}
                y1="0"
                y2="100"
                stroke="rgba(255,255,255,0.18)"
                strokeDasharray="2 3"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {showCurrent && len === 1 && (
            <div
              className="pointer-events-none absolute z-10 flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: '50%', top: `${100 - (current[0] / max) * 100}%` }}
            >
              <span
                className="h-3 w-3 rounded-full ring-4 ring-[#0d1117]"
                style={{
                  background: meta.color,
                  boxShadow: `0 0 12px ${meta.color}`,
                }}
              />
              <span
                className="mt-1.5 rounded-md border border-white/10 bg-[#0d1117]/95 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-50 backdrop-blur"
              >
                {meta.axis(current[0])}
              </span>
            </div>
          )}

          {hasHover && showPrevious && (
            <span
              className="pointer-events-none absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8c909f]"
              style={{ left: `${cx}%`, top: `${prevY}%` }}
            />
          )}
          {hasHover && showCurrent && (
            <span
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${cx}%`, top: `${curY}%`, background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
            />
          )}

          {hasHover && (() => {
            const anchorY = showCurrent ? curY : prevY
            const placeBelow = anchorY < 30
            const tx = cx > 75 ? '-100%' : cx < 25 ? '0%' : '-50%'
            const ty = placeBelow ? '14px' : 'calc(-100% - 14px)'
            return (
              <div
                className="pointer-events-none absolute z-20 w-[210px]"
                style={{
                  left: `${cx}%`,
                  top: `${anchorY}%`,
                  transform: `translate(${tx}, ${ty})`,
                }}
              >
                <div className="rounded-lg border border-white/10 bg-[#050507]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-md">
                  <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                      {dates[idx] ? fmtFull(dates[idx]) : ''}
                    </span>
                    {showCurrent && showPrevious && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                          delta >= 0
                            ? 'bg-secondary/15 text-secondary'
                            : 'bg-error/15 text-error',
                        )}
                      >
                        {delta >= 0 ? '+' : ''}
                        {delta.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {showCurrent && (
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="text-[11px] text-zinc-500">Atual</span>
                        </div>
                        <span
                          className="font-mono text-[13px] font-semibold tabular-nums"
                          style={{ color: meta.color }}
                        >
                          {meta.format(curVal)}
                        </span>
                      </div>
                    )}
                    {showPrevious && (
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full border border-dashed border-outline" />
                          <span className="text-[11px] text-zinc-500">Anterior</span>
                        </div>
                        <span className="font-mono text-[12px] text-zinc-400 tabular-nums">
                          {meta.format(prevVal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        <div className="pointer-events-none absolute bottom-2 left-16 right-lg flex justify-between font-mono text-[10px] tabular-nums text-zinc-600">
          {dateMarkers.map((i) => {
            const d = dates[i]
            return <span key={i}>{d ? fmtShort(d) : ''}</span>
          })}
        </div>
      </div>
    </div>
  )
}
