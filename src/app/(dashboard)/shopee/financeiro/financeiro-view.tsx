'use client'

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import { InfoModal, InfoButton, type KpiInfo } from '@/components/kpi-info'
import type { ShopeeWalletTransaction, ShopeePayout, ShopeeDailyMetric } from '@/types'
import type { Period } from '@/components/metrics-chart'

export type FinanceiroPeriod = Period | 'custom'

// Explicação de cada KPI/aba do Financeiro — o que é, de onde vem, por que pode diferir da Shopee.
const FIN_INFO: Record<string, KpiInfo> = {
  'Lucro Bruto Macro': {
    title: 'Lucro Bruto Macro — Shopee',
    oQueE: 'O que sobra das vendas depois dos custos que a Shopee cobra e do que foi gasto em anúncios, no período do filtro:\n\nVendas − Comissão − Taxa de Serviço − Frete do vendedor − Ads\n\nA margem ao lado é esse lucro dividido pelas vendas. NÃO desconta custo do produto, impostos nem despesas da operação — por isso é "bruto".',
    origem: 'Métricas diárias da loja (tabela shopee_daily_metrics), a MESMA fonte da aba Métricas — que já foi validada contra as Informações Gerenciais da Shopee. Vendas = faturamento; Comissão e Taxa de Serviço = valores brutos cobrados por pedido (a líquida aparece no detalhe de cada card); Frete = frete que sai do bolso do vendedor; Ads = gasto consumido nas campanhas do Shopee Ads.',
    difere: 'É por DATA DA VENDA (métrica diária), não por data de liberação — então NÃO compare com o "Relatório de Renda" da Shopee, que é por liberação. Compare com as Informações Gerenciais no mesmo período.\n\nComissão e Serviço entram BRUTAS no cálculo. Quando a loja participa de campanhas, parte volta como "Ajuste por Participação em Ação Comercial" — esse valor aparece em verde abaixo do total, e a taxa líquida real fica no subtítulo dos cards Comissão/Taxa Serviço.\n\nO dia de hoje ainda está incompleto: use períodos fechados pra comparar.',
  },
  'Saldo Realizado': {
    title: 'Saldo Realizado',
    oQueE: 'Saldo da carteira Shopee Pay já efetivado — o valor da última transação sincronizada (campo current_balance).',
    origem: 'Campo current_balance da transação mais recente do extrato da carteira (get_wallet_transaction_list), sincronizado a cada 6h.',
    difere: 'NÃO bate com o "Saldo da Carteira" no topo da tela da Shopee por dois motivos: (1) o saldo do topo é atualizado em tempo real e o nosso é do último sync (cron 6h) — no meio do dia entra escrow e defasa; (2) a Shopee NÃO expõe um endpoint de "saldo total" na API do Brasil (só o current_balance das transações, que tem lag em relação ao topo). Para a visão de caixa, use "Saldo Realizado" (o que já caiu) + "A Liberar" (o que ainda vai cair).',
  },
  'A Liberar': {
    title: 'A Liberar',
    oQueE: 'Total de escrow retido pela Shopee que ainda vai ser repassado — pedidos pagos que ainda não concluíram/liberaram.',
    origem: 'Campo pending_amount do endpoint get_income_overview (Finanças da API Shopee), sincronizado a cada 6h.',
    difere: 'Bate com o "Pendente Total" no topo da tela Finanças → Minha Renda da Shopee. Pequenas diferenças são timing: o valor muda a cada pedido que conclui (sai de "A Liberar" e vira "Repasse de Venda" na carteira).',
  },
  'Repasses (vendas)': {
    title: 'Repasses (vendas)',
    oQueE: 'Dinheiro que a Shopee efetivamente liberou para a loja no período: o valor de cada pedido concluído que caiu na carteira, já descontadas todas as taxas.',
    origem: 'API de renda da Shopee (get_income_detail), pela data em que cada pedido foi liberado — a mesma fonte que a Shopee usa para montar o Relatório de Renda.',
    difere: 'Reconcilia com a linha "Quantidade Total Liberada" do Relatório de Renda (Finanças → Minha Renda → Exportar), desde que o período seja idêntico dos dois lados. Dois detalhes ao comparar: o card arredonda para reais inteiros, mas o valor com centavos é o mesmo do relatório; e o critério é a data em que a Shopee liberou o dinheiro, não a data do pedido.',
  },
  'Saques Bancários': {
    title: 'Saques Bancários',
    oQueE: 'Total transferido da carteira Shopee Pay para a conta bancária no período.',
    origem: 'Soma das transações "Saque Solicitado" (WITHDRAWAL_CREATED) do extrato da carteira.',
    difere: 'Bate com o filtro "Saques" (Saída) do extrato Saldo da Carteira. Cada saque também deve cruzar com o extrato bancário (Bradesco **7483).',
  },
  'Recarga Ads': {
    title: 'Recarga Ads',
    oQueE: 'Dinheiro que saiu do saldo da carteira pra abastecer o crédito de Shopee Ads (recargas, quase sempre R$ 1.000/dia automático).',
    origem: 'Soma das transações SPM_DEDUCT do extrato da carteira.',
    difere: 'Bate exato com o filtro "Saldo da Carteira - Pagamento" (Saída) do extrato Shopee. NÃO é o mesmo que "Gasto em Ads" das Métricas (#69): aquele é quanto foi CONSUMIDO nas campanhas; este é quanto saiu do saldo pra RECARREGAR o crédito. Recarga maior que consumo = sobra saldo de Ads acumulado.',
  },
  'Pagto Empréstimo': {
    title: 'Pagto Empréstimo',
    oQueE: 'Parcelas do "Empréstimo para Vendedores" da Shopee pagas no período, debitadas direto do saldo.',
    origem: 'Transações SPM_DEDUCT_DIRECT do extrato da carteira (transaction_tab_type = seller_loan, descrição "Pagamento do Empréstimo para Vendedores").',
    difere: 'Bate com o filtro "Empréstimo para Vendedores" (Saída) do extrato Shopee. Antes estava somado por engano no "Gastos Marketing" — separado agora porque é dívida, não marketing.',
  },
  'Total Entradas': {
    title: 'Total Entradas',
    oQueE: 'Soma de tudo que ENTROU na carteira no período (repasses de venda, ajustes de crédito, compensações).',
    origem: 'Soma de todas as transações com valor positivo do extrato da carteira, no período.',
    difere: 'Bate com o "Valor total" do filtro Fluxo = Entrada no extrato Saldo da Carteira da Shopee (mesmo período).',
  },
  'Total Saídas': {
    title: 'Total Saídas',
    oQueE: 'Soma de tudo que SAIU da carteira no período (saques, taxas, marketing, ajustes de débito).',
    origem: 'Soma de todas as transações com valor negativo do extrato da carteira, no período.',
    difere: 'Bate com o "Valor total" do filtro Fluxo = Saída no extrato Saldo da Carteira da Shopee (mesmo período).',
  },
}

