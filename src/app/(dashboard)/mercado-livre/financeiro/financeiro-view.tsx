'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TopBar } from '@/components/top-bar'
import type { Period } from '@/components/metrics-chart'
import { DateRangePopover, fmtDateBRShort, fmtDateBRFull } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
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
const fmtBrlInt = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => n.toLocaleString('pt-BR')

/** Máscara ao vivo: só dígitos, agrupa milhar com ponto. Ex: "212000" -> "212.000". */
function maskIntBR(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d ? Number(d).toLocaleString('pt-BR') : ''
}

/** Máscara ao vivo decimal pt-BR: milhar com ponto, até 2 casas após a vírgula. Ex: "24612,4" -> "24.612,4". */
function maskDecimalBR(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, '')
  const [intRaw, ...rest] = cleaned.split(',')
  const intDigits = intRaw.replace(/\D/g, '')
  const intFmt = intDigits ? Number(intDigits).toLocaleString('pt-BR') : ''
  if (rest.length === 0) return intFmt // sem vírgula digitada ainda
  const dec = rest.join('').replace(/\D/g, '').slice(0, 2)
  return `${intFmt || '0'},${dec}`
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}


export function FinanceiroView({
  rows,
  paymentMix,
  adsCost,
  afiliadoCost,
  afiliadoVendas,
  afiliadoUnidades,
  billingPeriods,
  defaultFrom,
  defaultTo,
  period,
  customFrom,
  customTo,
}: {
  rows: FinDailyRow[]
  paymentMix: PaymentMixRow[]
  adsCost: number
  afiliadoCost: number
  afiliadoVendas: number
  afiliadoUnidades: number
  billingPeriods: { key: string; from: string; to: string; status: string; rows: { categoria: string; valor: number }[]; total: number }[]
  defaultFrom: string
  defaultTo: string
  period: Period
  customFrom: string | null
  customTo: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [openInfo, setOpenInfo] = useState<string | null>(null)
  const [billingKey, setBillingKey] = useState(billingPeriods[0]?.key ?? '')
  const [billingOpen, setBillingOpen] = useState(false)
  const billingRef = useRef<HTMLDivElement>(null)
  const selBilling = billingPeriods.find((b) => b.key === billingKey) ?? billingPeriods[0] ?? null
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

  useEffect(() => {
    if (!billingOpen) return
    function onDoc(e: MouseEvent) {
      if (billingRef.current && !billingRef.current.contains(e.target as Node)) setBillingOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [billingOpen])

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
  const pedidos = rows.reduce((a, r) => a + r.pedidos, 0)
  const ticket = pedidos > 0 ? faturamento / pedidos : 0
  const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0
  const adsPct = faturamento > 0 ? (ads / faturamento) * 100 : 0

  type MacroSub = { label: string; value: string; sign: string; tone: string; sub: string; info: ReactNode }
  const macroSubs: MacroSub[] = [
    {
      label: 'Faturamento', value: fmtBrlInt(faturamento), sign: '', tone: 'text-on-surface', sub: 'vendas concluídas (líquido)',
      info: (
        <>Vendas do período <span className="text-on-surface">já sem canceladas e devolvidas</span>, por data de fechamento. Bate com o <span className="text-on-surface">&quot;Total de vendas concluídas&quot;</span> do painel do ML (Vendas brutas − Devoluções e cancelamentos). A visão bruta fica na aba Métricas.</>
      ),
    },
    {
      label: 'Comissão', value: fmtBrlInt(comissao), sign: '−', tone: 'text-error', sub: `${comissaoPct.toFixed(1).replace('.', ',')}% do faturamento`,
      info: (
        <>
          Tarifa de venda que o ML cobra, somada item a item das vendas concluídas. Já vem <span className="text-on-surface">líquida do desconto por campanha comercial</span>.
          <br /><br />
          <span className="font-semibold text-on-background">Onde conferir no ML:</span> Vendas → Métricas → aba <span className="text-on-surface">Custos</span> → passe o mouse na barra <span className="text-on-surface">&quot;Tarifas de venda totais&quot;</span> (o hover mostra o R$; a barra só mostra %).
          <br /><br />
          Validado em 16/06–15/07: ML <span className="font-mono text-on-surface">R$ 51.854</span> vs nosso <span className="font-mono text-on-surface">R$ 51.637</span> — <span className="text-secondary">0,4%</span>, que é arredondamento (R$ 0,04 por pedido em ~5 mil pedidos).
        </>
      ),
    },
    {
      label: 'Frete', value: fmtBrlInt(frete), sign: '−', tone: 'text-error', sub: 'custo real (1× por envio)',
      info: (
        <>
          <span className="text-on-surface">Frete = tarifa total de envio − o que o comprador pagou</span>, somado <span className="text-on-surface">1× por envio</span> (um carrinho com vários itens = um frete só).
          <br /><br />
          <span className="font-semibold text-on-background">Conferido contra a fonte de cobrança do ML:</span> comparamos <span className="text-on-surface">todos os 4.715 envios</span> do período com o que o Mercado Livre efetivamente cobrou em cada um. Bateu em <span className="text-secondary">100% deles</span>, centavo a centavo.
          <br /><br />
          <span className="font-semibold text-on-background">Onde conferir no ML:</span> Vendas → Métricas → aba <span className="text-on-surface">Custos</span> → passe o mouse na barra <span className="text-on-surface">&quot;Tarifas de envio&quot;</span>.
          <br /><br />
          Essa tela mostra <span className="text-on-surface">~1% a mais</span> que aqui (ex: 64.960 lá vs 64.429 aqui). Não é erro: ela decompõe bruto e desconto por uma régua própria, que <span className="text-on-surface">diverge da própria API de cobrança do ML</span>. Preferimos bater com o que é cobrado de verdade a imitar a tela.
          <br /><br />
          A <span className="text-on-surface">documentação oficial do ML confirma</span>: não existe API pública equivalente à aba Custos (é métrica interna do painel). Nosso número é o cobrado de verdade — esse ~1% é limite da própria API do ML, não erro nosso.
          <br /><br />
          Diferente da comissão, o frete é contado <span className="text-on-surface">bruto</span>: inclui cancelados e devolvidos, porque o envio <span className="text-on-surface">aconteceu e foi cobrado igual</span> (confirmado envio a envio). O ML só estorna a comissão, não o frete.
          <br /><br />
          Não inclui a <span className="text-tertiary">armazenagem do Full</span> — é custo separado (não frete), aparece na seção <span className="text-on-surface">Tarifas oficiais</span> como <span className="text-on-surface">&quot;Full — Armazenagem&quot;</span>.
        </>
      ),
    },
    {
      label: 'Ads', value: fmtBrlInt(ads), sign: '−', tone: 'text-error', sub: faturamento > 0 ? `${adsPct.toFixed(1).replace('.', ',')}% das vendas` : '—',
      info: (
        <>
          Gasto em <span className="text-on-surface">Product Ads</span> (Mercado Ads) no período, somado dia a dia da API de publicidade do ML.
          <br /><br />
          <span className="font-semibold text-on-background">Onde conferir no ML:</span> Vendas → Métricas → aba <span className="text-on-surface">Custos</span> → hover em <span className="text-on-surface">&quot;Investimento por campanha de publicidade&quot;</span>. Ou Marketing → Publicidade.
          <br /><br />
          Validado em 17/06–16/07: <span className="text-on-surface">painel Mercado Ads</span> e o nosso = <span className="font-mono text-secondary">R$ 20.420,65</span>, igual ao centavo.
          <br /><br />
          A aba <span className="text-on-surface">Custos</span> mostra ~1% a menos (ex: 20.126) por régua interna própria — a <span className="text-on-surface">doc oficial confirma</span> que não há API pública dela. Batemos com o gasto real do Mercado Ads, não com essa tela.
          <br /><br />
          O valor <span className="text-on-surface">se ajusta retroativamente</span> (a atribuição do ML fecha às 10h). Por isso o dia de hoje não entra e números de dias atrás podem mudar alguns reais.
        </>
      ),
    },
  ]

  type Kpi = { label: string; value: string; icon: string; tone: string; info: ReactNode }
  const secondaryKpis: Kpi[] = [
    {
      label: 'Pedidos', value: fmtNum(pedidos), icon: 'receipt_long', tone: 'text-on-surface',
      info: (
        <>
          Pedidos <span className="text-on-surface">concluídos</span> no período (por data de fechamento), já sem cancelados e devolvidos. Packs contam como pedidos separados conforme o ML agrupa.
          <br /><br />
          A contagem <span className="text-on-surface">bruta</span> (com cancelados) fica na aba <span className="text-on-surface">Métricas</span>.
        </>
      ),
    },
    {
      label: 'Ticket Médio', value: `R$ ${fmtBrl(ticket)}`, icon: 'sell', tone: 'text-on-surface',
      info: <>Faturamento ÷ pedidos, ambos já líquidos (sem cancelados e devolvidos). Valor médio de cada venda concluída no período.</>,
    },
    {
      label: '% Comissão', value: `${comissaoPct.toFixed(1).replace('.', ',')}%`, icon: 'pie_chart', tone: 'text-on-surface',
      info: (
        <>
          Comissão ÷ Faturamento — percentual médio que o Mercado Livre fica de cada venda.
          <br /><br />
          <span className="font-semibold text-on-background">Onde conferir no ML:</span> Vendas → Métricas → aba <span className="text-on-surface">Custos</span> → a barra <span className="text-on-surface">&quot;Tarifas de venda totais&quot;</span> mostra o % sobre o total de tarifas (base diferente). Pra comparar direto, divida o R$ das tarifas de venda pelo <span className="text-on-surface">&quot;Total de vendas concluídas&quot;</span>.
        </>
      ),
    },
    {
      label: 'Descontos ao comprador (ML)', value: `R$ ${fmtBrl(cupom)}`, icon: 'redeem', tone: 'text-tertiary',
      info: (
        <>
          Descontos que o <span className="text-on-surface">Mercado Livre bancou</span> pro comprador no checkout (pix, cartão, promoções de pagamento). <span className="text-on-surface">Não é custo seu</span> — você recebe o preço cheio da venda.
          <br /><br />
          É informativo (mostra o quanto o ML impulsionou suas vendas com desconto), <span className="text-on-surface">não entra na margem</span>. Confirmado no pagamento de cada pedido: em 718 vendas, você recebeu o valor integral em todas.
          <br /><br />
          Cupom que sairia do SEU bolso é outra coisa (cupom de vendedor) — nesta janela está zerado.
        </>
      ),
    },
    {
      label: 'Comissão Afiliados', value: `R$ ${fmtBrl(afiliadoCost)}`, icon: 'group', tone: 'text-error',
      info: (
        <>
          Comissão paga aos afiliados/creators do <span className="text-on-surface">Programa de Afiliados do ML</span>, somada venda a venda no período.
          <br /><br />
          {afiliadoVendas > 0 ? (
            <>Geraram <span className="text-on-surface">R$ {fmtBrl(afiliadoVendas)}</span> em vendas · <span className="text-on-surface">{fmtNum(afiliadoUnidades)}</span> unidades.<br /><br /></>
          ) : null}
          <span className="font-semibold text-on-background">Onde conferir no ML:</span> Faturamento → Tarifas e pagamentos → <span className="text-on-surface">&quot;Tarifas do programa de afiliados&quot;</span>.
          <br /><br />
          <span className="text-tertiary">O ML cobra o afiliado com ~2 meses de atraso</span> — a comissão de uma venda só aparece quando entra na fatura. Por isso os períodos mais recentes ficam zerados até o ML faturar.
        </>
      ),
    },
  ]

  const totalMix = paymentMix.reduce((a, m) => a + m.qtd, 0)
  const tableRows = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 31), [rows])

  function infoTip(label: string, info: ReactNode, alignRight?: boolean) {
    const open = openInfo === label
    return (
      <span ref={open ? infoRef : undefined} className="relative inline-flex normal-case">
        <button
          type="button"
          onClick={() => setOpenInfo(open ? null : label)}
          aria-label={`Sobre ${label}`}
          className="flex items-center text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-[15px]">help</span>
        </button>
        {open && (
          <div className={cn(
            'absolute top-full z-50 mt-2 w-[300px] rounded-xl border border-white/10 bg-[#0d1117] p-4 text-left shadow-2xl shadow-black/60',
            alignRight ? 'right-0' : 'left-0',
          )}>
            <p className="mb-2 text-sm font-semibold text-on-surface">{label}</p>
            <p className="text-xs leading-relaxed text-on-surface-variant tracking-normal">{info}</p>
          </div>
        )}
      </span>
    )
  }

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
              Vendas concluídas (sem canceladas e devolvidas) − comissão − frete − ads. A visão bruta fica em Métricas.
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

        {/* Margem de Contribuição Macro — hero (espelha o Lucro Bruto Macro da Shopee) */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.03) 50%, rgba(248,113,113,0.04))',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '14px',
            padding: '20px 24px',
          }}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-on-surface-variant font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-secondary">savings</span>
                Margem de Contribuição — Mercado Livre
              </div>
              <div className={cn('font-h1 text-h1 mt-2', margem >= 0 ? 'text-secondary' : 'text-error')}>
                {margem >= 0 ? '+' : ''}{fmtBrlInt(margem)}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                Faturamento − Comissão − Frete − Ads · margem {margemPct.toFixed(1).replace('.', ',')}%
              </div>
              <div className="text-[10px] text-on-surface-variant/70 mt-1">
                Métrica <span className="text-on-surface-variant">gerencial</span>, não é o &quot;Você recebeu&quot; do ML. Fica acima dele porque não desconta as tarifas menores que o ML só fatura por ciclo mensal (outras tarifas, custos do Full, tarifa de devolução) nem o custo do produto (COGS). A doc oficial confirma: essas tarifas só existem no billing mensal, não há líquido diário na API pública do ML — o &quot;Você recebeu&quot; carregado por dia é impossível de reproduzir.
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full lg:w-auto lg:min-w-[600px]">
              {macroSubs.map((s, i) => {
                const open = openInfo === s.label
                const alignRight = i >= macroSubs.length - 2
                return (
                  <div
                    key={s.label}
                    className={cn('rounded-lg border border-white/10 bg-surface-container/60 p-md relative', open && 'z-50')}
                  >
                    <div className="text-[9px] text-on-surface-variant uppercase tracking-wider font-semibold flex items-center gap-1">
                      {s.label}
                      {infoTip(s.label, s.info, alignRight)}
                    </div>
                    <div className={cn('font-h3 text-h3 mt-1', s.tone)}>{s.sign}{s.value}</div>
                    <div className="text-[10px] text-on-surface-variant/70 mt-0.5">{s.sub}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-gutter">
          {secondaryKpis.map((kpi, i) => {
            const open = openInfo === kpi.label
            const alignRight = i >= secondaryKpis.length - 2
            return (
              <div
                key={kpi.label}
                className={cn(
                  'bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-2 relative hover:bg-surface-container/90 transition-colors',
                  open && 'z-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                    {kpi.label}
                    {infoTip(kpi.label, kpi.info, alignRight)}
                  </span>
                  <span className={cn('material-symbols-outlined text-lg', kpi.tone)}>{kpi.icon}</span>
                </div>
                <div className={cn('font-h2 text-h2', kpi.tone)}>{kpi.value}</div>
              </div>
            )
          })}
        </div>

        {paymentMix.length > 0 && (
          <div className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 p-lg flex flex-col gap-4">
            <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-1.5">
              Formas de Pagamento
              {infoTip('formas-pagamento', (
                <>
                  Distribuição dos pedidos concluídos por método de pagamento do comprador. Cada pedido conta 1× (pelo método dominante); a soma dos valores = faturamento e a soma das quantidades = pedidos.
                  <br /><br />
                  <span className="text-on-surface">Sem espelho oficial pra conferir:</span> forma de pagamento é conceito do Mercado Pago (nível conta) — a doc confirma que o ML não expõe esse breakdown por método/período pro vendedor. É informativo (&quot;como seus compradores pagam&quot;), validado pela consistência interna.
                </>
              ), true)}
            </h3>
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

        {selBilling && (
          <div className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 p-lg flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-h3 text-h3 text-on-surface flex items-center gap-1.5">
                  Tarifas oficiais — Faturamento ML
                  {infoTip('billing-oficial', (
                    <>
                      Vem direto do relatório de faturamento do ML — <span className="text-on-surface">100% oficial</span>, bate ao centavo com <span className="text-on-surface">Faturamento → Tarifas e pagamentos</span>. Organizado por ciclo mensal de fatura.
                      <br /><br />
                      <span className="font-semibold text-on-background">Ciclo &quot;aberto&quot; é parcial.</span> Enquanto o ciclo não fecha, o ML vai <span className="text-on-surface">somando as cobranças ao longo do dia</span> — o valor aqui é uma foto do último sync (a cada 12h) e fica um pouco atrás da tela ao vivo do ML. Isso é normal: a API de faturamento do ML não é tempo real.
                      <br /><br />
                      Quando o ciclo <span className="text-on-surface">fecha</span>, o valor congela e bate <span className="text-secondary">exato</span> com o ML (validado grupo a grupo).
                    </>
                  ), true)}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Direto do relatório de faturamento do ML (100% oficial, bate com <span className="text-on-surface">Faturamento → Tarifas e pagamentos</span>). Mensal por ciclo de fatura.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div ref={billingRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBillingOpen((v) => !v)}
                    className={cn(
                      'flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                      billingOpen
                        ? 'border-primary/40 bg-primary-container/60 text-on-primary-container'
                        : 'border-white/10 bg-surface-container-high/50 text-on-surface hover:bg-surface-container-high/80',
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_month</span>
                    <span>{fmtDateBRShort(selBilling.from)} – {fmtDateBRShort(selBilling.to)}</span>
                    {selBilling.status !== 'CLOSED' && (
                      <span className="rounded-full bg-tertiary/15 px-1.5 py-0.5 text-[10px] font-semibold text-tertiary">aberto</span>
                    )}
                    <span className={cn('material-symbols-outlined text-[16px] text-on-surface-variant transition-transform', billingOpen && 'rotate-180')}>expand_more</span>
                  </button>
                  {billingOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] p-1 shadow-2xl shadow-black/60">
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">Ciclo de fatura</div>
                      {billingPeriods.map((b) => {
                        const active = b.key === billingKey
                        return (
                          <button
                            key={b.key}
                            type="button"
                            onClick={() => { setBillingKey(b.key); setBillingOpen(false) }}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                              active ? 'bg-primary-container/70 text-on-primary-container' : 'text-on-surface hover:bg-white/5',
                            )}
                          >
                            <span>{fmtDateBRShort(b.from)} – {fmtDateBRShort(b.to)}</span>
                            {b.status !== 'CLOSED'
                              ? <span className="text-[10px] font-semibold text-tertiary">aberto</span>
                              : active && <span className="material-symbols-outlined text-[16px]">check</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total de tarifas</div>
                  <div className="font-h3 text-h3 text-error">R$ {fmtBrl(selBilling.total)}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {selBilling.rows.map((b) => (
                <div key={b.categoria} className="rounded-lg border border-white/10 bg-surface-container/60 p-md">
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">{b.categoria}</div>
                  <div className={cn('font-h3 text-h3 mt-1', b.valor < 0 ? 'text-secondary' : 'text-error')}>
                    {b.valor < 0 ? '+' : '−'}R$ {fmtBrl(Math.abs(b.valor))}
                  </div>
                </div>
              ))}
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
                  <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">Desc. ML</th>
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
