'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TopBar } from '@/components/top-bar'
import type { Period } from '@/components/metrics-chart'
import { DateRangePopover, fmtDateBRShort, fmtDateBRFull } from '@/components/date-range-popover'
import { saveMlAffiliateData, deleteMlAffiliateEntry, type AffiliateEntry } from '@/app/actions/mercadolivre'
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

function AffiliateModal({
  defaultFrom,
  defaultTo,
  entries,
  onClose,
}: {
  defaultFrom: string
  defaultTo: string
  entries: AffiliateEntry[]
  onClose: () => void
}) {
  const router = useRouter()
  const [saving, startSaving] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [affiliatesCount, setAffiliatesCount] = useState('')
  const [soldAmount, setSoldAmount] = useState('')
  const [soldUnits, setSoldUnits] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')

  const parseNum = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0
  const parseInt2 = (s: string) => Math.round(parseNum(s))
  const intToInput = (n: number) => (n ? maskIntBR(String(n)) : '')
  const decToInput = (n: number) => (n ? fmtBrl(n) : '')

  function resetForm() {
    setEditingId(null)
    setFrom(defaultFrom)
    setTo(defaultTo)
    setAffiliatesCount('')
    setSoldAmount('')
    setSoldUnits('')
    setEstimatedCost('')
    setErr(null)
  }

  function editEntry(e: AffiliateEntry) {
    setEditingId(e.id)
    setFrom(e.date_from)
    setTo(e.date_to)
    setAffiliatesCount(intToInput(e.affiliates_count))
    setSoldAmount(decToInput(e.sold_amount))
    setSoldUnits(intToInput(e.sold_units))
    setEstimatedCost(decToInput(e.estimated_cost))
    setErr(null)
  }

  function save() {
    setErr(null)
    startSaving(async () => {
      const res = await saveMlAffiliateData({
        id: editingId ?? undefined,
        from,
        to,
        affiliatesCount: parseInt2(affiliatesCount),
        soldAmount: parseNum(soldAmount),
        soldUnits: parseInt2(soldUnits),
        estimatedCost: parseNum(estimatedCost),
      })
      if (res.ok) {
        resetForm()
        router.refresh()
      } else {
        setErr(res.error ?? 'Erro ao salvar')
      }
    })
  }

  function removeEntry(id: string) {
    setErr(null)
    setBusyId(id)
    startSaving(async () => {
      const res = await deleteMlAffiliateEntry(id)
      setBusyId(null)
      if (res.ok) {
        if (editingId === id) resetForm()
        router.refresh()
      } else {
        setErr(res.error ?? 'Erro ao remover')
      }
    })
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#050507] px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary'

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div style={{ width: 'min(460px, 92vw)' }} className={cn('max-h-[90vh] rounded-2xl border border-white/10 bg-[#0d1117] p-6', pickerOpen ? 'overflow-visible' : 'overflow-y-auto')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-on-surface">{editingId ? 'Editar registro' : 'Dados de Afiliados'}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-on-surface-variant hover:bg-white/10 hover:text-on-surface">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <p className="mb-4 text-xs text-on-surface-variant">
          Lançamento manual — o ML não expõe afiliados por API. Copie do painel <span className="text-on-surface">Venda com afiliados → Métricas de afiliados</span>. O card agrega os registros na proporção do período filtrado.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Período
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className={`${inputCls} flex items-center justify-between text-left`}
              >
                <span className="text-on-surface">{fmtDateBRFull(from)} <span className="text-on-surface-variant">—</span> {fmtDateBRFull(to)}</span>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">calendar_month</span>
              </button>
              {pickerOpen && (
                <DateRangePopover
                  from={from}
                  to={to}
                  align="left"
                  onApply={(f, t) => {
                    setFrom(f)
                    setTo(t)
                    setPickerOpen(false)
                  }}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Afiliados
            <input type="text" inputMode="numeric" value={affiliatesCount} onChange={(e) => setAffiliatesCount(maskIntBR(e.target.value))} placeholder="0" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Vendas (R$)
            <input type="text" inputMode="decimal" value={soldAmount} onChange={(e) => setSoldAmount(maskDecimalBR(e.target.value))} placeholder="0,00" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Unidades vendidas
            <input type="text" inputMode="numeric" value={soldUnits} onChange={(e) => setSoldUnits(maskIntBR(e.target.value))} placeholder="0" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
            Custo estimado (R$)
            <input type="text" inputMode="decimal" value={estimatedCost} onChange={(e) => setEstimatedCost(maskDecimalBR(e.target.value))} placeholder="0,00" className={inputCls} />
          </label>
        </div>
        {err && <p className="mt-2 text-xs text-error">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => (editingId ? resetForm() : onClose())}
            className="rounded-lg px-4 py-2 text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
          >
            {editingId ? 'Cancelar edição' : 'Fechar'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : editingId ? 'Atualizar registro' : 'Adicionar registro'}
          </button>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Registros ({entries.length})
          </p>
          {entries.length === 0 ? (
            <p className="text-xs text-on-surface-variant/70">Nenhum registro lançado ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((e) => {
                const isEditing = editingId === e.id
                return (
                  <div
                    key={e.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2',
                      isEditing ? 'border-primary/40 bg-primary/5' : 'border-white/10 bg-[#050507]',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-on-surface">
                        {fmtDateBRShort(e.date_from)} — {fmtDateBRShort(e.date_to)}
                        <span className="ml-2 font-mono text-error">R$ {fmtBrl(e.estimated_cost)}</span>
                      </p>
                      <p className="truncate text-[11px] text-on-surface-variant">
                        R$ {fmtBrl(e.sold_amount)} em vendas · {e.sold_units} un · {e.affiliates_count} afiliados
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => editEntry(e)}
                        className="rounded-md p-1.5 text-on-surface-variant hover:bg-white/10 hover:text-primary"
                        aria-label="Editar"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEntry(e.id)}
                        disabled={busyId === e.id}
                        className="rounded-md p-1.5 text-on-surface-variant hover:bg-white/10 hover:text-error disabled:opacity-50"
                        aria-label="Remover"
                      >
                        <span className="material-symbols-outlined text-[18px]">{busyId === e.id ? 'hourglass_empty' : 'delete'}</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function FinanceiroView({
  rows,
  paymentMix,
  adsCost,
  afiliadoCost,
  afiliadoVendas,
  afiliadoUnidades,
  afiliadoCount,
  affiliateEntries,
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
  afiliadoCount: number
  affiliateEntries: AffiliateEntry[]
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
  const [affiliateModal, setAffiliateModal] = useState(false)
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

  type MacroSub = { label: string; value: string; sign: string; tone: string; sub: string; info: ReactNode; action?: 'affiliate' }
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
          Essa tela mostra <span className="text-on-surface">~0,8% a mais</span> que aqui (ex: 64.960 lá vs 64.429 aqui). Não é erro: ela decompõe bruto e desconto por uma régua própria, que <span className="text-on-surface">diverge da própria API de cobrança do ML</span>. Preferimos bater com o que é cobrado de verdade a imitar a tela.
          <br /><br />
          Diferente da comissão, o frete é contado <span className="text-on-surface">bruto</span>: inclui cancelados e devolvidos, porque o envio <span className="text-on-surface">aconteceu e foi cobrado igual</span> (confirmado envio a envio). O ML só estorna a comissão, não o frete.
          <br /><br />
          Não inclui os <span className="text-tertiary">Custos do Mercado Envios Full</span> (armazenagem) — é uma linha separada no ML e ainda não está no painel.
        </>
      ),
    },
    {
      label: 'Ads', value: fmtBrlInt(ads), sign: '−', tone: 'text-error', sub: faturamento > 0 ? `${adsPct.toFixed(1).replace('.', ',')}% das vendas` : '—',
      info: (
        <>Gasto em <span className="text-on-surface">Product Ads</span> (Mercado Ads) no período, somado do campo <span className="font-mono">cost</span> de todas as campanhas. Sincronizado 1×/dia da API de publicidade do ML.</>
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
      label: 'Cupons / Descontos', value: `R$ ${fmtBrl(cupom)}`, icon: 'redeem', tone: 'text-tertiary',
      info: (
        <>
          Descontos aplicados nas vendas concluídas (cupons do ML ou do vendedor). Reduz o que o comprador efetivamente pagou.
          <br /><br />
          <span className="text-tertiary">Ainda não conferido contra o painel do ML</span> — o ML não expõe um total de cupons por período nas telas de métricas.
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
      {affiliateModal && (
        <AffiliateModal defaultFrom={defaultFrom} defaultTo={defaultTo} entries={affiliateEntries} onClose={() => setAffiliateModal(false)} />
      )}
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
                Base: vendas concluídas. Não inclui custo do produto (COGS), outras tarifas do ML nem o repasse do Mercado Pago (antecipação, parcelamento) — por isso fica acima do &quot;Você recebeu&quot; do ML.
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
                    {s.action === 'affiliate' && (
                      <button
                        type="button"
                        onClick={() => setAffiliateModal(true)}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[12px]">edit</span> Preencher
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
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

        {selBilling && (
          <div className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 p-lg flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-h3 text-h3 text-on-surface">Tarifas oficiais — Faturamento ML</h3>
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
