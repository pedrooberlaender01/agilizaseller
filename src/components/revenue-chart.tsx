'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type Bar = {
  day: string
  faturamento: number
  lucro: number
}

const defaultData: Bar[] = [
  { day: 'Seg', faturamento: 14200, lucro: 4260 },
  { day: 'Ter', faturamento: 19800, lucro: 6930 },
  { day: 'Qua', faturamento: 16100, lucro: 4830 },
  { day: 'Qui', faturamento: 24900, lucro: 8715 },
  { day: 'Sex', faturamento: 21300, lucro: 7455 },
  { day: 'Sáb', faturamento: 30200, lucro: 12080 },
  { day: 'Dom', faturamento: 26700, lucro: 10680 },
]

const brl = (n: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(n)

const ticks = [1, 0.75, 0.5, 0.25, 0]

export function RevenueChart({
  data = defaultData,
  subtitle = 'Últimos 7 dias · BRL',
  showLucro = true,
  title = 'Faturamento vs Lucro',
}: {
  data?: Bar[]
  subtitle?: string
  showLucro?: boolean
  title?: string
} = {}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.faturamento)), [data])

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 lg:w-[65%]">
      <div className="flex items-center justify-between border-b border-white/10 p-lg">
        <div className="flex flex-col gap-1">
          <h3 className="font-h3 text-h3 text-white">{title}</h3>
          <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
            <span className="font-label-md text-label-md text-slate-400">Faturamento</span>
          </div>
          {showLucro && (
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#34d399] shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
              <span className="font-label-md text-label-md text-slate-400">Lucro</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex min-h-[320px] min-w-0 flex-1 px-lg pb-lg pt-lg">
        <div className="pointer-events-none absolute inset-x-lg top-lg bottom-[44px] flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-12 text-right font-mono-sm text-mono-sm text-slate-600">
                {brl(max * t)}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
            </div>
          ))}
        </div>

        <div
          className="relative ml-14 flex min-w-0 flex-1 items-end justify-between gap-1"
          onMouseLeave={() => setHovered(null)}
        >
          {data.map((d, i) => {
            const fatPct = (d.faturamento / max) * 100
            const lucroPct = (d.lucro / d.faturamento) * 100
            const margin = ((d.lucro / d.faturamento) * 100).toFixed(1)
            const active = hovered === i
            const labelStep = Math.max(1, Math.ceil(data.length / 7))
            const showLabel = data.length <= 10 || i % labelStep === 0 || i === data.length - 1
            const barWidth = data.length > 14 ? 'w-3' : data.length > 8 ? 'w-6' : 'w-9'

            return (
              <div
                key={d.day}
                className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHovered(i)}
              >
                {active && (
                  <div className="pointer-events-none absolute bottom-[28px] left-1/2 top-0 w-px -translate-x-1/2 bg-gradient-to-b from-white/0 via-white/15 to-white/40" />
                )}

                <div
                  className={cn(
                    'relative overflow-hidden rounded-t-md transition-all duration-300 ease-out',
                    barWidth,
                    active ? '-translate-y-1' : '',
                  )}
                  style={{
                    height: d.faturamento > 0
                      ? `max(6px, calc(${fatPct}% - 28px))`
                      : '0px',
                  }}
                >
                  <div
                    className={cn(
                      'absolute inset-0 rounded-t-md border border-[#3b82f6]/40 bg-gradient-to-b from-[#3b82f6]/45 via-[#3b82f6]/25 to-[#3b82f6]/15 transition-all',
                      active &&
                        'border-[#3b82f6]/80 from-[#3b82f6]/75 via-[#3b82f6]/45 to-[#3b82f6]/25 shadow-[0_0_24px_rgba(59,130,246,0.45)]',
                    )}
                  />
                  {showLucro && (
                    <div
                      className={cn(
                        'absolute inset-x-0 bottom-0 border-t border-[#34d399]/60 bg-gradient-to-t from-[#34d399]/55 via-[#34d399]/35 to-[#34d399]/15 transition-all',
                        active &&
                          'border-[#34d399] from-[#34d399]/75 via-[#34d399]/50 to-[#34d399]/25 shadow-[inset_0_-12px_24px_rgba(52,211,153,0.35)]',
                      )}
                      style={{ height: `${lucroPct}%` }}
                    />
                  )}
                </div>

                <span
                  className={cn(
                    'mt-2 font-mono text-[10px] tracking-tight transition-colors whitespace-nowrap',
                    active ? 'text-zinc-50' : 'text-zinc-500',
                    !showLabel && 'invisible',
                  )}
                >
                  {d.day}
                </span>

                {active && (
                  <div
                    className={cn(
                      'pointer-events-none absolute z-50 w-[200px] -translate-y-full',
                      i > data.length * 0.5 ? 'right-0' : 'left-0',
                    )}
                    style={{ top: '-8px' }}
                  >
                    <div className="rounded-lg border border-white/10 bg-[#0f1218]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-md">
                      <div className="mb-2 flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="font-label-md text-label-md uppercase tracking-[0.2em] text-slate-400">
                          {d.day}
                        </span>
                        {showLucro && (
                          <span className="rounded bg-[#34d399]/10 px-1.5 py-0.5 font-mono-sm text-mono-sm text-[#34d399]">
                            {margin}%
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                            <span className="text-[11px] text-slate-400">Faturamento</span>
                          </div>
                          <span className="font-mono text-[13px] font-medium tabular-nums text-white">
                            {brl(d.faturamento)}
                          </span>
                        </div>
                        {showLucro && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-[#34d399]" />
                              <span className="text-[11px] text-slate-400">Lucro</span>
                            </div>
                            <span className="font-mono text-[13px] font-medium tabular-nums text-[#34d399]">
                              {brl(d.lucro)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
