import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const revalidate = 60

type PayoutRow = {
  report_no: string
  settlements_count: number
  receitas_count: number
  despesas_count: number
  receitas_total: number | string
  despesas_total: number | string
  net_amount: number | string
  currency: string | null
  estimate_pay_time: string | null
  completed_pay_time: string | null
  period_start: string | null
  period_end: string | null
  status: 'pago' | 'previsto' | 'atrasado'
  has_report_no: boolean
}

const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function StatCard({ label, value, sub, icon, tone = 'default' }: { label: string; value: string; sub?: string; icon: string; tone?: 'default' | 'green' | 'blue' | 'yellow' }) {
  const toneCls = tone === 'green' ? 'text-emerald-300' : tone === 'blue' ? 'text-blue-300' : tone === 'yellow' ? 'text-amber-300' : 'text-white'
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default async function SheinSaquesPage() {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id, nickname')
    .eq('marketplace', 'shein')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return (
      <>
        <TopBar title="Saques — Shein" />
        <main className="flex flex-1 items-center justify-center p-margin">
          <p className="text-sm text-zinc-500">Sem conexão Shein ativa.</p>
        </main>
      </>
    )
  }

  const { data: rows } = await supabase
    .from('shein_payouts_view')
    .select('*')
    .eq('connection_id', conn.id)
    .order('estimate_pay_time', { ascending: false, nullsFirst: false })

  const payouts = (rows ?? []) as PayoutRow[]
  const totals = payouts.reduce(
    (acc, p) => {
      const v = Number(p.net_amount ?? 0)
      acc.total += v
      acc.receitas += Number(p.receitas_total ?? 0)
      acc.despesas += Number(p.despesas_total ?? 0)
      if (p.status === 'pago') {
        acc.paid += v
        acc.paidCount++
      } else {
        acc.pending += v
        acc.pendingCount++
      }
      return acc
    },
    { total: 0, paid: 0, pending: 0, paidCount: 0, pendingCount: 0, receitas: 0, despesas: 0 },
  )

  return (
    <>
      <TopBar title="Saques — Shein" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <h2 className="text-h2 font-semibold text-white">Saques Shein → Santander</h2>
          <p className="mt-1 text-xs text-slate-400">
            {conn.nickname && <>Conexão: {conn.nickname} · </>}
            {payouts.length} {payouts.length === 1 ? 'saque agregado' : 'saques agregados'}
          </p>
          <div className="mt-3 inline-flex gap-2 rounded-lg border border-zinc-800 bg-[#050507] p-1 text-xs">
            <Link
              href="/shein/financeiro"
              className="rounded px-3 py-1 font-medium text-slate-400 transition-colors hover:text-white"
            >
              Settlements
            </Link>
            <span className="rounded bg-white/10 px-3 py-1 font-medium text-white">Saques</span>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Líquido Total"
            value={fmtBrl(totals.total)}
            sub={`${payouts.length} saques`}
            icon="account_balance"
            tone="blue"
          />
          <StatCard
            label="Receitas"
            value={fmtBrl(totals.receitas)}
            sub="Vendas líquidas"
            icon="trending_up"
            tone="green"
          />
          <StatCard
            label="Despesas"
            value={fmtBrl(totals.despesas)}
            sub="Estornos / ajustes"
            icon="trending_down"
            tone="yellow"
          />
          <StatCard
            label="Pago"
            value={fmtBrl(totals.paid)}
            sub={`${totals.paidCount} ${totals.paidCount === 1 ? 'transferência' : 'transferências'}`}
            icon="check_circle"
            tone="green"
          />
          <StatCard
            label="Previsto"
            value={fmtBrl(totals.pending)}
            sub={`${totals.pendingCount} pendentes`}
            icon="schedule"
            tone="yellow"
          />
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">ID Saque</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Período</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receitas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Despesas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Pago em</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum saque agrupado ainda.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => {
                  const statusCls =
                    p.status === 'pago'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : p.status === 'atrasado'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  const statusLabel =
                    p.status === 'pago'
                      ? 'Pago'
                      : p.status === 'atrasado'
                        ? `Atrasado (${fmtDate(p.estimate_pay_time)})`
                        : `Previsto ${fmtDate(p.estimate_pay_time)}`
                  return (
                    <tr
                      key={p.report_no}
                      className="border-b border-zinc-800/60 transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/shein/financeiro/saques/${encodeURIComponent(p.report_no)}`}
                          className="font-mono text-xs text-white transition-colors hover:underline"
                        >
                          {p.report_no}
                        </Link>
                        {!p.has_report_no && (
                          <p className="mt-0.5 text-[10px] text-amber-400/70">
                            ID Shein pendente
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {fmtDate(p.period_start)} → {fmtDate(p.period_end)}
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-emerald-300">
                        {fmtBrl(p.receitas_total, p.currency ?? 'BRL')}
                        <span className="ml-1 text-[10px] text-zinc-500">({p.receitas_count})</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-rose-300">
                        -{fmtBrl(p.despesas_total, p.currency ?? 'BRL')}
                        {p.despesas_count > 0 && (
                          <span className="ml-1 text-[10px] text-zinc-500">({p.despesas_count})</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-white">
                        {fmtBrl(p.net_amount, p.currency ?? 'BRL')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium border', statusCls)}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{fmtDateTime(p.completed_pay_time)}</td>
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
