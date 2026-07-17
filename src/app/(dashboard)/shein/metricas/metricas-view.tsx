'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | 'mes' | 'custom'

export type DailyMetric = {
  connection_id: string
  metric_date: string
  orders_count: number
  gross_revenue: number | string
  net_revenue: number | string
  items_sold: number
  cancellations: number
}

const fmtBrl = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; onde: string; difere?: string }> = {
  'Preço Total dos Produtos': {
    title: 'Preço Total dos Produtos',
    oQueE: 'Soma do preço listado de cada produto × quantidade vendida no período. NÃO desconta promoções nem cupons — é o valor "bruto de tabela" das vendas.',
    origem: 'Campo `sellerCurrencyPrice × quantity` do payload de cada item de pedido (endpoint `/open-api/order/order-detail` da Shein).',
    onde: 'Painel Shein → Pedido → Meus Pedidos → resumo embaixo "Preço total dos produtos".',
    difere: 'Bate 100% com painel Meus Pedidos (diff ~0,05% por timing de snapshot Shein). Validado via cruzamento CSV: 1.564/1.567 pedidos idênticos.\n\nATENÇÃO: painel Analytics → Visão geral dos dados tem "GMV" e "Pagamento líquido GMV" com valores diferentes. Suporte técnico Shein confirmou (10/07/2026) que NÃO têm acesso à fórmula do Analytics — cálculo é interno e não expõe via API. Usamos Meus Pedidos como fonte oficial.',
  },
  'Pedidos': {
    title: 'Pedidos',
    oQueE: 'Quantidade de pedidos no período (inclui todos os status: pagos, aguardando pagamento, cancelados).',
    origem: '`count(*)` dos pedidos com `order_time` na janela BRT selecionada.',
    onde: 'Painel Shein → Pedido → Meus Pedidos → resumo "Quantidade de pedidos".',
    difere: 'Bate 100% EXATO (1.567 = 1.567 validado via CSV).',
  },
  'Ticket Médio': {
    title: 'Ticket Médio',
    oQueE: 'Preço Total dos Produtos ÷ Quantidade de pedidos.',
    origem: 'Calculado no frontend a partir dos 2 cards acima.',
    onde: 'Não existe direto no painel Shein — é métrica derivada.',
  },
  'Cancelados + Reembolsados': {
    title: 'Cancelados + Reembolsados',
    oQueE: 'Pedidos perdidos por qualquer via na janela: (a) cancelados antes do embarque (não pagos/rejeitados) OU (b) reembolsados após envio/entrega. Percentual = perdidos ÷ total.',
    origem: '`orderStatus = "7"` (cancelado) OU `orderReturnTime` preenchido no payload (reembolsado). Vias disjuntas somadas.',
    onde: 'Painel Shein → Meus Pedidos → aba "Cancelar" mostra APENAS reembolsos com sub-filtro "Cancelado". Cancelamentos puros aparecem em outra aba.',
    difere: 'Nossa métrica UNIFICA impacto real (cancel + reembolso). Painel Shein separa por sub-status. Nosso número tende a ser MAIOR pois soma tudo.',
  },
  'Itens Vendidos': {
    title: 'Itens Vendidos',
    oQueE: 'Quantidade total de unidades vendidas (soma das quantities de todos os items dos pedidos).',
    origem: '`sum(shein_order_items.quantity)` para pedidos na janela.',
    onde: 'Painel Shein → Pedido → Meus Pedidos → resumo "Quantidade de produtos".',
    difere: 'Bate 100% EXATO (1.852 = 1.852 validado via CSV).',
  },
  'Taxa Shein Total': {
    title: 'Taxa Shein Total',
    oQueE: 'Total de taxas cobradas pela Shein = Comissão (padrão ~18-20%) + Service Charge (fulfillment, ~R$ 4-5/item).',
    origem: 'Campos `commission` e `performanceServiceCharge` do payload por item.',
    onde: 'Painel Shein → Análise → Analise de custos ou Registro de liquidação → Detalhamento de taxa.',
    difere: 'Bate 99%+ com painel Shein. Payload de pedidos entregues (status 6) pode ter fees zerados (bug API Shein) — impacto mínimo.',
  },
  'Repasse (Líquido)': {
    title: 'Repasse (Líquido)',
    oQueE: 'Valor líquido REAL que cai na conta do vendedor = Preço Total - Comissão - Service Charge. É o "estimatedGrossIncome" do payload.',
    origem: 'Campo `estimatedGrossIncome` order-level do raw Shein, somado por pedido. Shein ZERA este campo quando o pedido é reembolsado → repasse de reembolsado conta como 0 (dinheiro devolvido).',
    onde: 'Painel Shein → Meus Pedidos → linha de resumo "Valor total resumido da receita estimada".',
    difere: 'Validado via CSV pedido-a-pedido: taxa e preço batem ao centavo. Repasse fica ~0,6% ABAIXO do painel de propósito. Motivo: usamos o campo oficial da Shein, que zera o repasse assim que o reembolso ABRE. O painel só zera quando o reembolso FECHA — então ele ainda conta reembolsos em processamento como receita. DECISÃO: manter o nosso (mais conservador e mais fresco) — não conta dinheiro que provavelmente será devolvido. O gap é só timing de reembolso em curso (flutua diariamente), não erro. Não é replicável ao centavo pois a API Shein não expõe o campo `refundStatus` (concluído vs pendente).',
  },
  '% Taxa / Repasse': {
    title: '% Taxa / Repasse',
    oQueE: 'Proporção da taxa Shein e do repasse líquido sobre o Preço Total.',
    origem: 'Calculado: Taxa Total ÷ Preço Total e Repasse ÷ Preço Total.',
    onde: 'Não existe direto no painel Shein — é métrica derivada.',
  },
  'Receita Líquida': {
    title: 'Receita Líquida',
    oQueE: 'Valor JÁ liquidado nos settlements Shein no período (dinheiro que efetivamente caiu na conta).',
    origem: '`sum(shein_settlements.net_amount)` para pedidos NOT cancelled.',
    onde: 'Painel Shein → Financeiro → Registro de liquidação (saques semanais).',
    difere: 'Só ~7% dos pedidos têm settlement liquidado (delay ~7 dias). Restante estimado via card "Repasse".',
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-2xl border border-zinc-700 shadow-2xl"
        style={{ background: 'rgba(22,27,34,0.97)' }}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">help</span>
            {info.title}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Fechar"
          >
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Por que pode diferir do painel</div>
              <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{info.difere}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HelpButton({ label, onOpen }: { label: string; onOpen: (key: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(label) }}
      className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors"
      aria-label={`Explicação: ${label}`}
    >
      <span className="material-symbols-outlined text-[14px]">help</span>
    </button>
  )
}

function StatCard({ label, value, icon, tone = 'default', onHelp }: { label: string; value: string; icon: string; tone?: 'default' | 'green' | 'red' | 'blue'; onHelp?: (key: string) => void }) {
  const toneCls = {
    default: 'text-white',
    green: 'text-secondary',
    red: 'text-error',
    blue: 'text-blue-400',
  }[tone]
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
          {onHelp && <HelpButton label={label} onOpen={onHelp} />}
        </div>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', toneCls)}>{value}</p>
    </div>
  )
}

