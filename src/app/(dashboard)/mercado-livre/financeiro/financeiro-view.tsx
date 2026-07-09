'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { TopBar } from '@/components/top-bar'
import type { Period } from '@/components/metrics-chart'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

export type FinDailyRow = {
  date: string
  pedidos: number
  faturamento: number
  comissao: number
  frete: number
  cupom: number
}

export type PaymentMixRow = {
  payment_type: string
  qtd: number
  valor: number
}

const PAYMENT_LABEL: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  account_money: 'Saldo Mercado Pago',
  bank_transfer: 'Pix',
  ticket: 'Boleto',
  digital_currency: 'Cripto / digital',
  desconhecido: 'Outro',
}

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function FinanceiroView({
  rows,
  paymentMix,
  freteMl,
  adsCost,
  period,
  customFrom,
  customTo,
}: {
  rows: FinDailyRow[]
  paymentMix: PaymentMixRow[]
  freteMl: number
  adsCost: number
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const isCustom = !!(customFrom && customTo)

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  useEffect(() => {
    if (!openInfo) return
    function onDoc(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setOpenInfo(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openInfo])

  function setPeriod(p: Period) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    sp.delete('from')
    sp.delete('to')
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(fromIso: string, toIso: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('period')
    sp.set('from', fromIso)
    sp.set('to', toIso)
    setPopoverOpen(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const faturamento = rows.reduce((a, r) => a + r.faturamento, 0)
  const comissao = rows.reduce((a, r) => a + r.comissao, 0)
  const frete = rows.reduce((a, r) => a + r.frete, 0)
  const cupom = rows.reduce((a, r) => a + r.cupom, 0)
  const ads = adsCost
  const margem = faturamento - comissao - frete - ads
  const comissaoPct = faturamento > 0 ? (comissao / faturamento) * 100 : 0

  const kpis: {
    label: string
    value: string
    icon: string
    iconClass: string
    valueClass: string
    info: ReactNode
  }[] = [
    {
      label: 'Faturamento Bruto', value: `R$ ${fmtBrl(faturamento)}`, icon: 'payments', iconClass: 'text-primary', valueClass: 'text-on-surface',
      info: (
        <>Soma de todas as vendas do período por <span className="text-on-surface">data de fechamento</span> (inclui as que foram canceladas depois). É o mesmo critério do <span className="text-on-surface">&quot;Vendas brutas&quot;</span> do painel do Mercado Livre.</>
      ),
    },
    {
      label: 'Comissão ML', value: `- R$ ${fmtBrl(comissao)}`, icon: 'percent', iconClass: 'text-error', valueClass: 'text-error',
      info: (
        <>Tarifa de venda que o ML cobra (~12,5%), somada de cada item dos pedidos (campo <span className="font-mono">sale_fee</span>). É o quanto o Mercado Livre desconta por vender.</>
      ),
    },
    {
      label: 'Frete Vendedor', value: `- R$ ${fmtBrl(frete)}`, icon: 'local_shipping', iconClass: 'text-error', valueClass: 'text-error',
      info: (
        <>
          <span className="text-on-surface">Frete = tarifa total de envio − o que o comprador pagou</span> (<span className="font-mono">list_cost − cost</span> do ML), somado <span className="text-on-surface">1× por envio</span>.
          <br /><br />
          É o <span className="text-secondary">custo real</span>: um carrinho (pack) com vários itens = <span className="text-on-surface">um frete só</span>. Aqui: <span className="font-mono text-on-surface">R$ {fmtBrl(frete)}</span>.
          <br /><br />
          No Excel/painel do ML o mesmo período aparece como <span className="font-mono text-error">R$ {fmtBrl(freteMl)}</span> — mas lá o frete é contado <span className="text-error">por venda</span>, repetindo em cada item do pack. Isso <span className="text-error">infla</span> o valor (conta o mesmo frete 2×). Por isso mostramos o real, que é menor e correto.
        </>
      ),
    },
    {
      label: 'Ads', value: `- R$ ${fmtBrl(ads)}`, icon: 'campaign', iconClass: 'text-error', valueClass: 'text-error',
      info: (
        <>Gasto em <span className="text-on-surface">Product Ads</span> (Mercado Ads) no período, somado do campo <span className="font-mono">cost</span> de todas as campanhas. Sincronizado 1×/dia da API de publicidade do ML.</>
      ),
    },
    {
      label: 'Cupons / Descontos', value: `R$ ${fmtBrl(cupom)}`, icon: 'sell', iconClass: 'text-tertiary', valueClass: 'text-on-surface',
      info: (
        <>Descontos aplicados nas vendas (cupons do ML ou do vendedor), extraídos dos pagamentos de cada pedido (<span className="font-mono">coupon_amount</span>). Reduz o valor que o comprador efetivamente pagou.</>
      ),
    },
    {
      label: 'Margem de Contribuição', value: `R$ ${fmtBrl(margem)}`, icon: 'account_balance_wallet', iconClass: 'text-secondary', valueClass: 'text-secondary-fixed',
      info: (
        <>Faturamento Bruto − Comissão − Frete − Ads = <span className="font-mono text-on-surface">R$ {fmtBrl(margem)}</span>. <span className="text-on-surface">Não</span> inclui o custo do produto (COGS) nem o repasse líquido do Mercado Pago (parcelamento/antecipação). É o que sobra antes do custo do produto.</>
      ),
    },
    {
      label: '% Comissão', value: `${comissaoPct.toFixed(1).replace('.', ',')}%`, icon: 'pie_chart', iconClass: 'text-tertiary', valueClass: 'text-on-surface',
      info: (
        <>Comissão ÷ Faturamento Bruto. Percentual médio que o Mercado Livre fica de cada venda.</>
      ),
    },
  ]

  const totalMix = paymentMix.reduce((a, m) => a + m.qtd, 0)
  const tableRows = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 31), [rows])

  return (
    <>
      <TopBar showSearch />
      <div className={cn('p-margin flex flex-col gap-gutter flex-1 overflow-y-auto', pending && 'opacity-70 pointer-events-none transition-opacity')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface flex items-center gap-sm">
              Financeiro
              <span className="text-outline font-normal">—</span>
              <span className="text-primary-fixed">Mercado Livre</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Margem de contribuição (bruto − comissão − frete − ads). Repasse líquido e custos de produto pendentes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-container-high/50 backdrop-blur-md rounded-lg p-1 border border-white/10">
              {periods.map((p) => {
                const active = !isCustom && period === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors ${
                      active
                        ? 'bg-primary-container text-on-primary-container shadow-sm border border-primary/20'
                        : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                    }`}
                    aria-pressed={active}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            <div ref={popoverRef} className="relative">
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                className={cn(
                  'flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                  isCustom
                    ? 'border-primary/30 bg-primary-container text-on-primary-container'
                    : 'border-white/10 bg-surface-container-high/50 text-on-surface-variant hover:text-on-surface',
                )}
                aria-label="Selecionar intervalo"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>
                  {isCustom && customFrom && customTo
                    ? `${fmtDateBRShort(customFrom)} – ${fmtDateBRShort(customTo)}`
                    : 'Personalizar'}
                </span>
                <span className={cn('material-symbols-outlined text-[14px] transition-transform', popoverOpen && 'rotate-180')}>expand_more</span>
              </button>
              {popoverOpen && (
                <DateRangePopover
                  from={customFrom}
                  to={customTo}
                  onApply={applyCustomRange}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
          {kpis.map((kpi, i) => {
            const open = openInfo === kpi.label
            const alignRight = i >= kpis.length - 2
            return (
              <div
                key={kpi.label}
                className={cn(
                  'bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-2 relative group hover:bg-surface-container/90 transition-colors',
                  open && 'z-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                    {kpi.label}
                    {kpi.info && (
                      <span ref={open ? infoRef : undefined} className="relative inline-flex normal-case">
                        <button
                          type="button"
                          onClick={() => setOpenInfo(open ? null : kpi.label)}
                          aria-label={`Sobre ${kpi.label}`}
                          className="flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">help</span>
                        </button>
                        {open && (
                          <div className={cn(
                            'absolute top-full z-50 mt-2 w-[300px] rounded-xl border border-white/10 bg-[#0d1117] p-4 text-left shadow-2xl shadow-black/60',
                            alignRight ? 'right-0' : 'left-0',
                          )}>
                            <p className="mb-2 text-sm font-semibold text-on-surface">{kpi.label}</p>
                            <p className="text-xs leading-relaxed text-on-surface-variant tracking-normal">{kpi.info}</p>
                          </div>
                        )}
                      </span>
                    )}
                  </span>
                  <span className={`material-symbols-outlined ${kpi.iconClass} text-lg`}>{kpi.icon}</span>
                </div>
                <div className={`font-h2 text-h2 ${kpi.valueClass}`}>{kpi.value}</div>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border border-tertiary/30 bg-tertiary/10 p-4 text-sm text-tertiary flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>
            Margem de contribuição = Faturamento − Comissão ML − Frete − Ads. Não inclui custo do produto (COGS) nem o repasse líquido real do Mercado Pago (antecipação, parcelamento). Esses entram quando os custos forem cadastrados e a integração de repasse for ligada.
          </span>
        </div>

        {paymentMix.length > 0 && (
          <div className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 p-lg flex flex-col gap-4">
            <h3 className="font-h3 text-h3 text-on-surface">Formas de Pagamento</h3>
            <div className="flex flex-col gap-4">
              {paymentMix.map((m) => {
                const pct = totalMix > 0 ? (m.qtd / totalMix) * 100 : 0
                return (
                  <div key={m.payment_type} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between font-label-md text-label-md">
                      <span className="text-on-surface">{PAYMENT_LABEL[m.payment_type] ?? m.payment_type}</span>
                      <span className="text-on-surface-variant">
                        {m.qtd} ({pct.toFixed(1).replace('.', ',')}%) · R$ {fmtBrl(m.valor)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-primary-fixed rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-white/10 flex items-center justify-between">
            <h3 className="font-h3 text-h3 text-on-surface">Dados Diários</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-surface-container-high/30">
                <tr>
                  <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                  <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Faturamento</th>
                  <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Comissão</th>
                  <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Frete</th>
                  <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Cupom</th>
                  <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Margem Contrib.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-lg py-12 text-center text-on-surface-variant">
                      Nenhum dado no período.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((r) => {
                    const m = r.faturamento - r.comissao - r.frete
                    return (
                      <tr key={r.date} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-lg py-3 text-on-surface">{shortDate(r.date)}</td>
                        <td className="px-md py-3 text-on-surface-variant text-right">{r.pedidos}</td>
                        <td className="px-md py-3 text-on-surface text-right font-mono-sm">{fmtBrl(r.faturamento)}</td>
                        <td className="px-md py-3 text-error text-right font-mono-sm">{fmtBrl(r.comissao)}</td>
                        <td className="px-md py-3 text-on-surface-variant text-right font-mono-sm">{fmtBrl(r.frete)}</td>
                        <td className="px-md py-3 text-tertiary text-right font-mono-sm">{fmtBrl(r.cupom)}</td>
                        <td className="px-lg py-3 text-right font-mono-sm text-secondary">{fmtBrl(m)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
