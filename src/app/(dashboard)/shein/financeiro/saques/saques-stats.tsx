'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

const fmtBrl = (n: number | string | null | undefined, currency = 'BRL') => {
  const v = Number(n ?? 0)
  const sym = currency === 'USD' ? 'US$' : currency === 'EUR' ? '€' : 'R$'
  return `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; onde: string; difere?: string }> = {
  'Líquido Total': {
    title: 'Líquido Total',
    oQueE: 'Soma do valor líquido de todos os saques (lotes de liquidação) — o total que a Shein já pagou ou vai pagar na conta.',
    origem: 'Soma de `net_amount` da `shein_payouts_view` (settlements agrupados por ciclo de pagamento / `estimatePayTime`).',
    onde: 'Painel Shein → Finanças → Minha renda → Registro de liquidação → soma da coluna "Valor liquidado".',
    difere: 'Cada lote bate ao centavo com o painel (7 lotes recentes validados, ex. 01/06 = 84.914,48). Lotes antigos (antes de mar/2026) parciais — settlements começam 18/03.',
  },
  'Receitas': {
    title: 'Receitas',
    oQueE: 'Total de entradas (vendas líquidas) somando só os lançamentos de receita dos saques.',
    origem: '`sum(estimateIncomeMoneyTotal)` dos settlements com `incomeExpenditureType = 1` (receita).',
    onde: 'Painel Shein → Registro de liquidação → detalhe do lote → linhas de receita.',
  },
  'Despesas': {
    title: 'Despesas',
    oQueE: 'Total de saídas (estornos, reembolsos, ajustes) descontadas nos saques.',
    origem: '`sum(estimateIncomeMoneyTotal)` dos settlements com `incomeExpenditureType = 2` (despesa).',
    onde: 'Painel Shein → Registro de liquidação → detalhe do lote → linhas de desconto/estorno.',
  },
  'Pago': {
    title: 'Pago',
    oQueE: 'Soma dos saques que a Shein JÁ transferiu (status pago, com data de pagamento efetivada).',
    origem: 'Saques com `completed_pay_time` preenchido.',
    onde: 'Painel Shein → Registro de liquidação → lotes com "Data de pagamento" preenchida (Recarga de carteira / pagamento direto).',
  },
  'Previsto': {
    title: 'Previsto',
    oQueE: 'Soma dos saques ainda NÃO pagos (previstos para uma data futura).',
    origem: 'Saques sem `completed_pay_time` (status previsto/atrasado), pela `estimate_pay_time`.',
    onde: 'Painel Shein → Minha renda → "Próximo valor de liquidação" + "Montante não liquidado acumulado".',
  },
}

function InfoModal({ infoKey, onClose }: { infoKey: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!infoKey) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [infoKey, onClose])

  if (!infoKey) return null
  const info = KPI_INFO[infoKey]
  if (!info) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-2xl border border-zinc-700 shadow-2xl" style={{ background: 'rgba(22,27,34,0.97)' }}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">help</span>
            {info.title}
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white transition-colors" aria-label="Fechar">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">O que é</div>
            <p className="text-sm leading-relaxed text-zinc-300">{info.oQueE}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">De onde vem o dado</div>
            <p className="text-sm leading-relaxed text-zinc-400">{info.origem}</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Onde conferir no painel Shein</div>
            <p className="text-sm leading-relaxed text-zinc-400">{info.onde}</p>
          </div>
          {info.difere && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Detalhe / validação</div>
              <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{info.difere}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, sub, icon, tone, onHelp }: { label: string; value: string; sub?: string; icon: string; tone?: 'default' | 'green' | 'blue' | 'yellow'; onHelp: (k: string) => void }) {
  const toneCls = tone === 'green' ? 'text-emerald-300' : tone === 'blue' ? 'text-blue-300' : tone === 'yellow' ? 'text-amber-300' : 'text-white'
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
          <button onClick={() => onHelp(label)} className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors" aria-label={`Explicação: ${label}`}>
            <span className="material-symbols-outlined text-[14px]">help</span>
          </button>
        </div>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', toneCls)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export function SaquesStats({
  total,
  receitas,
  despesas,
  paid,
  pending,
  count,
  paidCount,
  pendingCount,
}: {
  total: number
  receitas: number
  despesas: number
  paid: number
  pending: number
  count: number
  paidCount: number
  pendingCount: number
}) {
  const [helpKey, setHelpKey] = useState<string | null>(null)
  return (
    <>
      <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card label="Líquido Total" value={fmtBrl(total)} sub={`${count} saques`} icon="account_balance" tone="blue" onHelp={setHelpKey} />
        <Card label="Receitas" value={fmtBrl(receitas)} sub="Vendas líquidas" icon="trending_up" tone="green" onHelp={setHelpKey} />
        <Card label="Despesas" value={fmtBrl(despesas)} sub="Estornos / ajustes" icon="trending_down" tone="yellow" onHelp={setHelpKey} />
        <Card label="Pago" value={fmtBrl(paid)} sub={`${paidCount} ${paidCount === 1 ? 'transferência' : 'transferências'}`} icon="check_circle" tone="green" onHelp={setHelpKey} />
        <Card label="Previsto" value={fmtBrl(pending)} sub={`${pendingCount} pendentes`} icon="schedule" tone="yellow" onHelp={setHelpKey} />
      </div>
      <InfoModal infoKey={helpKey} onClose={() => setHelpKey(null)} />
    </>
  )
}