export type CostAgg = {
  estimated: number
  totalGross: number
  gmv: number
  netGmv: number
  totalCommission: number
  totalServiceCharge: number
  coveredGross: number
  coveredEstimated: number
  coveredCost: number
  coveredProfit: number
  coveredUnits: number
  uncoveredUnits: number
}

export function MetricasView({
  rows,
  period,
  customFrom,
  customTo,
  nickname,
  costAgg,
}: {
  rows: DailyMetric[]
  period: Period
  customFrom: string | null
  customTo: string | null
  nickname?: string | null
  costAgg?: CostAgg
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [helpKey, setHelpKey] = useState<string | null>(null)
  const datePickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showDatePicker) return
    function onDown(e: MouseEvent) {
      if (!datePickerRef.current) return
      if (!datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showDatePicker])

  function pushParams(updater: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString())
    updater(next)
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false })
    })
  }

  function setPeriod(p: Period) {
    pushParams((next) => {
      next.set('period', p)
      if (p !== 'custom') {
        next.delete('from')
        next.delete('to')
      }
    })
  }

  function applyCustomRange(from: string, to: string) {
    pushParams((next) => {
      next.set('period', 'custom')
      next.set('from', from)
      next.set('to', to)
    })
    setShowDatePicker(false)
  }

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.orders += r.orders_count
        acc.cancellations += r.cancellations
        acc.gross += Number(r.gross_revenue)
        acc.net += Number(r.net_revenue)
        acc.items += r.items_sold
        return acc
      },
      { orders: 0, cancellations: 0, gross: 0, net: 0, items: 0 },
    )
  }, [rows])

  const ticketMedio = totals.orders > 0 ? totals.gross / totals.orders : 0
  const cancelRate = totals.orders > 0 ? (totals.cancellations / totals.orders) * 100 : 0

  return (
    <>
      <TopBar title="Métricas — Shein" />
      <main className={cn('overflow-y-auto p-margin', pending && 'opacity-70 transition-opacity')}>
        <div className="mb-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-white">Visão geral</h2>
            {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-[#050507] p-1">
              {(['7d', '30d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded px-3 py-1 text-xs font-medium transition-colors',
                    period === p ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
                  )}
                >
                  {p === '7d' ? '7 dias' : '30 dias'}
                </button>
              ))}
            </div>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => setShowDatePicker((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-[#050507] px-3 py-1.5 text-xs font-medium transition-colors',
                  period === 'custom' ? 'border-zinc-50/40 text-white' : 'text-slate-400 hover:text-white',
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
                  align="right"
                />
              )}
            </div>
          </div>
        </div>

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Preço Total dos Produtos" value={fmtBrl(totals.gross)} icon="payments" tone="green" onHelp={setHelpKey} />
          <StatCard label="Pedidos" value={fmtInt(totals.orders)} icon="shopping_cart" tone="blue" onHelp={setHelpKey} />
          <StatCard label="Ticket Médio" value={fmtBrl(ticketMedio)} icon="trending_up" onHelp={setHelpKey} />
          <StatCard label="Cancelados + Reembolsados" value={`${fmtInt(totals.cancellations)} (${cancelRate.toFixed(1)}%)`} icon="cancel" tone="red" onHelp={setHelpKey} />
        </div>

        {costAgg && (
          <>
            <div className="mb-lg">
              {(() => {
                const taxaTotal = costAgg.totalCommission + costAgg.totalServiceCharge
                const denom = totals.gross > 0 ? totals.gross : costAgg.totalGross
                const taxaPct = denom > 0 ? (taxaTotal / denom) * 100 : 0
                const repassePct = denom > 0 ? (costAgg.estimated / denom) * 100 : 0
                return (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Taxa Shein Total</span>
                          <HelpButton label="Taxa Shein Total" onOpen={setHelpKey} />
                        </div>
                        <Icon name="receipt_long" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-rose-300">-{fmtBrl(taxaTotal)}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        Comissão {fmtBrl(costAgg.totalCommission)} + Service {fmtBrl(costAgg.totalServiceCharge)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Repasse (Líquido)</span>
                          <HelpButton label="Repasse (Líquido)" onOpen={setHelpKey} />
                        </div>
                        <Icon name="account_balance_wallet" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-emerald-300">{fmtBrl(costAgg.estimated)}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">Que vai cair na conta Santander</p>
                    </div>
                    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">% Taxa / Repasse</span>
                          <HelpButton label="% Taxa / Repasse" onOpen={setHelpKey} />
                        </div>
                        <Icon name="percent" size={18} className="text-zinc-500" />
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-white">
                        <span className="text-rose-300">{taxaPct.toFixed(1)}%</span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-emerald-300">{repassePct.toFixed(1)}%</span>
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-500">Taxa absorvida vs repasse efetivo</p>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="mb-lg">
              {(() => {
                const coveragePct = costAgg.totalGross > 0 ? (costAgg.coveredGross / costAgg.totalGross) * 100 : 0
                const realMarginPct = costAgg.coveredGross > 0 ? (costAgg.coveredProfit / costAgg.coveredGross) * 100 : 0
                const profitTone = costAgg.coveredProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
                const marginTone = realMarginPct >= 30 ? 'text-emerald-300' : realMarginPct >= 10 ? 'text-amber-300' : 'text-rose-300'
                const covTone = coveragePct >= 80 ? 'text-emerald-300' : coveragePct >= 40 ? 'text-amber-300' : 'text-rose-300'
              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Lucro Real</span>
                      <Icon name="construction" size={18} className="text-amber-400" />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-amber-300">Em desenvolvimento</p>
                    <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                      Precisamos cadastrar o custo dos produtos pra determinar o lucro líquido.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Margem Real</span>
                      <Icon name="construction" size={18} className="text-amber-400" />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-amber-300">Em desenvolvimento</p>
                    <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                      Margem depende do custo dos produtos cadastrado.
                    </p>
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Custo Total</span>
                      <Icon name="paid" size={18} className="text-zinc-500" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-rose-300">{fmtBrl(costAgg.coveredCost)}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{fmtInt(costAgg.coveredUnits)} unidades c/ custo</p>
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Cobertura Custo</span>
                      <Icon name="data_check" size={18} className="text-zinc-500" />
                    </div>
                    <p className={cn('mt-2 text-3xl font-semibold', covTone)}>
                      {coveragePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {fmtInt(costAgg.uncoveredUnits)} unid. sem custo
                    </p>
                  </div>
                </div>
              )
            })()}
            </div>
          </>
        )}

        <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatCard label="Itens Vendidos" value={fmtInt(totals.items)} icon="inventory_2" onHelp={setHelpKey} />
          <StatCard label="Receita Líquida" value={fmtBrl(totals.net)} icon="account_balance_wallet" tone="green" onHelp={setHelpKey} />
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
          <div className="border-b border-zinc-800 px-6 py-4">
            <h3 className="text-sm font-semibold text-white">Diário — {period === '7d' ? '7 dias' : period === '90d' ? '90 dias' : '30 dias'}</h3>
            <p className="mt-1 text-xs text-slate-400">Agregado diariamente pelo workflow Shein - Métricas Diárias (06h BRT).</p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">Data</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Pedidos</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Cancel + Reemb</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Itens</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Bruto</th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Líquido</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Sem métricas no período. Aguarde próxima execução do cron diário (06h BRT).
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.metric_date} className="border-b border-zinc-800/60 hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{fmtDateBR(r.metric_date)}</td>
                    <td className="px-6 py-4 text-right">{fmtInt(r.orders_count)}</td>
                    <td className="px-6 py-4 text-right text-error">{fmtInt(r.cancellations)}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{fmtInt(r.items_sold)}</td>
                    <td className="px-6 py-4 text-right font-medium">{fmtBrl(r.gross_revenue)}</td>
                    <td className="px-6 py-4 text-right text-secondary">{fmtBrl(r.net_revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      <InfoModal infoKey={helpKey} onClose={() => setHelpKey(null)} />
    </>
  )
}
