import { cn } from '@/lib/utils'

// Formatação (compartilhada nas views TikTok)
export const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
export const fmtBrlInt = (n: number | string | null | undefined) =>
  `R$ ${Number(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
export const fmtNum = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('pt-BR')
export const fmtPct = (n: number | string | null | undefined, digits = 1) =>
  `${Number(n ?? 0).toFixed(digits)}%`

type Tone = 'default' | 'green' | 'red' | 'blue' | 'gold'
const toneText: Record<Tone, string> = {
  default: 'text-zinc-50',
  green: 'text-secondary',
  red: 'text-error',
  blue: 'text-blue-400',
  gold: 'text-[#facc3c]',
}

// Card KPI padrão (mesmo layout dos outros marketplaces)
export function KpiCard({
  label,
  value,
  icon,
  tone = 'default',
  sub,
  soon,
}: {
  label: string
  value: string
  icon?: string
  tone?: Tone
  sub?: string
  soon?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg transition-colors hover:bg-zinc-900/70">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</span>
        {soon ? (
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-200">
            Em breve
          </span>
        ) : icon ? (
          <span className={cn('material-symbols-outlined text-lg', toneText[tone])}>{icon}</span>
        ) : null}
      </div>
      <div className={cn('text-2xl font-semibold', soon ? 'text-zinc-600' : toneText[tone])}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-zinc-500">{sub}</div>}
    </div>
  )
}

// Empty state de seção inteira (quando ainda não há dado/endpoint)
export function SectionEmpty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="material-symbols-outlined text-3xl text-zinc-600">hourglass_empty</span>
        <p className="text-sm text-zinc-500">{text}</p>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200">
          Em breve
        </span>
      </div>
    </div>
  )
}
