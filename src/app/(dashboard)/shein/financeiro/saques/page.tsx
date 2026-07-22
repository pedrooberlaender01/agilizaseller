import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { SaquesStats } from './saques-stats'

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
              Extrato
            </Link>
            <span className="rounded bg-white/10 px-3 py-1 font-medium text-white">Saques</span>
          </div>
        </div>

        <SaquesStats
          total={totals.total}
          receitas={totals.receitas}
          despesas={totals.despesas}
          paid={totals.paid}
          pending={totals.pending}
          count={payouts.length}
          paidCount={totals.paidCount}
          pendingCount={totals.pendingCount}
        />

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data pagamento</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">ID Saque</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Período</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Receitas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Despesas</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido</th>
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Status</th>
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
                        {p.status === 'pago' ? (
                          <span className="text-sm font-semibold text-white">{fmtDate(p.completed_pay_time)}</span>
                        ) : (
                          <span className="text-sm font-medium text-amber-300">
                            {fmtDate(p.estimate_pay_time)}
                            <span className="ml-1 text-[10px] font-normal text-amber-400/70">prev.</span>
                          </span>
                        )}
                      </td>
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
