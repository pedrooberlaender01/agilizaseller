'use client'

import { Fragment, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import type { ShopeeAccountHealth } from '@/types'

export type PeriodDays = 30 | 60 | 90

export type HistoryPoint = {
  snapshot_at: string
  penalty_points: number
  listing_violation_count: number
  overall_performance_rating: string | null
}

type Punishment = {
  type?: string
  description?: string
  start_date?: string
  end_date?: string | null
  [k: string]: unknown
}

type Tone = 'success' | 'warning' | 'error' | 'neutral'

const toneClasses: Record<Tone, { text: string; bg: string; border: string; dot: string; cls: string; icon: string }> = {
  success: { text: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/30', dot: 'bg-secondary', cls: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',  icon: 'verified' },
  warning: { text: 'text-zinc-50',  bg: 'bg-zinc-800/60',  border: 'border-zinc-50/30',  dot: 'bg-zinc-50',  cls: 'bg-zinc-800/60 text-zinc-50 border border-zinc-50/30',     icon: 'priority_high' },
  error:   { text: 'text-error',     bg: 'bg-error/10',     border: 'border-error/30',     dot: 'bg-error',     cls: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',             icon: 'warning' },
  neutral: { text: 'text-zinc-500',   bg: 'bg-outline/10',   border: 'border-outline/30',   dot: 'bg-outline',   cls: 'bg-outline/15 text-zinc-500 border border-outline/30',       icon: 'help' },
}

function penaltyTone(n: number): Tone {
  if (n <= 3) return 'success'
  if (n <= 9) return 'warning'
  return 'error'
}

function violationsTone(n: number): Tone {
  if (n === 0) return 'success'
  if (n <= 4) return 'warning'
  return 'error'
}

// API get_shop_performance devolve rating numérico 1-4 (4=Excelente). Dados antigos podem vir como texto.
function ratingTone(r: string | null): Tone {
  if (!r) return 'neutral'
  const n = Number(r)
  if (!Number.isNaN(n)) return n >= 3 ? 'success' : n === 2 ? 'warning' : 'error'
  const lower = r.toLowerCase()
  if (lower.includes('excellent') || lower.includes('good')) return 'success'
  if (lower.includes('improvement')) return 'warning'
  return 'error'
}

function ratingLabel(r: string | null): string {
  if (!r) return '—'
  const n = Number(r)
  if (!Number.isNaN(n)) return n >= 4 ? 'Excelente' : n === 3 ? 'Bom' : n === 2 ? 'Precisa Melhorar' : 'Crítico'
  const lower = r.toLowerCase()
  if (lower.includes('excellent')) return 'Excelente'
  if (lower.includes('good')) return 'Bom'
  if (lower.includes('improvement')) return 'Precisa Melhorar'
  if (lower.includes('poor')) return 'Crítico'
  return r
}

function fmtSnapshotDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `Hoje, ${time}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${time}`
}

function fmtChartDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function StatusHeroCard({ snap }: { snap: ShopeeAccountHealth }) {
  const r = ratingTone(snap.overall_performance_rating)
  const tone = toneClasses[r]
  const pTone = toneClasses[penaltyTone(snap.penalty_points)]

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 relative overflow-hidden p-lg">
      <div className={cn('pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px]', tone.bg)} />
      <div className="relative z-10 flex flex-col gap-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name={tone.icon} className={tone.text} filled />
            <h3 className="text-base font-semibold text-white">Status Atual</h3>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-500">
            {fmtSnapshotDate(snap.snapshot_at)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Avaliação de Performance</span>
            <span className={cn('mt-1 inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider', tone.cls)}>
              {ratingLabel(snap.overall_performance_rating)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Pontos de Penalidade</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={cn('text-[42px] font-bold leading-none', pTone.text)}>{snap.penalty_points}</span>
              <span className="text-xs text-zinc-500">/ 12</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3">
          <span className={cn('h-2 w-2 animate-pulse rounded-full', tone.dot)} />
          <span className="text-xs text-zinc-400">
            {snap.penalty_points === 0
              ? 'Conta saudável. Sem pontos acumulados.'
              : `${snap.penalty_points} ponto(s) em vigor. Suspensão a partir de 12.`}
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  tone,
  icon,
  hint,
}: {
  label: string
  value: string | number
  unit?: string
  tone: Tone
  icon: string
  hint: string
}) {
  const t = toneClasses[tone]
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 relative flex flex-col justify-between overflow-hidden p-lg">
      <div className={cn('pointer-events-none absolute right-0 top-0 h-24 w-24 -translate-y-1/2 translate-x-1/2 rounded-full blur-[40px]', t.bg)} />
      <div className="relative z-10 mb-4 flex items-start justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</h3>
        <Icon name={icon} size={14} className={t.text} filled />
      </div>
      <div className="relative z-10">
        <div className="mb-2 flex items-baseline gap-2">
          <span className={cn('text-[32px] font-bold leading-none', t.text)}>{value}</span>
          {unit && <span className="text-sm text-zinc-500">{unit}</span>}
        </div>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
    </div>
  )
}

function HistoryChart({
  data,
  period,
  onPeriodChange,
}: {
  data: HistoryPoint[]
  period: PeriodDays
  onPeriodChange: (p: PeriodDays) => void
}) {
  const peak = data.length > 0 ? Math.max(1, ...data.map((d) => d.penalty_points)) : 1
  const chartData = data.map((d) => ({
    date: fmtChartDate(d.snapshot_at),
    penalty_points: d.penalty_points,
  }))

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 col-span-12 flex flex-col p-0">
      <div className="flex flex-wrap items-center justify-between gap-md border-b border-white/8 p-lg">
        <div className="flex items-center gap-2">
          <Icon name="show_chart" className="text-zinc-600" />
          <h3 className="text-base font-semibold text-white">Histórico de Pontos de Penalidade</h3>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-zinc-50" />
            <span className="text-xs text-zinc-500">Pontos de Penalidade</span>
          </div>
          <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
            {([30, 60, 90] as PeriodDays[]).map((d) => (
              <button
                key={d}
                onClick={() => onPeriodChange(d)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  period === d ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[260px] w-full p-lg pl-2">
        {chartData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Icon name="timeline" className="text-3xl text-zinc-600" />
            <span className="text-sm text-zinc-500">Sem snapshots no período.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="penaltyGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#facc3c" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#facc3c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.3)"
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                stroke="rgba(255,255,255,0.3)"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                domain={[0, Math.max(12, peak + 2)]}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(5, 5, 7, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#facc3c' }}
                formatter={(v) => [`${v} pts`, 'Penalidade']}
              />
              <Area
                type="monotone"
                dataKey="penalty_points"
                stroke="#facc3c"
                strokeWidth={2}
                fill="url(#penaltyGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#facc3c', stroke: '#0d1117', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function PunishmentsCard({ punishments }: { punishments: Punishment[] }) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col p-0">
      <div className="flex items-center gap-2 border-b border-white/8 p-lg">
        <Icon name="gavel" className="text-zinc-600" />
        <h3 className="text-base font-semibold text-white">Punições Ativas</h3>
      </div>
      <div className="flex flex-col gap-3 p-lg">
        {punishments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
              <Icon name="check_circle" className="text-secondary" size={24} filled />
            </div>
            <span className="text-sm font-medium text-zinc-50">Sem punições ativas</span>
            <span className="text-xs text-zinc-500">Conta operando sem restrições.</span>
          </div>
        ) : (
          punishments.map((p, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/5 p-3">
              <Icon name="warning" className="mt-0.5 text-error" filled />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-error">{p.type ?? 'Punição'}</p>
                {p.description && <p className="mt-1 text-xs text-zinc-400">{p.description}</p>}
                {(p.start_date || p.end_date) && (
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    {p.start_date ?? '—'}
                    {p.end_date ? ` → ${p.end_date}` : ' (sem prazo)'}
                  </p>
                )}
                {!p.type && !p.description && (
                  <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-[10px] text-zinc-500">
                    {JSON.stringify(p, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

type PerfMetric = {
  metric_name: string
  current_period: number | null
  target?: { value: number; comparator: string }
  unit?: number
}

// metric_name (API get_shop_performance) → rótulo PT + como formatar o valor
const METRIC_META: Record<string, { label: string; fmt: 'pct' | 'days' | 'rating' | 'count' }> = {
  non_fulfillment_rate: { label: 'Taxa de Não Cumprimento', fmt: 'pct' },
  late_shipment_rate: { label: 'Taxa de Envio Atrasado', fmt: 'pct' },
  avg_preparation_time_ps: { label: 'Tempo de Preparação', fmt: 'days' },
  saturday_shipment_rate: { label: 'Envios aos Sábados', fmt: 'pct' },
  cancellation_rate: { label: 'Taxa de Cancelamento', fmt: 'pct' },
  return_refund_rate: { label: 'Taxa de Devolução/Reembolso', fmt: 'pct' },
  severe_listing_violations: { label: 'Violações de Anúncios Graves', fmt: 'count' },
  pre_order_listing_rate: { label: 'Produtos Pré-encomenda', fmt: 'pct' },
  the_amount_of_pre_order_listing: { label: 'Qtd Pré-encomenda', fmt: 'count' },
  other_listing_violations: { label: 'Outras Violações de Anúncio', fmt: 'count' },
  prohibited_listings: { label: 'Anúncios Proibidos', fmt: 'count' },
  counterfeit_ip_infringement: { label: 'Contrafação / IP', fmt: 'count' },
  spam_listings: { label: 'Anúncios Spam', fmt: 'count' },
  pqr_products: { label: 'Produtos PQR', fmt: 'count' },
  response_rate: { label: 'Taxa de Resposta', fmt: 'pct' },
  shop_rating: { label: 'Avaliação da Loja', fmt: 'rating' },
}

const METRIC_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Performance de Pedidos Concluídos', keys: ['non_fulfillment_rate', 'late_shipment_rate', 'avg_preparation_time_ps', 'saturday_shipment_rate', 'cancellation_rate', 'return_refund_rate'] },
  { title: 'Performance do Produto', keys: ['severe_listing_violations', 'pre_order_listing_rate', 'the_amount_of_pre_order_listing', 'other_listing_violations', 'prohibited_listings', 'counterfeit_ip_infringement', 'spam_listings', 'pqr_products'] },
  { title: 'Performance de Atendimento ao Cliente', keys: ['response_rate', 'shop_rating'] },
]

function fmtBr(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

function fmtMetricValue(v: number | null | undefined, fmt: string): string {
  if (v === null || v === undefined) return '–'
  if (fmt === 'days') return `${fmtBr(v)} dias`
  if (fmt === 'rating') return `${fmtBr(v)}/5`
  if (fmt === 'pct') return `${fmtBr(v)}%`
  return `${v}` // count
}

function fmtMetricTarget(t: PerfMetric['target'], fmt: string): string {
  if (!t) return '—'
  const c = t.comparator === '>=' ? '≥' : t.comparator === '<=' ? '≤' : t.comparator
  const val = String(t.value).replace('.', ',')
  if (fmt === 'days') return `${c}${val} dias`
  if (fmt === 'rating') return `${c}${val}/5`
  if (fmt === 'pct') return `${c}${val}%`
  return `${c}${val}`
}

// Verde se bate a meta, vermelho se estoura, neutro se sem dado (current_period null).
function metricTone(v: number | null | undefined, t: PerfMetric['target']): Tone {
  if (v === null || v === undefined || !t) return 'neutral'
  switch (t.comparator) {
    case '<': return v < t.value ? 'success' : 'error'
    case '<=': return v <= t.value ? 'success' : 'error'
    case '>': return v > t.value ? 'success' : 'error'
    case '>=': return v >= t.value ? 'success' : 'error'
    default: return 'neutral'
  }
}

function MetricsDetailCard({ metrics }: { metrics: PerfMetric[] }) {
  const byName = new Map(metrics.map((m) => [m.metric_name, m]))
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 flex flex-col p-0">
      <div className="flex items-center gap-2 border-b border-white/8 p-lg">
        <Icon name="table_chart" className="text-zinc-600" />
        <h3 className="text-base font-semibold text-white">Detalhes das Métricas</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-white/8 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-lg py-3 font-medium">Métrica</th>
              <th className="px-lg py-3 font-medium">Período Atual</th>
              <th className="px-lg py-3 font-medium">Meta</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_GROUPS.map((g) => {
              const rows = g.keys.map((k) => byName.get(k)).filter((m): m is PerfMetric => !!m)
              if (rows.length === 0) return null
              return (
                <Fragment key={g.title}>
                  <tr>
                    <td colSpan={3} className="bg-zinc-900/60 px-lg py-2 text-xs font-semibold text-zinc-300">
                      {g.title}
                    </td>
                  </tr>
                  {rows.map((m) => {
                    const meta = METRIC_META[m.metric_name] ?? { label: m.metric_name, fmt: 'count' as const }
                    const tone = toneClasses[metricTone(m.current_period, m.target)]
                    return (
                      <tr key={m.metric_name} className="border-b border-white/5">
                        <td className="px-lg py-3 text-zinc-300">
                          <span className="flex items-center gap-2">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
                            {meta.label}
                          </span>
                        </td>
                        <td className={cn('px-lg py-3 font-medium', tone.text)}>{fmtMetricValue(m.current_period, meta.fmt)}</td>
                        <td className="px-lg py-3 text-zinc-500">{fmtMetricTarget(m.target, meta.fmt)}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type PenaltyPoint = {
  issue_time: number
  reference_id?: number | string
  violation_type: number
  latest_point_num: number
  original_point_num?: number
}

// Shopee não documenta os códigos de violation_type publicamente (API só devolve o número).
// Por isso mostramos o dado bruto (data + pontos + código) em vez de inventar um nome —
// e linkamos pro Desempenho da Conta na Shopee, que mostra a descrição oficial em PT.
function fmtUnixDate(unixSeconds: number): string {
  return fmtSnapshotDate(new Date(unixSeconds * 1000).toISOString())
}

function PenaltyReportCard({ points }: { points: PenaltyPoint[] }) {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => b.issue_time - a.issue_time)

  return (
    <div className="col-span-12 border border-amber-500/25 bg-amber-500/[0.04] flex flex-col p-0">
      <div className="flex items-center gap-2 border-b border-amber-500/15 p-lg">
        <Icon name="report_problem" className="text-amber-400" filled />
        <h3 className="text-base font-semibold text-white">Relatório de Penalidades — possíveis causas</h3>
      </div>
      <div className="flex flex-col gap-2 p-lg">
        <p className="text-xs text-zinc-400">
          A Shopee não expõe o nome da violação via API, só o código. Confira a descrição oficial clicando em
          &quot;Ver na Shopee&quot;.
        </p>
        {sorted.map((p, i) => (
          <div key={`${p.reference_id ?? i}-${p.issue_time}`} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/15 bg-zinc-900/40 px-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                +{p.latest_point_num} pt{p.latest_point_num !== 1 ? 's' : ''}
              </span>
              <span className="text-sm text-zinc-300">Violação tipo {p.violation_type}</span>
              <span className="font-mono text-[10px] text-zinc-600">{fmtUnixDate(p.issue_time)}</span>
            </div>
            <a
              href="https://seller.shopee.com.br/portal/accounthealth/home"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-amber-300 hover:underline"
            >
              Ver na Shopee →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyStateView({ nickname }: { nickname: string | null }) {
  return (
    <main className="flex flex-1 items-center justify-center p-margin">
      <div className="border border-zinc-800 bg-zinc-900/40 relative flex max-w-xl flex-col items-center gap-md overflow-hidden rounded-2xl p-xl text-center">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-50/5 via-transparent to-error/5" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-zinc-800/60 blur-[80px]" />

        <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-50/30 bg-zinc-800/60">
          <Icon name="health_and_safety" className="text-zinc-50" size={28} filled />
        </div>
        <h2 className="relative z-10 text-h2 font-semibold text-zinc-50">
          Saúde da conta Shopee não disponível ainda
        </h2>
        <p className="relative z-10 max-w-md text-sm text-zinc-400">
          {nickname && <>Conta <span className="font-mono text-zinc-50">{nickname}</span> conectada. </>}
          Os dados de Account Health serão capturados após o app ser aprovado em Live e a loja real autorizar.
        </p>
        <div className="relative z-10 mt-2 w-full rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 text-left">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="schedule" className="text-zinc-50" size={16} />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-50">Status do Workflow</span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">
            <span className="font-mono text-zinc-50">Shopee — Snapshot de Saúde</span> está bloqueado por permissões da
            Shopee Open Platform. App categoria <span className="font-mono">Seller Logistics</span> não tem acesso aos
            endpoints de <span className="font-mono">Account Health</span> (retorno 403/404).
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Status atual: aguardando categoria do app ser ajustada e aprovação Live.
          </p>
        </div>
      </div>
    </main>
  )
}

export function SaudeView({
  latest,
  history,
  period,
  nickname,
}: {
  latest: ShopeeAccountHealth | null
  history: HistoryPoint[]
  period: PeriodDays
  nickname: string | null
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setPeriod(p: PeriodDays) {
    const next = new URLSearchParams(sp.toString())
    next.set('period', `${p}d`)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  if (!latest) {
    return (
      <>
        <TopBar title="Saúde — Shopee" />
        <EmptyStateView nickname={nickname} />
      </>
    )
  }

  const r = ratingTone(latest.overall_performance_rating)
  const punishments = (Array.isArray(latest.ongoing_punishment) ? latest.ongoing_punishment : []) as Punishment[]
  const perfPayload = (latest.perf_raw_payload && typeof latest.perf_raw_payload === 'object' ? latest.perf_raw_payload : null) as { metric_list?: PerfMetric[] } | null
  const metrics = Array.isArray(perfPayload?.metric_list) ? perfPayload.metric_list : []
  const penaltyPayload = (latest.penalty_raw_payload && typeof latest.penalty_raw_payload === 'object' ? latest.penalty_raw_payload : null) as { penalty_point_list?: PenaltyPoint[] } | null
  const penaltyPoints = Array.isArray(penaltyPayload?.penalty_point_list) ? penaltyPayload.penalty_point_list : []

  return (
    <>
      <TopBar title="Saúde — Shopee" />
      <main className={cn('flex-1 space-y-gutter p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-md">
          <div>
            <h1 className="mb-1 flex items-center gap-sm text-[36px] font-bold leading-tight text-white">
              Saúde da Conta
              <span className="text-zinc-500 font-normal">—</span>
              <span className="text-zinc-50">Shopee</span>
            </h1>
            <p className="text-sm text-zinc-500">
              {nickname ? `Conta ${nickname} · ` : ''}performance, infrações e punições.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
              Última atualização: {fmtSnapshotDate(latest.snapshot_at)}
            </span>
            <button className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-800 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/5">
              <Icon name="download" size={14} />
              Exportar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4">
            <StatusHeroCard snap={latest} />
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-gutter md:grid-cols-3 lg:col-span-8">
            <MetricCard
              label="Pontos de Penalidade"
              value={latest.penalty_points}
              unit="/ 12"
              tone={penaltyTone(latest.penalty_points)}
              icon="report"
              hint="Suspensão automática em 12 pts. Verde até 3, amarelo 4–9, vermelho ≥10."
            />
            <MetricCard
              label="Violações de Anúncios"
              value={latest.listing_violation_count}
              tone={violationsTone(latest.listing_violation_count)}
              icon="block"
              hint="Anúncios com violação ativa. Reduzir para evitar pontos adicionais."
            />
            <MetricCard
              label="Avaliação de Performance"
              value={ratingLabel(latest.overall_performance_rating)}
              tone={r}
              icon={toneClasses[r].icon}
              hint="Avaliação consolidada de envios, cancelamentos e satisfação."
            />
          </div>

          <PenaltyReportCard points={penaltyPoints} />

          <HistoryChart data={history} period={period} onPeriodChange={setPeriod} />

          {metrics.length > 0 && (
            <div className="col-span-12">
              <MetricsDetailCard metrics={metrics} />
            </div>
          )}

          <div className="col-span-12">
            <PunishmentsCard punishments={punishments} />
          </div>
        </div>
      </main>
    </>
  )
}