// Explicação dos cards de resumo da aba Taxas (todos do extrato escrow por pedido, validados no card #71).
export type IncomeSummary = {
  pedidos: number
  renda_liberada: number
  com_pedidos_taxa: number
  estimados: number
  comissao_liq: number
  servico_liq: number
  dev_facil: number
  frete_liquido: number
  produtos_bruto: number
} | null

const TAXAS_INFO: Record<string, KpiInfo> = {
  'Subtotal dos Produtos': {
    title: 'Subtotal dos Produtos',
    oQueE: 'Preço de venda dos produtos (sem frete, sem cupom) dos pedidos do período.',
    origem: 'Campo order_selling_price do extrato financeiro (escrow) que a Shopee retorna por pedido — mesma fonte da tela Minha Renda.',
    difere: 'Bate com o "Subtotal dos Produtos" do detalhe de renda por pedido na Shopee.\n\nIMPORTANTE no AGREGADO: esta aba conta pedidos por DATA DE CRIAÇÃO. O Relatório de Renda (export) da Shopee conta por DATA DE LIBERAÇÃO. Mesmo período = conjuntos de pedidos DIFERENTES (pedido criado no período pode não ter liberado, e um liberado no período pode ter sido criado antes). Por isso o total do período não bate direto com o export — pra conferir, case por NÚMERO DO PEDIDO, não por total.',
  },
  'Valor do Reembolso': {
    title: 'Valor do Reembolso',
    oQueE: 'Total reembolsado ao comprador em pedidos com devolução no período.',
    origem: 'Campo seller_return_refund do extrato financeiro (escrow) por pedido.',
    difere: 'Bate com a linha "Valor do Reembolso" do Relatório de Renda da Shopee.',
  },
  'Taxa de comissão líquida': {
    title: 'Taxa de comissão líquida',
    oQueE: 'Comissão cobrada pela Shopee já descontando o que volta em campanhas ("Ajuste por Participação em Ação Comercial"). A bruta aparece no subtítulo.',
    origem: 'Campos net_commission_fee (líquida) e commission_fee (bruta) do extrato escrow por pedido.',
    difere: 'Bate com "Taxa de comissão líquida" do detalhe de renda da Shopee (validado 99%+ vs Relatório de Renda no card #71).',
  },
  'Taxa de serviço líquida': {
    title: 'Taxa de serviço líquida',
    oQueE: 'Taxa de serviço já líquida de ajustes de campanha. Inclui o custo do programa Frete Grátis e a taxa de transação. Bruta no subtítulo.',
    origem: 'Campos net_service_fee (líquida) e service_fee (bruta) do extrato escrow por pedido.',
    difere: 'Bate com "Taxa de serviço líquida" do detalhe de renda da Shopee (validado no card #71).',
  },
  'Taxa de Devolução Fácil': {
    title: 'Taxa de Devolução Fácil',
    oQueE: 'Taxa do programa Devolução Fácil da Shopee (proteção de envio reverso), cobrada por pedido.',
    origem: 'Campo shipping_seller_protection_fee_amount do extrato escrow por pedido.',
    difere: 'Bate com "Taxa de Devolução Fácil Shopee" do detalhe de renda. Em pedidos muito recentes pode faltar R$ 0,49: a Shopee às vezes lança essa taxa na tela antes de refleti-la no escrow da API (lag interno da Shopee, não erro nosso).',
  },
  'Frete pago pelo vendedor': {
    title: 'Frete pago pelo vendedor',
    oQueE: 'Frete que efetivamente sai do bolso do vendedor: frete real da transportadora − subsídio Shopee − parte paga pelo comprador. Fica perto de zero. Somado COM sinal: pedidos onde a Shopee subsidia mais que o custo entram como crédito (verde, +), igual a Shopee faz.',
    origem: 'Três campos do extrato escrow por pedido (frete real, subsídio Shopee, frete do comprador).',
    difere: 'Bate com o "Subtotal de Envio" do Relatório de Renda quando casado por pedido. No agregado do período diverge pelo mesmo motivo das outras taxas (esta aba é por data de CRIAÇÃO, o relatório por data de LIBERAÇÃO) + as discrepâncias de peso (aba "Shipping Fee Discrepancy" do export), onde o frete real cobrado ≠ o esperado.',
  },
  'Renda dos pedidos': {
    title: 'Renda dos pedidos',
    oQueE: 'Valor líquido que sobra por pedido depois de todas as taxas e frete — o que a Shopee vai repassar (escrow).',
    origem: 'Campo escrow_amount do extrato financeiro (escrow) por pedido.',
    difere: 'Pedido a pedido bate exato com "Renda do pedido" da tela Minha Renda (validado no card #97).\n\nNo AGREGADO do período pode divergir ~0,5-1% do Relatório de Renda por 3 motivos: (1) EIXO — esta aba é por data de criação, o relatório por data de liberação, então são conjuntos de pedidos diferentes; (2) pedidos com escrow ESTIMADO (ainda não finalizado pela Shopee), que convergem quando ela libera; (3) AJUSTES pós-liberação (o Summary do relatório os exclui; ficam na aba "Adjustment" do export).',
  },
}

