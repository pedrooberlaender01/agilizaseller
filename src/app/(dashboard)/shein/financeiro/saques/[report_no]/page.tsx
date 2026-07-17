import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const revalidate = 60

type PayoutSummary = {
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

type SettlementInPayout = {
  id: string
  settlement_id: string | null
  order_no: string | null
  net_amount: number | string | null
  currency: string | null
  business_completed_time: string | null
  estimate_pay_time: string | null
  completed_pay_time: string | null
  check_status: number | null
  income_expenditure_type: number | null
  second_order_type: number | null
  site: string | null
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

function checkStatusLabel(c: number | null): { label: string; tone: string } {
  if (c === 1) return { label: 'Liquidado', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
  if (c === 2) return { label: 'Pendente', tone: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
  if (c === 3) return { label: 'Bloqueado', tone: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
  if (c == null) return { label: '—', tone: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40' }
  return { label: `Status ${c}`, tone: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40' }
}

export default async function SaqueDetalhePage({
  params,
}: {
  params: Promise<{ report_no: string }>
}) {
  const { report_no: raw } = await params
  const reportNo = decodeURIComponent(raw)

  const supabase = await createClient()
  const { data: payout } = await supabase
    .from('shein_payouts_view')
    .select('*')
    .eq('report_no', reportNo)
    .maybeSingle()

  if (!payout) notFound()
  const p = payout as PayoutSummary

  const { data: settlementsData } = await supabase
    .from('shein_settlements_by_report')
    .select('*')
    .eq('report_no', reportNo)
    .order('business_completed_time', { ascending: false })

  const settlements = (settlementsData ?? []) as SettlementInPayout[]

  return (
    <>
      <TopBar title={`Saque ${reportNo}`} />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <Link
            href="/shein/financeiro/saques"
            className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Voltar
          </Link>
        </div>

        <div className="mb-lg">
          <h2 className="text-h2 font-semibold text-white">Saque {reportNo}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span
              className={cn(
                'rounded px-2 py-1 font-medium border',
                p.status === 'pago'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30',
              )}
            >
              {p.status === 'pago' ? 'Pago' : 'Previsto'}
            </span>
            <span className="rounded bg-zinc-800/60 px-2 py-1 font-mono text-zinc-50">{reportNo}</span>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Líquido</p>
            <p className="mt-1 text-2xl font-semibold text-white">{fmtBrl(p.net_amount, p.currency ?? 'BRL')}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Receitas - despesas</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Receitas ({p.receitas_count})</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">{fmtBrl(p.receitas_total, p.currency ?? 'BRL')}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Vendas líquidas</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Despesas ({p.despesas_count})</p>
            <p className="mt-1 text-xl font-semibold text-rose-300">-{fmtBrl(p.despesas_total, p.currency ?? 'BRL')}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">Estornos / ajustes</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Previsto</p>
            <p className="mt-1 text-sm font-semibold text-white">{fmtDateTime(p.estimate_pay_time)}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{fmtDate(p.period_start)} → {fmtDate(p.period_end)}</p>
          </div>
          <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Pago em</p>
            <p className={cn('mt-1 text-sm font-semibold', p.completed_pay_time ? 'text-emerald-300' : 'text-zinc-500')}>
              {fmtDateTime(p.completed_pay_time)}
            </p>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">
              Extrato deste saque ({settlements.length})
            </h3>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Settlement ID
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Pedido</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Tipo</th>
                <th className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Valor
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Concluído
                </th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-6 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Pago em
                </th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-500">
                    Sem settlements registrados.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => {
                  const badge = checkStatusLabel(s.check_status)
                  const isReceita = s.income_expenditure_type === 1
                  return (
                    <tr key={s.id} className="border-b border-zinc-800/60">
                      <td className="px-6 py-3 font-mono text-[11px] text-slate-300">{s.settlement_id || '—'}</td>
                      <td className="px-6 py-3">
                        {s.order_no ? (
                          <Link
                            href={`/shein/pedidos/${encodeURIComponent(s.order_no)}`}
                            className="font-mono text-xs text-blue-300 transition-colors hover:underline"
                          >
                            {s.order_no}
                          </Link>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          'inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium border',
                          isReceita
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                        )}>
                          {isReceita ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={cn(
                        'px-6 py-3 text-right text-xs font-medium',
                        isReceita ? 'text-emerald-300' : 'text-rose-300',
                      )}>
                        {isReceita ? '+' : '-'}{fmtBrl(s.net_amount, s.currency ?? 'BRL')}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-400">
                        {fmtDateTime(s.business_completed_time)}
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn('inline-flex rounded px-2 py-0.5 text-[10px] font-medium border', badge.tone)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-400">{fmtDateTime(s.completed_pay_time)}</td>
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