const periods: { key: FinanceiroPeriod; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => n.toLocaleString('pt-BR')

const typeLabel: Record<string, string> = {
  ESCROW_VERIFIED_ADD: 'Repasse de Venda',
  ESCROW_VERIFIED_MINUS: 'Estorno Repasse',
  WITHDRAWAL_CREATED: 'Saque Solicitado',
  WITHDRAWAL_COMPLETED: 'Saque Concluído',
  SPM_DEDUCT: 'Recarga Ads (via saldo)',
  SPM_DEDUCT_DIRECT: 'Pagamento Empréstimo',
  ADJUSTMENT_CENTER_DEDUCT: 'Ajuste — Débito',
  ADJUSTMENT_CENTER_ADD: 'Ajuste — Crédito',
  ADJUSTMENT_FOR_RR_AFTER_ESCROW_VERIFIED: 'Ajuste Pós-Repasse',
  FAST_ESCROW_DEDUCT: 'Repasse Rápido — Taxa',
  RETURN_COMPENSATION_SERVICE_ADD: 'Compensação Devolução',
}

const typeIcon: Record<string, string> = {
  ESCROW_VERIFIED_ADD: 'shopping_bag',
  ESCROW_VERIFIED_MINUS: 'undo',
  WITHDRAWAL_CREATED: 'arrow_circle_down',
  WITHDRAWAL_COMPLETED: 'check_circle',
  SPM_DEDUCT: 'campaign',
  SPM_DEDUCT_DIRECT: 'campaign',
  ADJUSTMENT_CENTER_DEDUCT: 'remove_circle',
  ADJUSTMENT_CENTER_ADD: 'add_circle',
  ADJUSTMENT_FOR_RR_AFTER_ESCROW_VERIFIED: 'tune',
  FAST_ESCROW_DEDUCT: 'bolt',
  RETURN_COMPENSATION_SERVICE_ADD: 'redeem',
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const fmtShortDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

type TypeAgg = {
  type: string
  qty: number
  total_cents: number
  is_in: boolean
}

function aggregateByType(txs: ShopeeWalletTransaction[]): TypeAgg[] {
  const map = new Map<string, TypeAgg>()
  for (const t of txs) {
    const key = t.transaction_type || 'unknown'
    if (!map.has(key)) {
      map.set(key, { type: key, qty: 0, total_cents: 0, is_in: false })
    }
    const agg = map.get(key)!
    agg.qty++
    agg.total_cents += Number(t.amount_cents) || 0
  }
  for (const a of map.values()) {
    a.is_in = a.total_cents >= 0
  }
  return Array.from(map.values()).sort((a, b) => Math.abs(b.total_cents) - Math.abs(a.total_cents))
}

function buildDailyFlow(txs: ShopeeWalletTransaction[]) {
  const byDate = new Map<string, { in_cents: number; out_cents: number }>()
  for (const t of txs) {
    const date = t.create_time.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, { in_cents: 0, out_cents: 0 })
    const e = byDate.get(date)!
    const amt = Number(t.amount_cents) || 0
    if (amt >= 0) e.in_cents += amt
    else e.out_cents += amt
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, in_value: v.in_cents / 100, out_value: Math.abs(v.out_cents / 100), net: (v.in_cents + v.out_cents) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export type OrderFeeRow = {
  order_sn: string
  date_created: string
  status: string
  valor: number
  preco_produto: number
  reembolso: number
  buyer_ship: number
  comissao_bruta: number
  comissao_liq: number
  servico_bruta: number
  servico_liq: number
  dev_facil_real: number
  frete_real: number
  frete_rebate: number
  renda: number
  estimado: boolean
  sem_escrow: boolean
}

export function FinanceiroView({
  transactions,
  payouts,
  latestBalanceCents,
  dailyMetrics,
  period,
  customFrom,
  customTo,
  typeFilter,
  nickname,
  orderFeesList,
  pendingAmountCents,
  releasedAmountCents,
  incomeSummary,
}: {
  transactions: ShopeeWalletTransaction[]
  payouts: ShopeePayout[]
  latestBalanceCents: number | null
  dailyMetrics: ShopeeDailyMetric[]
  period: FinanceiroPeriod
  customFrom: string | null
  customTo: string | null
  typeFilter: string
  nickname: string | null
  orderFeesList?: OrderFeeRow[] | null
  pendingAmountCents?: number | null
  releasedAmountCents?: number | null
  incomeSummary?: IncomeSummary | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [showDatePicker, setShowDatePicker] = useState(false)
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

  const [infoKey, setInfoKey] = useState<string | null>(null)

  type ViewMode = 'overview' | 'transacoes' | 'saques' | 'payouts' | 'taxas'
  const rawView = searchParams.get('view') as ViewMode | null
  const view: ViewMode =
    rawView === 'transacoes' || rawView === 'saques' || rawView === 'payouts' || rawView === 'overview' || rawView === 'taxas'
      ? rawView
      : 'overview'

  function setView(v: ViewMode) {
    const sp = new URLSearchParams(searchParams.toString())
    if (v === 'overview') sp.delete('view')
    else sp.set('view', v)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const withdrawalCount = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_CREATED').length

  function setPeriod(p: FinanceiroPeriod) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    if (p !== 'custom') {
      sp.delete('from')
      sp.delete('to')
    }
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function applyCustomRange(from: string, to: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', 'custom')
    sp.set('from', from)
    sp.set('to', to)
    setShowDatePicker(false)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  function setType(t: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (t === 'all') sp.delete('type')
    else sp.set('type', t)
    startTransition(() => router.replace(`?${sp.toString()}`, { scroll: false }))
  }

  const aggregated = useMemo(() => aggregateByType(transactions), [transactions])
  const daily = useMemo(() => buildDailyFlow(transactions), [transactions])

  const totalIn = transactions.reduce((a, t) => a + Math.max(0, Number(t.amount_cents) || 0), 0) / 100
  const totalOut = transactions.reduce((a, t) => a + Math.min(0, Number(t.amount_cents) || 0), 0) / 100
  const netPeriodo = totalIn + totalOut
  const escrowVendas = transactions.filter(t => t.transaction_type === 'ESCROW_VERIFIED_ADD').reduce((a, t) => a + (Number(t.amount_cents) || 0), 0) / 100
  const totalSaques = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_CREATED').reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100
  // SPM_DEDUCT = recarga de Ads via saldo ("Saldo da Carteira - Pagamento" na Shopee).
  // SPM_DEDUCT_DIRECT NÃO entra aqui: é "Pagamento do Empréstimo para Vendedores" (tab seller_loan), não marketing.
  const gastosSpm = transactions.filter(t => t.transaction_type === 'SPM_DEDUCT').reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100
  const pagtoEmprestimo = transactions.filter(t => t.transaction_type === 'SPM_DEDUCT_DIRECT').reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100

  const filteredTxs = useMemo(() => {
    if (typeFilter === 'all') return transactions
    return transactions.filter(t => t.transaction_type === typeFilter)
  }, [transactions, typeFilter])

  const maxBar = Math.max(...daily.map(d => Math.max(d.in_value, d.out_value)), 1)
  const totalPayoutsReais = payouts.reduce((a, p) => a + (Number(p.payout_amount_cents) || 0), 0) / 100

  return (
    <>
      <TopBar title="Financeiro — Shopee" />
      <main
        className={cn('flex flex-1 flex-col gap-gutter overflow-y-auto p-margin', pending && 'opacity-70 pointer-events-none')}
        style={showDatePicker ? { paddingBottom: '560px' } : undefined}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-zinc-50 flex items-center gap-sm">
              Financeiro
              <span className="text-zinc-500 font-normal">—</span>
              <span className="text-zinc-50">Shopee</span>
            </h1>
            <p className="font-body-md text-body-md text-zinc-400 mt-1">
              {nickname ? `Conta ${nickname}` : 'Conta Shopee ativa'} · fluxo de caixa real da carteira.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center rounded-lg p-1 border border-zinc-800 bg-zinc-900/60">
              {periods.map((p) => {
                const active = period === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      'px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors',
                      active ? 'bg-zinc-50 text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-50',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <div ref={datePickerRef} className="relative z-30">
              <button
                type="button"
                onClick={() => setShowDatePicker(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  period === 'custom'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-50',
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

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800">
          {[
            { key: 'overview' as const, label: 'Visão Geral', icon: 'dashboard', badge: null as number | null },
            { key: 'transacoes' as const, label: 'Transações', icon: 'receipt_long', badge: transactions.length },
            { key: 'saques' as const, label: 'Saques Bancários', icon: 'account_balance', badge: withdrawalCount },
            { key: 'payouts' as const, label: 'Repasses', icon: 'paid', badge: payouts.length || null },
            { key: 'taxas' as const, label: 'Taxas', icon: 'receipt', badge: orderFeesList?.length || null },
          ].map((t) => {
            const active = view === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  active
                    ? 'border-primary text-zinc-50'
                    : 'border-transparent text-zinc-500 hover:text-zinc-200',
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-mono font-semibold',
                    active ? 'bg-primary/20 text-primary' : 'bg-zinc-800 text-zinc-400',
                  )}>
                    {t.badge.toLocaleString('pt-BR')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {view === 'overview' && (<>
        {/* Lucro Bruto Macro — fórmula João: Vendas − Taxas Shopee − Ads */}
        {(() => {
          const vendas = dailyMetrics.reduce((a, m) => a + (Number(m.gross_revenue) || 0), 0)
          // Base % de taxa: preço de venda dos produtos (sem frete comprador/vouchers Shopee)
          const vendasProduto = dailyMetrics.reduce((a, m) => a + (Number(m.total_product_sales) || 0), 0) || vendas
          const comissaoBruta = dailyMetrics.reduce((a, m) => a + (Number(m.total_commission_fee) || 0), 0)
          const servicoBruta = dailyMetrics.reduce((a, m) => a + (Number(m.total_service_fee) || 0), 0)
          const comissaoNet = dailyMetrics.reduce((a, m) => a + (Number(m.total_commission_net) || 0), 0)
          const servicoNet = dailyMetrics.reduce((a, m) => a + (Number(m.total_service_fee_net) || 0), 0)
          // Fallback: dias antigos sem colunas novas usam total_commission agregado
          const temSeparado = comissaoBruta > 0 || servicoBruta > 0
          const comissao = temSeparado ? comissaoBruta : dailyMetrics.reduce((a, m) => a + (Number(m.total_commission) || 0), 0)
          const servico = temSeparado ? servicoBruta : 0
          const frete = dailyMetrics.reduce((a, m) => a + (Number(m.total_shipping_cost) || 0), 0)
          const ads = dailyMetrics.reduce((a, m) => a + (Number(m.ads_spend_cents) || 0), 0) / 100
          const lucroBruto = vendas - comissao - servico - frete - ads
          const margemBruta = vendas > 0 ? (lucroBruto / vendas) * 100 : 0
          const subsidioCampanha = temSeparado && comissaoNet + servicoNet > 0
            ? (comissao + servico) - (comissaoNet + servicoNet)
            : 0
          if (dailyMetrics.length === 0) return null
          return (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03) 50%, rgba(248,113,113,0.04))',
                border: '1px solid #27272a',
                borderRadius: '14px',
                padding: '20px 24px',
              }}
            >
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-emerald-400">savings</span>
                    Lucro Bruto Macro — Shopee
                    <InfoButton show label="Lucro Bruto Macro" onOpen={() => setInfoKey('Lucro Bruto Macro')} />
                  </div>
                  <div className={cn('font-h1 text-h1 mt-2', lucroBruto >= 0 ? 'text-secondary' : 'text-error')}>
                    {lucroBruto >= 0 ? '+' : ''}{fmtBrlInt(lucroBruto)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Vendas − Comissão − Taxa Serviço − Frete − Ads · margem {margemBruta.toFixed(1).replace('.', ',')}%
                  </div>
                  {subsidioCampanha > 0 && (
                    <div className="text-[10px] text-emerald-400/80 mt-1">
                      +{fmtBrlInt(subsidioCampanha)} de Ajuste por Participação em Ação Comercial — desconto nas taxas por campanhas Shopee (taxa líquida real: {fmtBrlInt(comissaoNet + servicoNet)})
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 min-w-[640px]">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Vendas</div>
                    <div className="text-zinc-50 font-h3 text-h3 mt-1">{fmtBrlInt(vendas)}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Comissão</div>
                    <div className="text-error font-h3 text-h3 mt-1">−{fmtBrlInt(comissao)}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {temSeparado && comissaoNet > 0
                        ? `líquida ${fmtBrlInt(comissaoNet)} · ${((comissao / vendasProduto) * 100).toFixed(1)}% das vendas de produto`
                        : vendasProduto > 0 ? `${((comissao / vendasProduto) * 100).toFixed(1)}% das vendas de produto` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Taxa Serviço</div>
                    <div className="text-error font-h3 text-h3 mt-1">−{fmtBrlInt(servico)}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {temSeparado && servicoNet > 0 ? `líquida ${fmtBrlInt(servicoNet)}` : 'frete grátis + transação'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Frete</div>
                    <div className="text-error font-h3 text-h3 mt-1">−{fmtBrlInt(frete)}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">pago pelo vendedor</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-md">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Ads</div>
                    <div className="text-error font-h3 text-h3 mt-1">−{fmtBrlInt(ads)}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{vendas > 0 ? `${((ads / vendas) * 100).toFixed(1)}%` : '—'} das vendas</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-gutter">
          {[
            { label: 'Saldo Realizado', value: latestBalanceCents !== null ? fmtBrlInt(latestBalanceCents / 100) : '—', icon: 'account_balance_wallet', tone: 'text-zinc-50', sub: 'última tx sincronizada' },
            { label: 'A Liberar', value: pendingAmountCents != null ? fmtBrlInt(pendingAmountCents / 100) : '—', icon: 'schedule', tone: 'text-tertiary', sub: 'escrow retido a receber' },
            { label: 'Repasses (vendas)', value: fmtBrlInt(incomeSummary?.renda_liberada ?? escrowVendas), icon: 'shopping_bag', tone: 'text-secondary', sub: incomeSummary ? 'renda liberada — bate com o export' : null },
            { label: 'Saques Bancários', value: fmtBrlInt(totalSaques), icon: 'arrow_circle_down', tone: 'text-primary', sub: null },
            { label: 'Recarga Ads', value: fmtBrlInt(gastosSpm), icon: 'campaign', tone: 'text-error', sub: 'saldo → Shopee Ads' },
            { label: 'Pagto Empréstimo', value: fmtBrlInt(pagtoEmprestimo), icon: 'account_balance', tone: 'text-error', sub: 'Empréstimo p/ Vendedores' },
            { label: 'Total Entradas', value: fmtBrlInt(totalIn), icon: 'trending_up', tone: 'text-secondary', sub: null },
            { label: 'Total Saídas', value: fmtBrlInt(Math.abs(totalOut)), icon: 'trending_down', tone: 'text-error', sub: null },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider">{kpi.label}</span>
                  <InfoButton show={!!FIN_INFO[kpi.label]} label={kpi.label} onOpen={() => setInfoKey(kpi.label)} />
                </div>
                <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
              </div>
              <div className={cn('font-h2 text-h2', kpi.tone)}>{kpi.value}</div>
              {kpi.sub && <div className="text-[11px] text-zinc-500 -mt-1">{kpi.sub}</div>}
            </div>
          ))}
        </div>

        {/* Saldo líquido período */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex items-center justify-between gap-4">
          <div>
            <div className="text-label-md text-zinc-400 uppercase tracking-wider">Saldo Líquido do Período</div>
            <div className={cn('font-h1 text-h1 mt-1', netPeriodo >= 0 ? 'text-secondary' : 'text-error')}>
              {netPeriodo >= 0 ? '+' : ''}{fmtBrlInt(netPeriodo)}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Entradas {fmtBrlInt(totalIn)} − Saídas {fmtBrlInt(Math.abs(totalOut))} = {transactions.length} transações
            </div>
          </div>
          <span className="material-symbols-outlined text-6xl text-zinc-800">savings</span>
        </div>

        {/* Gráfico fluxo diário */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-h3 text-h3 text-zinc-50">Fluxo Diário</h3>
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error" /> Saídas</span>
            </div>
          </div>
          {daily.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">Sem movimentações no período</div>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto">
              {daily.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1 min-w-[44px]">
                  <div className="flex items-end gap-[2px] h-32">
                    <div
                      className="w-3 bg-secondary/80 rounded-t"
                      style={{ height: `${(d.in_value / maxBar) * 100}%` }}
                      title={`Entradas: R$ ${fmtBrl(d.in_value)}`}
                    />
                    <div
                      className="w-3 bg-error/80 rounded-t"
                      style={{ height: `${(d.out_value / maxBar) * 100}%` }}
                      title={`Saídas: R$ ${fmtBrl(d.out_value)}`}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-500">{fmtShortDate(d.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        </>)}

        {view === 'transacoes' && (<>
        {/* Resumo por tipo */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-white/10">
            <h3 className="font-h3 text-h3 text-zinc-50">Resumo por Tipo de Transação</h3>
            <p className="text-xs text-zinc-500 mt-1">Click pra filtrar a lista abaixo</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-zinc-900/60">
                <tr>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Tipo</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Qtd</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor Total</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Filtro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/[0.02]">
                  <td className="px-lg py-3 text-zinc-50 font-medium">Todos</td>
                  <td className="px-md py-3 text-zinc-400 text-right">{fmtNum(transactions.length)}</td>
                  <td className="px-md py-3 text-right font-mono-sm">—</td>
                  <td className="px-lg py-3">
                    <button
                      type="button"
                      onClick={() => setType('all')}
                      className={cn('px-2 py-1 rounded text-[10px] font-semibold', typeFilter === 'all' ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-50')}
                    >
                      {typeFilter === 'all' ? 'Ativo' : 'Aplicar'}
                    </button>
                  </td>
                </tr>
                {aggregated.map((a) => (
                  <tr key={a.type} className="hover:bg-white/[0.02]">
                    <td className="px-lg py-3 text-zinc-50">
                      <div className="flex items-center gap-2">
                        <span className={cn('material-symbols-outlined text-[16px]', a.is_in ? 'text-secondary' : 'text-error')}>
                          {typeIcon[a.type] || 'paid'}
                        </span>
                        <div className="flex flex-col">
                          <span>{typeLabel[a.type] || a.type}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">{a.type}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-md py-3 text-zinc-400 text-right">{fmtNum(a.qty)}</td>
                    <td className={cn('px-md py-3 text-right font-mono-sm font-semibold', a.is_in ? 'text-secondary' : 'text-error')}>
                      {a.is_in ? '+' : ''}{fmtBrlInt(a.total_cents / 100)}
                    </td>
                    <td className="px-lg py-3">
                      <button
                        type="button"
                        onClick={() => setType(a.type)}
                        className={cn('px-2 py-1 rounded text-[10px] font-semibold', typeFilter === a.type ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-50')}
                      >
                        {typeFilter === a.type ? 'Ativo' : 'Aplicar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lista transações */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-white/10 flex items-center justify-between">
            <h3 className="font-h3 text-h3 text-zinc-50">
              Transações {typeFilter !== 'all' && (
                <span className="text-zinc-500 font-normal text-sm ml-2">{typeLabel[typeFilter] || typeFilter}</span>
              )}
            </h3>
            <span className="text-xs text-zinc-500">{fmtNum(filteredTxs.length)} {filteredTxs.length === 1 ? 'transação' : 'transações'}</span>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-zinc-900/60 sticky top-0 z-10">
                <tr>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Tipo</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Pedido</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Saldo Após</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-zinc-500 py-8">Sem transações</td>
                  </tr>
                ) : (
                  filteredTxs.slice(0, 500).map((t) => {
                    const amount = Number(t.amount_cents) / 100
                    const isIn = amount >= 0
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="px-lg py-2 text-zinc-400 text-xs">{fmtDate(t.create_time)}</td>
                        <td className="px-md py-2">
                          <div className="flex items-center gap-2">
                            <span className={cn('material-symbols-outlined text-[14px]', isIn ? 'text-secondary' : 'text-error')}>
                              {typeIcon[t.transaction_type || ''] || 'paid'}
                            </span>
                            <span className="text-zinc-50 text-xs">{typeLabel[t.transaction_type || ''] || t.transaction_type || '—'}</span>
                          </div>
                        </td>
                        <td className="px-md py-2 text-zinc-500 font-mono text-[10px]">{t.order_sn || '—'}</td>
                        <td className={cn('px-md py-2 text-right font-mono-sm font-semibold', isIn ? 'text-secondary' : 'text-error')}>
                          {isIn ? '+' : ''}R$ {fmtBrl(amount)}
                        </td>
                        <td className="px-md py-2 text-right font-mono-sm text-zinc-400">
                          {t.current_balance_cents !== null ? `R$ ${fmtBrl(Number(t.current_balance_cents) / 100)}` : '—'}
                        </td>
                        <td className="px-lg py-2 text-zinc-500 text-xs">{t.status || '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredTxs.length > 500 && (
            <div className="p-3 border-t border-white/10 text-center text-xs text-zinc-500">
              Mostrando 500 mais recentes de {fmtNum(filteredTxs.length)}
            </div>
          )}
        </div>

        </>)}

        {view === 'saques' && (<>
        {/* Saques Bancários (Shopee Pay → Conta Lucas/Santander) */}
        {(() => {
          const withdrawals = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_CREATED')
          const completions = transactions.filter(t => t.transaction_type === 'WITHDRAWAL_COMPLETED')
          if (withdrawals.length === 0) return null
          const completionByWithdrawalId = new Map<string, ShopeeWalletTransaction>()
          for (const c of completions) {
            const raw = c.raw as { withdrawal_id?: number | string } | null
            const wid = raw?.withdrawal_id != null ? String(raw.withdrawal_id) : null
            if (wid) completionByWithdrawalId.set(wid, c)
          }
          const totalSacado = withdrawals.reduce((a, t) => a + Math.abs(Number(t.amount_cents) || 0), 0) / 100
          const maxSaque = withdrawals.reduce((m, t) => Math.max(m, Math.abs(Number(t.amount_cents) || 0)), 0) / 100
          const ultimoSaque = withdrawals[0]
          const mediaSaques = withdrawals.length > 0 ? totalSacado / withdrawals.length : 0

          return (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(16,185,129,0.04))',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  padding: '20px 24px',
                }}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] text-primary">account_balance</span>
                      Saques Bancários
                    </div>
                    <h3 className="font-h3 text-h3 text-zinc-50 mt-1">Transferências Shopee Pay → Conta</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Saques sincronizados via wallet API. Cruzar withdrawal_id com extrato Santander.
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-3 min-w-[480px]">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Total Sacado</div>
                      <div className="text-primary font-h3 text-h3 mt-1">{fmtBrlInt(totalSacado)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Saques</div>
                      <div className="text-zinc-50 font-h3 text-h3 mt-1">{fmtNum(withdrawals.length)}</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">média {fmtBrlInt(mediaSaques)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Maior Saque</div>
                      <div className="text-zinc-50 font-h3 text-h3 mt-1">{fmtBrlInt(maxSaque)}</div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-md">
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Último Saque</div>
                      <div className="text-zinc-50 font-h3 text-h3 mt-1">
                        {fmtBrlInt(Math.abs(Number(ultimoSaque.amount_cents) || 0) / 100)}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">{fmtShortDate(ultimoSaque.create_time)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left font-label-md text-label-md whitespace-nowrap border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="bg-zinc-950 px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Data Solicitação</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right border-b border-white/10">Valor</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right border-b border-white/10">Saldo Após</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Withdrawal ID</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Carteira</th>
                      <th className="bg-zinc-950 px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Conclusão</th>
                      <th className="bg-zinc-950 px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] border-b border-white/10">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {withdrawals.map((w) => {
                      const raw = w.raw as { withdrawal_id?: number | string; transaction_fee?: number } | null
                      const wid = raw?.withdrawal_id != null ? String(raw.withdrawal_id) : null
                      const fee = (raw?.transaction_fee ?? 0) as number
                      const valor = Math.abs(Number(w.amount_cents) || 0) / 100
                      const completion = wid ? completionByWithdrawalId.get(wid) : undefined
                      return (
                        <tr key={w.id} className="hover:bg-white/[0.02]">
                          <td className="px-lg py-2 text-zinc-400 text-xs">{fmtDate(w.create_time)}</td>
                          <td className="px-md py-2 text-right font-mono-sm text-primary font-semibold">
                            R$ {fmtBrl(valor)}
                          </td>
                          <td className="px-md py-2 text-right font-mono-sm text-zinc-400">
                            {w.current_balance_cents != null ? `R$ ${fmtBrl(Number(w.current_balance_cents) / 100)}` : '—'}
                          </td>
                          <td className="px-md py-2">
                            {wid ? (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(wid)}
                                className="group inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                                title="Copiar withdrawal_id pra cruzar com extrato Santander"
                              >
                                <span>{wid}</span>
                                <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-100 transition-opacity">content_copy</span>
                              </button>
                            ) : '—'}
                          </td>
                          <td className="px-md py-2 text-zinc-500 text-xs">{w.wallet_type || '—'}</td>
                          <td className="px-md py-2 text-zinc-500 text-xs">
                            {completion ? fmtDate(completion.create_time) : '—'}
                          </td>
                          <td className="px-lg py-2">
                            <span className={cn(
                              'inline-block px-2 py-0.5 rounded text-[10px] font-semibold border',
                              completion
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                            )}>
                              {completion ? 'Concluído' : (w.status || 'Solicitado')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-white/10 text-center text-[10px] text-zinc-600">
                💡 BR API não retorna banco destino. Cruzar withdrawal_id + valor + data com extrato Santander.
              </div>
            </div>
          )
        })()}

        </>)}

        {view === 'payouts' && (<>
        {/* Payouts (se houver) */}
        {payouts.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
            <div className="p-lg border-b border-white/10 flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-zinc-50">Repasses Históricos (Payouts)</h3>
              <span className="text-xs text-zinc-500">{payouts.length} repasses · Total {fmtBrlInt(totalPayoutsReais)}</span>
            </div>
            <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
              <thead className="bg-zinc-900/60">
                <tr>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Período</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Banco</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                  <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Valor</th>
                  <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-lg py-2 text-zinc-400 text-xs">{fmtDate(p.payout_time)}</td>
                    <td className="px-md py-2 text-zinc-500 text-xs">
                      {p.payout_period_start && p.payout_period_end
                        ? `${fmtShortDate(p.payout_period_start)} → ${fmtShortDate(p.payout_period_end)}`
                        : '—'}
                    </td>
                    <td className="px-md py-2 text-zinc-500 font-mono text-xs">{p.bank_account_masked || '—'}</td>
                    <td className="px-md py-2 text-zinc-400 text-right">{p.total_orders ?? '—'}</td>
                    <td className="px-md py-2 text-right font-mono-sm text-secondary font-semibold">
                      R$ {fmtBrl(Number(p.payout_amount_cents) / 100)}
                    </td>
                    <td className="px-lg py-2 text-zinc-500 text-xs">{p.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {payouts.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-xl flex flex-col items-center gap-md text-center">
            <span className="material-symbols-outlined text-4xl text-zinc-600">paid</span>
            <h3 className="font-h3 text-h3 text-zinc-50">Nenhum repasse registrado</h3>
            <p className="text-sm text-zinc-500 max-w-md">
              Endpoint <code className="font-mono text-xs">get_payout_detail</code> retorna <em>&quot;only applicable for cross boarder shop&quot;</em> em loja BR.
              Use a aba <strong>Saques Bancários</strong> pra ver transferências reais Shopee Pay → Conta.
            </p>
          </div>
        )}
        </>)}

        {view === 'taxas' && <TaxasTab rows={orderFeesList ?? []} />}
      </main>
      <InfoModal info={infoKey ? FIN_INFO[infoKey] ?? null : null} onClose={() => setInfoKey(null)} />
    </>
  )
}

// ── Aba Taxas — relatório agregado + lista de pedidos, nomenclatura do painel Shopee ──

// Devolução Fácil: campo real da API (shipping_seller_protection_fee_amount).
// Sync Escrow re-synca os 5000 mais recentes a cada 6h — campo sempre atualizado.
function devolucaoFacil(r: OrderFeeRow): number {
  return r.dev_facil_real > 0 ? r.dev_facil_real : 0
}

function TaxasTab({ rows }: { rows: OrderFeeRow[] }) {
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [infoKey, setInfoKey] = useState<string | null>(null)
  const PAGE = 50

  const filtered = useMemo(() => {
    const q = busca.trim().toUpperCase()
    if (!q) return rows
    return rows.filter((r) => r.order_sn.includes(q))
  }, [rows, busca])

  const totals = useMemo(() => {
    return filtered.reduce(
      (a, r) => {
        a.valor += r.valor
        a.comissao_bruta += r.comissao_bruta
        a.comissao_liq += r.comissao_liq
        a.servico_bruta += r.servico_bruta
        a.servico_liq += r.servico_liq
        a.dev_facil += devolucaoFacil(r)
        // frete líquido do vendedor = real − subsídio − comprador. NÃO floorar em 0:
        // a Shopee soma os negativos (pedidos onde ela subsidia mais que o custo).
        a.frete_vendedor += r.frete_real - r.frete_rebate - r.buyer_ship
        a.renda += r.renda
        a.reembolso += r.reembolso
        if (r.reembolso !== 0) a.com_reembolso++
        if (r.sem_escrow) a.sem_escrow++
        return a
      },
      { valor: 0, comissao_bruta: 0, comissao_liq: 0, servico_bruta: 0, servico_liq: 0, dev_facil: 0, frete_vendedor: 0, renda: 0, reembolso: 0, com_reembolso: 0, sem_escrow: 0 },
    )
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE)

  const resumoCards = [
    { label: 'Subtotal dos Produtos', value: totals.valor, tone: 'text-zinc-50', sub: `${filtered.length} pedidos` },
    { label: 'Valor do Reembolso', value: totals.reembolso, tone: 'text-error', sub: `${totals.com_reembolso} pedidos reembolsados` },
    { label: 'Taxa de comissão líquida', value: -totals.comissao_liq, tone: 'text-error', sub: `bruta R$ ${fmtBrl(totals.comissao_bruta)}` },
    { label: 'Taxa de serviço líquida', value: -totals.servico_liq, tone: 'text-error', sub: `bruta R$ ${fmtBrl(totals.servico_bruta)}` },
    { label: 'Taxa de Devolução Fácil', value: -totals.dev_facil, tone: 'text-error', sub: 'shipping_seller_protection' },
    { label: 'Frete pago pelo vendedor', value: -totals.frete_vendedor, tone: 'text-error', sub: 'real − subsídio − comprador' },
    { label: 'Renda dos pedidos', value: totals.renda, tone: 'text-secondary', sub: 'repasse escrow' },
  ]

  return (
    <div className="flex flex-col gap-lg">
      {/* Resumo do período (respeita filtro de data do topo E busca de pedido) */}
      {busca.trim() && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 -mb-2">
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
          Resumo filtrado pela busca &quot;{busca.trim()}&quot; ({filtered.length} {filtered.length === 1 ? 'pedido' : 'pedidos'})
          <button onClick={() => { setBusca(''); setPage(1) }} className="ml-auto underline hover:text-amber-200">Limpar busca</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-gutter">
        {resumoCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-md">
            <div className="flex items-center gap-1">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">{c.label}</div>
              <InfoButton show={!!TAXAS_INFO[c.label]} label={c.label} onOpen={() => setInfoKey(c.label)} />
            </div>
            <div className={cn('font-h3 text-h3 mt-1', c.tone)}>
              {c.value < 0 ? '−' : ''}{Math.abs(c.value) < 100 ? `R$ ${fmtBrl(Math.abs(c.value))}` : fmtBrlInt(Math.abs(c.value))}
            </div>
            <div className="text-[10px] text-zinc-600 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {totals.sem_escrow > 0 && (
        <div className="text-[11px] text-amber-400/80 -mt-2">
          ⚠ {totals.sem_escrow} pedidos sem escrow sincronizado (Shopee ainda não liberou) — taxas zeradas na lista.
        </div>
      )}

      {/* Busca + tabela */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
        <div className="p-lg border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-h3 text-h3 text-zinc-50">Taxas por Pedido</h3>
          <div className="relative w-[280px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-zinc-500">search</span>
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPage(1); setExpanded(null) }}
              placeholder="Filtrar por código do pedido..."
              className="w-full rounded-lg border border-zinc-800 bg-[#050507] py-2 pl-10 pr-9 font-mono text-xs text-white outline-none transition-colors focus:border-zinc-50/40"
            />
            {busca && (
              <button
                onClick={() => { setBusca(''); setPage(1); setExpanded(null) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-white"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
            <thead className="bg-zinc-900/60">
              <tr>
                <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Pedido</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Data</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Produtos</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Comissão líq.</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Serviço líq.</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Dev. Fácil</th>
                <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Frete vend.</th>
                <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Renda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pageRows.length === 0 && (
                <tr><td colSpan={8} className="px-lg py-10 text-center text-sm text-zinc-500">Nenhum pedido no período/filtro.</td></tr>
              )}
              {pageRows.map((r) => {
                const df = devolucaoFacil(r)
                const freteVend = r.frete_real - r.frete_rebate - r.buyer_ship
                const isOpen = expanded === r.order_sn
                return (
                  <React.Fragment key={r.order_sn}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : r.order_sn)}
                      className={cn('cursor-pointer hover:bg-white/[0.03] transition-colors', isOpen && 'bg-white/[0.04]')}
                    >
                      <td className="px-lg py-2.5 font-mono text-xs text-zinc-200">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn('material-symbols-outlined text-[14px] text-zinc-600 transition-transform', isOpen && 'rotate-90')}>chevron_right</span>
                          {r.order_sn}
                        </span>
                        {r.sem_escrow && <span className="ml-2 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-300">sem escrow</span>}
                      </td>
                      <td className="px-md py-2.5 text-zinc-500 text-xs">{fmtShortDate(r.date_created)}</td>
                      <td className="px-md py-2.5 text-right font-mono-sm text-zinc-200">R$ {fmtBrl(r.valor)}</td>
                      <td className="px-md py-2.5 text-right font-mono-sm text-error">−{fmtBrl(r.comissao_liq)}</td>
                      <td className="px-md py-2.5 text-right font-mono-sm text-error">−{fmtBrl(r.servico_liq)}</td>
                      <td className="px-md py-2.5 text-right font-mono-sm text-error">{df > 0 ? `−${fmtBrl(df)}` : '—'}</td>
                      <td className={cn('px-md py-2.5 text-right font-mono-sm', freteVend >= 0 ? 'text-error' : 'text-secondary')}>{freteVend > 0 ? `−${fmtBrl(freteVend)}` : freteVend < 0 ? `+${fmtBrl(-freteVend)}` : '—'}</td>
                      <td className="px-lg py-2.5 text-right font-mono-sm text-secondary font-semibold">R$ {fmtBrl(r.renda)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-zinc-950/60">
                        <td colSpan={8} className="px-lg py-4">
                          <div className="max-w-[480px] text-sm">
                            <div className="flex justify-between py-1"><span className="font-semibold text-zinc-300">Subtotal dos Produtos</span><span className="font-mono-sm text-zinc-100">R$ {fmtBrl(r.valor)}</span></div>
                            <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Preço do Produto</span><span className="font-mono-sm text-zinc-400">R$ {fmtBrl(r.reembolso !== 0 ? r.preco_produto : r.valor)}</span></div>
                            {r.reembolso !== 0 && (
                              <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Valor do Reembolso</span><span className="font-mono-sm text-error">−R$ {fmtBrl(Math.abs(r.reembolso))}</span></div>
                            )}
                            <div className="flex justify-between py-1 border-t border-zinc-800 mt-1 pt-2"><span className="font-semibold text-zinc-300">Subtotal de Frete</span><span className="font-mono-sm text-zinc-300">R$ {fmtBrl(r.buyer_ship - r.frete_real + r.frete_rebate)}</span></div>
                            <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Taxa de frete paga pelo comprador</span><span className="font-mono-sm text-zinc-400">R$ {fmtBrl(r.buyer_ship)}</span></div>
                            <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Taxa de Frete Paga pela Shopee para Você</span><span className="font-mono-sm text-error">−R$ {fmtBrl(r.frete_real)}</span></div>
                            <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Desconto de frete pago pela Shopee</span><span className="font-mono-sm text-zinc-400">R$ {fmtBrl(r.frete_rebate)}</span></div>
                            <div className="flex justify-between py-1 border-t border-zinc-800 mt-1 pt-2"><span className="font-semibold text-zinc-300">Taxas e Encargos</span><span className="font-mono-sm text-error">−R$ {fmtBrl(r.comissao_liq + r.servico_liq + df)}</span></div>
                            <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Taxa de comissão líquida <span className="text-[10px] text-zinc-600">(bruta R$ {fmtBrl(r.comissao_bruta)})</span></span><span className="font-mono-sm text-error">−R$ {fmtBrl(r.comissao_liq)}</span></div>
                            {df > 0 && <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Taxa de Devolução Fácil Shopee</span><span className="font-mono-sm text-error">−R$ {fmtBrl(df)}</span></div>}
                            <div className="flex justify-between py-1"><span className="text-zinc-500 pl-3">Taxa de serviço líquida <span className="text-[10px] text-zinc-600">(bruta R$ {fmtBrl(r.servico_bruta)})</span></span><span className="font-mono-sm text-error">−R$ {fmtBrl(r.servico_liq)}</span></div>
                            <div className="flex justify-between border-t-2 border-zinc-700 mt-2 pt-2"><span className="font-bold text-zinc-100">Renda do pedido</span><span className="font-mono text-base font-bold text-secondary">R$ {fmtBrl(r.renda)}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-800 px-lg py-3">
          <span className="text-xs text-zinc-500">
            {filtered.length === 0 ? '0 pedidos' : `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, filtered.length)} de ${filtered.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">Anterior</button>
            <span className="px-1 text-xs text-zinc-400">{page}/{totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
              className="rounded border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">Próximo</button>
          </div>
        </div>
      </div>
      <InfoModal info={infoKey ? TAXAS_INFO[infoKey] ?? null : null} onClose={() => setInfoKey(null)} />
    </div>
  )
}
