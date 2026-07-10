'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { TopBar } from '@/components/top-bar'
import { MetricsChart, type MetricsChartData, type Period } from '@/components/metrics-chart'
import { DateRangePopover, fmtDateBRShort } from '@/components/date-range-popover'
import { cn } from '@/lib/utils'
import type { ShopeeDailyMetric } from '@/types'

type PeriodKey = Period

const periods: { key: PeriodKey; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBrlInt = (n: number) =>
  `R$ ${Math.round(n).toLocaleString('pt-BR')}`
const fmtNum = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const fmtRoas = (n: number) => `${n.toFixed(2).replace('.', ',')}x`
const fmtShortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const sum = (arr: ShopeeDailyMetric[], key: keyof ShopeeDailyMetric) =>
  arr.reduce((a, x) => a + (Number(x[key]) || 0), 0)

const avg = (arr: ShopeeDailyMetric[], key: keyof ShopeeDailyMetric) => {
  const valid = arr.filter((x) => x[key] !== null && x[key] !== undefined)
  if (valid.length === 0) return 0
  return valid.reduce((a, x) => a + Number(x[key]), 0) / valid.length
}

// Repasse real Shopee (escrow). Fallback pro estimado quando net_real ausente (dias antigos).
const lucroReal = (r: ShopeeDailyMetric): number => {
  const net = r.net_revenue_cents ? Number(r.net_revenue_cents) / 100 : 0
  return net > 0 ? net : Number(r.gross_profit) || 0
}

const sumLucroReal = (arr: ShopeeDailyMetric[]): number =>
  arr.reduce((a, r) => a + lucroReal(r), 0)

const margemReal = (r: ShopeeDailyMetric): number | null => {
  const gross = Number(r.gross_revenue) || 0
  if (gross <= 0) return null
  return (lucroReal(r) / gross) * 100
}

const avgMargemReal = (arr: ShopeeDailyMetric[]): number => {
  const vals = arr.map(margemReal).filter((v): v is number => v !== null)
  if (vals.length === 0) return 0
  return vals.reduce((a, v) => a + v, 0) / vals.length
}

type Trend = 'up' | 'down' | 'flat'

// Explicações dos cards — o que é + de onde vem + por que pode diferir do painel Shopee
const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; difere?: string }> = {
  'Faturamento': {
    title: 'Faturamento',
    oQueE: 'Soma do valor pago pelos compradores em pedidos confirmados do período. Inclui frete pago pelo comprador e já vem líquido de cupons subsidiados pela Shopee.',
    origem: 'Campo "valor total do pedido" que a API oficial da Shopee retorna em cada pedido, somado por dia (data de criação, fuso Brasil). Sincronizado em tempo real via webhook + reconciliação automática.',
    difere: 'A Shopee tem DOIS funis nas Informações Gerenciais e nós temos TRÊS modos no botão Funil — case cada um antes de comparar:\n\n• Modo "Pedido Feito (Shopee)" ↔ funil "Pedido Feito" da Shopee: a QUANTIDADE de pedidos bate 100% exato (todo pedido criado, inclusive Pix gerado e nunca pago). A receita fica ~1-2% abaixo: a Shopee mostra o valor "cheio" da venda; nosso número é o valor real do pedido (o total que o comprador pagou). É diferença de definição, não de dado faltando.\n\n• Modo "Produto Pago (Shopee)" ↔ funil "Produto Pago" da Shopee: aproxima mas NÃO fica exato. A Shopee conta só os cancelamentos que chegaram a pagar; nós incluímos todos os cancelados porque a API não devolve a hora do pagamento por pedido — não dá pra separar quem cancelou antes de quem cancelou depois de pagar. Por isso nosso número fica um pouco acima do "Produto Pago" deles.\n\n• Modo "Padrão" (nosso): o mais conservador — tira TODO cancelado e todo não-pago. Sempre menor que os dois funis da Shopee. É a receita que efetivamente vira repasse.\n\nEm qualquer comparação, use o MESMO período dos dois lados (o botão "30d" aqui termina hoje, que ainda está incompleto).',
  },
  'Pedidos': {
    title: 'Pedidos',
    oQueE: 'Quantidade de pedidos do período. O botão Funil escolhe o critério: Padrão (só válidos), Produto Pago ou Pedido Feito.',
    origem: 'Contagem dos pedidos retornados pela API oficial da Shopee, por status e data de criação.',
    difere: 'Para bater 100% exato com a Shopee, ponha o Funil em "Pedido Feito (Shopee)" e compare com o funil "Pedido Feito" das Informações Gerenciais — esse modo conta todo pedido criado, inclusive Pix nunca pago. O modo "Produto Pago" fica um pouco acima do funil equivalente da Shopee porque incluímos todos os cancelados (a API não expõe a hora do pagamento, então não dá pra separar cancelado-antes de cancelado-depois de pagar). O modo Padrão exclui todos os cancelados e é sempre o menor.',
  },
  'Ticket Médio': {
    title: 'Ticket Médio',
    oQueE: 'Faturamento dividido pelo número de pedidos do período.',
    origem: 'Calculado: Faturamento ÷ Pedidos (mesmas fontes dos dois cards).',
    difere: 'Herda as diferenças dos dois cards acima. Próximo do "Vendas por Comprador" da Shopee, mas lá o divisor é compradores únicos, não pedidos.',
  },
  'Cancelamentos': {
    title: 'Cancelamentos',
    oQueE: 'Percentual de pedidos cancelados sobre o total criado no período. Inclui cancelamentos do comprador, do vendedor e do antifraude.',
    origem: 'Campo "status" que a API da Shopee retorna em cada pedido (cancelado / em cancelamento). O número pequeno abaixo mostra a contagem absoluta.',
    difere: 'Nosso número é MAIOR que o "Pedidos Cancelados" das Informações Gerenciais: contamos TODOS os cancelamentos (inclusive de pedidos que nunca chegaram a pagar); a Shopee só conta cancelamentos de pedidos pagos. Ex: 165 aqui vs 78 lá — os ~87 extras desistiram antes de pagar.',
  },
  'Gasto em Ads': {
    title: 'Gasto em Ads',
    oQueE: 'Total investido em Shopee Ads no período (todas as campanhas: manual, GMV Max, etc). Validado 1:1 com a Central de Ads da Shopee.',
    origem: 'Campo "despesa" do relatório diário de performance de anúncios que a API de Ads da Shopee retorna — o mesmo número da Central de Ads. Atualizado de hora em hora.',
  },
  'Comissão Afiliados': {
    title: 'Comissão Afiliados',
    oQueE: 'Comissão estimada paga aos afiliados/influenciadores do programa de Afiliados do Vendedor. Limitação da Shopee: ela só entrega o acumulado dos últimos 7 ou 30 dias — não dia a dia. O valor mostrado é o snapshot que melhor cobre o período filtrado.',
    origem: 'Campo "comissão estimada" por afiliado, retornado pela API de Marketing de Afiliados da Shopee (app dedicado aprovado por eles). Corresponde à "Taxa de comissão Afiliados do Vendedor" do Relatório de Renda.',
  },
  'Frete Vendedor': {
    title: 'Frete Vendedor',
    oQueE: 'Frete que efetivamente sai do bolso do vendedor: frete real da transportadora MENOS o subsídio da Shopee MENOS a parte paga pelo comprador. Normalmente fica perto de zero — a sobra vem de discrepâncias de peso (frete real maior que o declarado). O custo do programa Frete Grátis NÃO está aqui: ele é cobrado dentro da Taxa de Serviço.',
    origem: 'Três campos do extrato financeiro (escrow) que a Shopee retorna por pedido: frete real cobrado, subsídio da Shopee e frete pago pelo comprador. Mesma fonte da tela "Minha Renda". Validado vs "Subtotal de Envio" do Relatório de Renda.',
  },
  'Taxas Shopee': {
    title: 'Taxas Shopee',
    oQueE: 'Comissão + Taxa de Serviço brutas cobradas pela Shopee em cada pedido. A Taxa de Serviço inclui o custo do programa Frete Grátis (é assim que a Shopee cobra o subsídio de frete) e a taxa de transação. O % é calculado sobre as vendas de produto (preço de venda, sem frete/cupons). Parte dessas taxas volta como desconto quando a loja participa de campanhas ("Ajuste por Participação em Ação Comercial") — veja a taxa líquida no Financeiro.',
    origem: 'Campos "taxa de comissão" e "taxa de serviço" do extrato financeiro (escrow) que a Shopee retorna por pedido — mesma fonte da tela "Minha Renda". Validado 99%+ vs Relatório de Renda oficial.',
  },
  'Repasse Liberado': {
    title: 'Repasse Liberado',
    oQueE: 'Dinheiro que a Shopee retém por pedido (escrow) e libera quando o pedido conclui — quanto efetivamente caiu na sua carteira no período. É o repasse real, não o depósito bancário consolidado (a Shopee não expõe esse no BR).',
    origem: 'Transações do tipo escrow liberado (ESCROW_VERIFIED_ADD) no extrato da carteira Shopee Pay, somadas por data.',
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
            <span className="material-symbols-outlined text-[18px] text-primary">help</span>
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
          {info.difere && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Por que pode diferir do painel Shopee</div>
              <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{info.difere}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Configurações da tela (engrenagem) — persistem em localStorage ──
// 'padrao' = só pedidos válidos (excl. cancelados + nunca pagos)
// 'produto_pago' = + cancelados que chegaram a pagar (funil "Produto Pago" da Shopee)
// 'pedido_feito' = todos os pedidos feitos, inclusive nunca pagos (funil "Pedido Feito" da Shopee)
type FunilCriterio = 'padrao' | 'produto_pago' | 'pedido_feito'
type MetricasConfig = { criterio: FunilCriterio }
const CONFIG_KEY = 'shopee-metricas-config'
const DEFAULT_CONFIG: MetricasConfig = { criterio: 'padrao' }

function loadConfigLegacy(raw: unknown): MetricasConfig {
  // migra config antiga (booleana) sem quebrar quem já tinha salvo
  if (raw && typeof raw === 'object' && 'incluirCancelados' in raw) {
    return { criterio: (raw as { incluirCancelados: boolean }).incluirCancelados ? 'produto_pago' : 'padrao' }
  }
  return { ...DEFAULT_CONFIG, ...(raw as object ?? {}) }
}

function loadConfig(): MetricasConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    return loadConfigLegacy(JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}'))
  } catch {
    return DEFAULT_CONFIG
  }
}

function ConfigModal({ open, config, onSave, onClose }: {
  open: boolean
  config: MetricasConfig
  onSave: (c: MetricasConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(config)
  useEffect(() => { if (open) setDraft(config) }, [open, config])
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[460px] rounded-2xl border border-zinc-700 shadow-2xl" style={{ background: 'rgba(22,27,34,0.97)' }}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-zinc-400">filter_alt</span>
            Funil de Pedidos
          </h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {([
            {
              value: 'padrao' as const,
              titulo: 'Padrão (conservador)',
              desc: 'Só pedidos válidos: exclui cancelados e nunca pagos. A receita que realmente vira repasse.',
            },
            {
              value: 'produto_pago' as const,
              titulo: 'Produto Pago (Shopee)',
              desc: 'Inclui pedidos pagos que cancelaram depois — igual ao funil "Produto Pago" das Informações Gerenciais (~99,7% de match).',
            },
            {
              value: 'pedido_feito' as const,
              titulo: 'Pedido Feito (Shopee)',
              desc: 'Todos os pedidos feitos, inclusive os nunca pagos (Pix gerado e abandonado) — igual ao funil "Pedido Feito" das Informações Gerenciais (contagem 100% exata).',
            },
          ]).map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="funil-criterio"
                checked={draft.criterio === opt.value}
                onChange={() => setDraft({ criterio: opt.value })}
                className="mt-1 h-4 w-4 accent-emerald-400 cursor-pointer"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-200 group-hover:text-white">{opt.titulo}</span>
                <span className="block text-xs text-zinc-500 mt-1 leading-relaxed">{opt.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={() => { onSave(draft); onClose() }}
            className="rounded-lg bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoButton({ label, onOpen }: { label: string; onOpen: (k: string) => void }) {
  if (!KPI_INFO[label]) return null
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

function deltaPct(curr: number, prev: number): { delta: string; trend: Trend } {
  if (prev === 0) return { delta: '—', trend: 'flat' }
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return { delta: '0,0%', trend: 'flat' }
  return {
    delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`,
    trend: pct >= 0 ? 'up' : 'down',
  }
}

type MargemTone = 'great' | 'good' | 'warn' | 'bad'
function toneFor(pct: number | null): MargemTone {
  if (pct === null) return 'bad'
  if (pct >= 30) return 'great'
  if (pct >= 20) return 'good'
  if (pct >= 10) return 'warn'
  return 'bad'
}

const margemBadge: Record<MargemTone, string> = {
  great: 'bg-secondary/10 text-secondary border border-secondary/20',
  good: 'bg-primary/10 text-primary-fixed border border-primary/20',
  warn: 'bg-tertiary/10 text-zinc-50-fixed border border-tertiary/20',
  bad: 'bg-error/10 text-error border border-error/20',
}

function buildChartData(
  period: PeriodKey,
  current: ShopeeDailyMetric[],
  previous: ShopeeDailyMetric[],
  customFrom: string | null,
  customTo: string | null,
): MetricsChartData {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let len: number
  let startCurrent: Date
  if (customFrom && customTo) {
    const [fy, fm, fd] = customFrom.split('-').map(Number)
    const [ty, tm, td] = customTo.split('-').map(Number)
    const f = new Date(fy, fm - 1, fd)
    const t = new Date(ty, tm - 1, td)
    startCurrent = f
    len = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1)
  } else if (period === 'mes') {
    len = today.getDate()
    startCurrent = new Date(today.getFullYear(), today.getMonth(), 1)
  } else {
    len = period === '7d' ? 7 : period === '90d' ? 90 : 30
    startCurrent = new Date(today)
    startCurrent.setDate(today.getDate() - len + 1)
  }

  const startPrev = new Date(startCurrent)
  startPrev.setDate(startPrev.getDate() - len)

  const curMap = new Map(current.map((r) => [r.date, r]))
  const prevMap = new Map(previous.map((r) => [r.date, r]))

  const dates: Date[] = []
  const cur = { faturamento: [] as number[], pedidos: [] as number[], lucro: [] as number[] }
  const prev = { faturamento: [] as number[], pedidos: [] as number[], lucro: [] as number[] }

  for (let i = 0; i < len; i++) {
    const d = new Date(startCurrent)
    d.setDate(d.getDate() + i)
    dates.push(d)

    const curKey = d.toISOString().slice(0, 10)
    const cRow = curMap.get(curKey)
    cur.faturamento.push(cRow ? Number(cRow.gross_revenue) || 0 : 0)
    cur.pedidos.push(cRow ? Number(cRow.orders_count) || 0 : 0)
    cur.lucro.push(cRow ? lucroReal(cRow) : 0)

    const dPrev = new Date(startPrev)
    dPrev.setDate(dPrev.getDate() + i)
    const prevKey = dPrev.toISOString().slice(0, 10)
    const pRow = prevMap.get(prevKey)
    prev.faturamento.push(pRow ? Number(pRow.gross_revenue) || 0 : 0)
    prev.pedidos.push(pRow ? Number(pRow.orders_count) || 0 : 0)
    prev.lucro.push(pRow ? lucroReal(pRow) : 0)
  }

  return { dates, current: cur, previous: prev }
}

function buildDistribution(rows: ShopeeDailyMetric[]) {
  const buckets = { great: 0, good: 0, warn: 0, low: 0, loss: 0 }
  rows.forEach((r) => {
    const m = margemReal(r)
    if (m === null) return
    if (m > 30) buckets.great++
    else if (m >= 20) buckets.good++
    else if (m >= 10) buckets.warn++
    else if (m >= 0) buckets.low++
    else buckets.loss++
  })
  const total = buckets.great + buckets.good + buckets.warn + buckets.low + buckets.loss
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
  return [
    { label: 'Excelente (> 30%)', percent: pct(buckets.great), color: 'bg-primary-fixed', count: buckets.great },
    { label: 'Boa (20% - 30%)',   percent: pct(buckets.good),  color: 'bg-secondary',     count: buckets.good },
    { label: 'Média (10% - 20%)', percent: pct(buckets.warn),  color: 'bg-tertiary',      count: buckets.warn },
    { label: 'Baixa (0% - 10%)',  percent: pct(buckets.low),   color: 'bg-error-container', count: buckets.low },
    { label: 'Prejuízo (< 0%)',   percent: pct(buckets.loss),  color: 'bg-error',         count: buckets.loss },
  ]
}

function EmptyDataState({ nickname }: { nickname: string | null }) {
  return (
    <div className="flex flex-col items-center gap-md rounded-xl border border-zinc-800 bg-zinc-900/40 p-xl text-center">
      <span className="material-symbols-outlined text-3xl text-zinc-50">hourglass_empty</span>
      <h3 className="text-h3 font-semibold text-zinc-50">Sem métricas no período</h3>
      <p className="max-w-md text-sm text-zinc-400">
        {nickname ? `Conta ${nickname} conectada.` : ''} Aguardando próxima execução do workflow{' '}
        <span className="font-mono text-zinc-50">Shopee — Métricas Diárias</span> (cron 03h BRT).
      </p>
    </div>
  )
}

export function MetricasView({
  current,
  previous,
  period,
  customFrom,
  customTo,
  repasseCur,
  repassePrev,
  comissaoAfiliadosCur,
  comissaoAfiliadosPrev,
  nickname,
}: {
  current: ShopeeDailyMetric[]
  previous: ShopeeDailyMetric[]
  period: PeriodKey
  customFrom: string | null
  customTo: string | null
  repasseCur: number
  repassePrev: number
  comissaoAfiliadosCur: number
  comissaoAfiliadosPrev: number
  nickname: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [infoKey, setInfoKey] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [config, setConfig] = useState<MetricasConfig>(DEFAULT_CONFIG)
  useEffect(() => { setConfig(loadConfig()) }, [])
  function saveConfig(c: MetricasConfig) {
    setConfig(c)
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  }
  const popoverRef = useRef<HTMLDivElement>(null)
  const isCustom = !!(customFrom && customTo)

  useEffect(() => {
    if (!popoverOpen) return
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [popoverOpen])

  function setPeriod(p: PeriodKey) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('period', p)
    sp.delete('from')
    sp.delete('to')
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false })
    })
  }

  function applyCustomRange(fromIso: string, toIso: string) {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('period')
    sp.set('from', fromIso)
    sp.set('to', toIso)
    setPopoverOpen(false)
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false })
    })
  }

  const sumCents = (arr: ShopeeDailyMetric[], key: keyof ShopeeDailyMetric): number =>
    arr.reduce((a, x) => a + (Number(x[key]) || 0), 0) / 100

  // Funil: 3 critérios de contagem, o padrão é o mais conservador (só pedidos válidos)
  const incl = config.criterio !== 'padrao'
  const faturamentoField = config.criterio === 'pedido_feito' ? 'gross_revenue_all'
    : config.criterio === 'produto_pago' ? 'gross_revenue_incl_cancel'
    : 'gross_revenue'
  const pedidosField = config.criterio === 'pedido_feito' ? 'orders_count_all'
    : config.criterio === 'produto_pago' ? 'orders_count_incl_cancel'
    : 'orders_count'
  const faturamento = sum(current, faturamentoField) || sum(current, 'gross_revenue')
  // Base correta pra % de taxa: preço de venda dos produtos (sem frete/vouchers Shopee)
  const vendasProduto = sum(current, 'total_product_sales') || faturamento
  const pedidos = sum(current, pedidosField) || sum(current, 'orders_count')
  const totalComissao = sum(current, 'total_commission')
  const totalFrete = sum(current, 'total_shipping_cost')
  const taxasShopee = totalComissao + totalFrete
  const lucroEscrow = sumLucroReal(current)
  const adsSpend = sumCents(current, 'ads_spend_cents')
  const adsGmv = sumCents(current, 'ads_gmv_cents')
  const adsOrders = sum(current, 'ads_orders')
  const adsImpressions = sum(current, 'ads_impressions')
  const adsClicks = sum(current, 'ads_clicks')
  // Lucro Bruto Macro (fórmula João): Vendas − Taxas Marketplace − Ads. Sem COGS.
  const lucroBrutoMacro = faturamento - taxasShopee - adsSpend
  const lucroLiquido = lucroEscrow - adsSpend
  const ticketMedio = pedidos > 0 ? faturamento / pedidos : 0
  const margemMedia = avgMargemReal(current)
  const margemLiquida = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0
  const cancelados = sum(current, 'orders_cancelled_count')
  const taxaCancel = pedidos > 0 ? (cancelados / pedidos) * 100 : 0
  const roasGlobal = adsSpend > 0 ? adsGmv / adsSpend : 0
  const acosGlobal = adsGmv > 0 ? (adsSpend / adsGmv) * 100 : 0
  const pctVendasAds = faturamento > 0 ? (adsGmv / faturamento) * 100 : 0
  const ctrGlobal = adsImpressions > 0 ? (adsClicks / adsImpressions) * 100 : 0

  const prevFat = sum(previous, faturamentoField) || sum(previous, 'gross_revenue')
  const prevPed = sum(previous, pedidosField) || sum(previous, 'orders_count')
  const prevComissao = sum(previous, 'total_commission')
  const prevFrete = sum(previous, 'total_shipping_cost')
  const prevTaxasShopee = prevComissao + prevFrete
  const prevLucroEscrow = sumLucroReal(previous)
  const prevAdsSpend = sumCents(previous, 'ads_spend_cents')
  const prevAdsGmv = sumCents(previous, 'ads_gmv_cents')
  const prevAdsOrders = sum(previous, 'ads_orders')
  const prevLucroBrutoMacro = prevFat - prevTaxasShopee - prevAdsSpend
  const prevLucroLiquido = prevLucroEscrow - prevAdsSpend
  const prevTicket = prevPed > 0 ? prevFat / prevPed : 0
  const prevMargem = avgMargemReal(previous)
  const prevCancel = sum(previous, 'orders_cancelled_count')
  const prevTaxaCancel = prevPed > 0 ? (prevCancel / prevPed) * 100 : 0
  const prevRoas = prevAdsSpend > 0 ? prevAdsGmv / prevAdsSpend : 0
  const prevAcos = prevAdsGmv > 0 ? (prevAdsSpend / prevAdsGmv) * 100 : 0
  const prevPctVendasAds = prevFat > 0 ? (prevAdsGmv / prevFat) * 100 : 0

  // Card #58 (call João 18/06): KPIs topo = 4 cards. Lucro Bruto + Margem Líquida removidos (cálculo ainda não confiável).
  const kpis = [
    { label: 'Faturamento', value: `R$ ${fmtBrl(faturamento)}`, ...deltaPct(faturamento, prevFat), icon: 'payments', iconClass: 'text-zinc-50', valueClass: 'text-zinc-50', sub: (incl ? 'critério Shopee: inclui cancelados pagos' : undefined) as string | undefined },
    { label: 'Pedidos', value: fmtNum(pedidos), ...deltaPct(pedidos, prevPed), icon: 'shopping_cart', iconClass: 'text-primary', valueClass: 'text-zinc-50', sub: (incl ? 'critério Shopee: inclui cancelados pagos' : undefined) as string | undefined },
    { label: 'Ticket Médio', value: `R$ ${fmtBrl(ticketMedio)}`, ...deltaPct(ticketMedio, prevTicket), icon: 'receipt_long', iconClass: 'text-primary-fixed-dim', valueClass: 'text-zinc-50', sub: undefined },
    { label: 'Cancelamentos', value: fmtPct(taxaCancel), ...deltaPct(taxaCancel, prevTaxaCancel), icon: 'remove_shopping_cart', iconClass: 'text-error', valueClass: 'text-zinc-50', sub: `${fmtNum(cancelados)} de ${fmtNum(pedidos + cancelados)}` },
  ]

  const adsKpis = [
    { label: 'Gasto em Ads',      value: fmtBrlInt(adsSpend),        ...deltaPct(adsSpend, prevAdsSpend),     icon: 'payments',       iconClass: 'text-error',     valueClass: 'text-error',          invert: true,  sub: `média ${fmtBrlInt(current.length > 0 ? adsSpend / current.length : 0)}/dia` },
    { label: 'GMV via Ads',       value: fmtBrlInt(adsGmv),          ...deltaPct(adsGmv, prevAdsGmv),         icon: 'shopping_cart',  iconClass: 'text-primary',   valueClass: 'text-primary',        invert: false, sub: `${fmtNum(adsOrders)} pedidos via Ads` },
    { label: 'ROAS Global',       value: fmtRoas(roasGlobal),        ...deltaPct(roasGlobal, prevRoas),       icon: 'trending_up',    iconClass: 'text-secondary', valueClass: 'text-secondary-fixed', invert: false, sub: 'retorno / investido' },
    { label: 'ACOS Global',       value: fmtPct(acosGlobal),         ...deltaPct(acosGlobal, prevAcos),       icon: 'pie_chart',      iconClass: 'text-tertiary',  valueClass: 'text-zinc-50',        invert: true,  sub: 'custo / vendas Ads' },
    { label: '% Vendas via Ads',  value: fmtPct(pctVendasAds),       ...deltaPct(pctVendasAds, prevPctVendasAds), icon: 'campaign',  iconClass: 'text-primary-fixed', valueClass: 'text-zinc-50',      invert: false, sub: `de R$ ${fmtBrl(adsGmv / 1000)}k em ${fmtBrlInt(faturamento)}` },
    { label: 'Pedidos via Ads',   value: fmtNum(adsOrders),          ...deltaPct(adsOrders, prevAdsOrders),   icon: 'inventory',      iconClass: 'text-zinc-50',   valueClass: 'text-zinc-50',        invert: false, sub: pedidos > 0 ? `${fmtPct((adsOrders / pedidos) * 100)} do total · CTR ${fmtPct(ctrGlobal)}` : undefined },
  ]

  // Card #59 (call João 18/06): linha Despesas/Financeiro — 5 cards do período
  // comissaoAfiliados vem de shopee_affiliate_performance (card #62)
  const despesasKpis = [
    { label: 'Gasto em Ads',           value: `R$ ${fmtBrl(adsSpend)}`,                 ...deltaPct(adsSpend, prevAdsSpend),                              icon: 'campaign',         iconClass: 'text-error',   valueClass: 'text-error',          invert: true,  sub: `Shopee Ads do período` },
    { label: 'Comissão Afiliados',     value: `R$ ${fmtBrl(comissaoAfiliadosCur)}`,     ...deltaPct(comissaoAfiliadosCur, comissaoAfiliadosPrev),         icon: 'group',            iconClass: 'text-zinc-500', valueClass: 'text-zinc-50',        invert: true,  sub: 'Snapshot últimos 30d (AMS)' },
    { label: 'Frete Vendedor',         value: `R$ ${fmtBrl(totalFrete)}`,               ...deltaPct(totalFrete, prevFrete),                               icon: 'local_shipping',   iconClass: 'text-error',   valueClass: 'text-error',          invert: true,  sub: 'frete pago pelo vendedor' },
    { label: 'Taxas Shopee',           value: `R$ ${fmtBrl(totalComissao)}`,            ...deltaPct(totalComissao, prevComissao),                         icon: 'percent',          iconClass: 'text-error',   valueClass: 'text-error',          invert: true,  sub: vendasProduto > 0 ? `comissão + serviço · ${fmtPct((totalComissao / vendasProduto) * 100)} das vendas de produto` : 'comissão + serviço' },
    { label: 'Repasse Liberado',       value: `R$ ${fmtBrl(repasseCur)}`,               ...deltaPct(repasseCur, repassePrev),                             icon: 'account_balance', iconClass: 'text-secondary', valueClass: 'text-secondary-fixed', invert: false, sub: 'escrow liberado no período' },
  ]
  // Total despesas pra mostrar acima da linha (Repasse é receita liberada, não entra na soma)
  const totalDespesas = adsSpend + comissaoAfiliadosCur + totalFrete + totalComissao
  const prevTotalDespesas = prevAdsSpend + comissaoAfiliadosPrev + prevFrete + prevComissao
  const totalDespesasDelta = deltaPct(totalDespesas, prevTotalDespesas)

  const dailyRows = [...current].reverse().slice(0, 5)
  const distribution = buildDistribution(current)
  const chartData = useMemo(
    () => buildChartData(period, current, previous, customFrom, customTo),
    [period, current, previous, customFrom, customTo],
  )

  return (
    <>
      <TopBar showSearch />
      <InfoModal infoKey={infoKey} onClose={() => setInfoKey(null)} />
      <ConfigModal open={configOpen} config={config} onSave={saveConfig} onClose={() => setConfigOpen(false)} />
      <div className={cn('p-margin flex flex-col gap-gutter flex-1 overflow-y-auto', pending && 'opacity-70 pointer-events-none transition-opacity')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-zinc-50 flex items-center gap-sm">
              Métricas
              <span className="text-zinc-500 font-normal">—</span>
              <span className="text-zinc-50">Shopee</span>
            </h1>
            <p className="font-body-md text-body-md text-zinc-400 mt-1">
              {nickname ? `Conta ${nickname}` : 'Conta Shopee ativa'} · performance e rentabilidade.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg p-1 border border-zinc-800 bg-zinc-900/60">
              {periods.map((p) => {
                const active = !isCustom && period === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPeriod(p.key)}
                    className={cn(
                      'px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors',
                      active
                        ? 'bg-zinc-50 text-zinc-900 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-50',
                    )}
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
                  'flex h-[36px] items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                  isCustom
                    ? 'border-zinc-50 bg-zinc-50 text-zinc-900'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-50',
                )}
                aria-label="Selecionar intervalo"
              >
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>
                  {isCustom && customFrom && customTo
                    ? `${fmtDateBRShort(customFrom)} – ${fmtDateBRShort(customTo)}`
                    : 'Personalizar'}
                </span>
                <span className={cn('material-symbols-outlined text-[14px]', popoverOpen && 'rotate-180')}>expand_more</span>
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

            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className={cn(
                'flex h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors',
                incl
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:border-amber-500/60'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-50',
              )}
              aria-label="Filtro do funil de pedidos"
              title="Filtro do funil de pedidos"
            >
              <span className="material-symbols-outlined text-[18px]">filter_alt</span>
              <span className="text-[10px] font-semibold uppercase">
                {config.criterio === 'pedido_feito' ? 'Pedido Feito (Shopee)'
                  : config.criterio === 'produto_pago' ? 'Produto Pago (Shopee)'
                  : 'Funil'}
              </span>
            </button>
          </div>
        </div>

        {current.length === 0 ? (
          <EmptyDataState nickname={nickname} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 relative overflow-hidden group hover:bg-zinc-900/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      {kpi.label}
                      <InfoButton label={kpi.label} onOpen={setInfoKey} />
                    </span>
                    <span className={cn('material-symbols-outlined text-lg', kpi.iconClass)}>
                      {kpi.icon}
                    </span>
                  </div>
                  <div className={cn('font-h2 text-h2', kpi.valueClass)}>{kpi.value}</div>
                  {kpi.sub && (
                    <div className="text-[10px] text-zinc-500 font-mono leading-tight">{kpi.sub}</div>
                  )}
                  <div
                    className={cn(
                      'flex items-center gap-1 font-label-md text-label-md',
                      kpi.trend === 'flat' ? 'text-zinc-500' : kpi.trend === 'up' ? 'text-secondary' : 'text-error',
                    )}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {kpi.trend === 'up' ? 'trending_up' : kpi.trend === 'down' ? 'trending_down' : 'trending_flat'}
                    </span>
                    <span>{kpi.delta}</span>
                    <span className="text-zinc-500 ml-1 text-[10px]">vs ant.</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Linha Despesas (card #59 call João 18/06) — 5 cards do período */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-zinc-500 font-semibold mt-1">
              <span className="material-symbols-outlined text-[14px] text-error">trending_down</span>
              Despesas
              <span className="flex-1 h-px bg-zinc-800" />
              <span className={cn(
                'normal-case tracking-normal text-[10px] flex items-center gap-1',
                totalDespesasDelta.trend === 'flat' ? 'text-zinc-500' : totalDespesasDelta.trend === 'up' ? 'text-error' : 'text-secondary',
              )}>
                Total: <span className="text-zinc-300 font-mono font-semibold">{`R$ ${fmtBrl(totalDespesas)}`}</span>
                <span className="material-symbols-outlined text-[12px]">
                  {totalDespesasDelta.trend === 'up' ? 'trending_up' : totalDespesasDelta.trend === 'down' ? 'trending_down' : 'trending_flat'}
                </span>
                <span>{totalDespesasDelta.delta}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-gutter">
              {despesasKpis.map((kpi) => {
                const goodUp = !kpi.invert
                const trendColor =
                  kpi.trend === 'flat' ? 'text-zinc-500'
                  : (kpi.trend === 'up' && goodUp) || (kpi.trend === 'down' && !goodUp) ? 'text-secondary'
                  : 'text-error'
                return (
                  <div
                    key={kpi.label}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-2 relative overflow-hidden hover:bg-zinc-900/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label-md text-label-md text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        {kpi.label}
                        <InfoButton label={kpi.label} onOpen={setInfoKey} />
                      </span>
                      <span className={cn('material-symbols-outlined text-lg', kpi.iconClass)}>{kpi.icon}</span>
                    </div>
                    <div className={cn('font-h2 text-h2', kpi.valueClass)}>{kpi.value}</div>
                    {kpi.sub && <div className="text-[10px] text-zinc-500 font-mono leading-tight">{kpi.sub}</div>}
                    <div className={cn('flex items-center gap-1 font-label-md text-label-md', trendColor)}>
                      <span className="material-symbols-outlined text-[14px]">
                        {kpi.trend === 'up' ? 'trending_up' : kpi.trend === 'down' ? 'trending_down' : 'trending_flat'}
                      </span>
                      <span>{kpi.delta}</span>
                      <span className="text-zinc-500 ml-1 text-[10px]">vs ant.</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <MetricsChart period={period} data={chartData} />

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-gutter">
              <div className="lg:col-span-6 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
                <div className="p-lg border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-h3 text-h3 text-zinc-50">Dados Diários</h3>
                  <button className="font-label-md text-label-md text-zinc-50 flex items-center gap-1 hover:text-blue-300 transition-colors">
                    Exportar CSV
                    <span className="material-symbols-outlined text-[16px]">download</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
                    <thead className="bg-zinc-900/60">
                      <tr>
                        <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px]">Data</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Pedidos</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Canc.</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Fat. (R$)</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Comissão (R$)</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Frete (R$)</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Ads (R$)</th>
                        <th className="px-md py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Lucro (R$)</th>
                        <th className="px-lg py-3 text-zinc-400 font-medium uppercase tracking-wider text-[11px] text-right">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {dailyRows.map((r) => {
                        const adsSpendDay = (Number(r.ads_spend_cents) || 0) / 100
                        const lucroEscrowDay = lucroReal(r)
                        const lucro = lucroEscrowDay - adsSpendDay
                        const margemPctDay = r.gross_revenue > 0 ? (lucro / Number(r.gross_revenue)) * 100 : null
                        const tone = toneFor(margemPctDay)
                        const cancelTone = r.orders_cancelled_count > 0 ? 'text-error' : 'text-zinc-400'
                        const lucroTone = lucro > 0 ? 'text-secondary' : 'text-error'
                        return (
                          <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-lg py-3 text-zinc-50">{fmtShortDate(r.date)}</td>
                            <td className="px-md py-3 text-zinc-400 text-right">{r.orders_count}</td>
                            <td className={cn('px-md py-3 text-right', cancelTone)}>{r.orders_cancelled_count}</td>
                            <td className="px-md py-3 text-zinc-50 text-right font-mono-sm">{fmtBrl(r.gross_revenue)}</td>
                            <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtBrl(r.total_commission)}</td>
                            <td className="px-md py-3 text-zinc-400 text-right font-mono-sm">{fmtBrl(r.total_shipping_cost)}</td>
                            <td className={cn('px-md py-3 text-right font-mono-sm', adsSpendDay > 0 ? 'text-error' : 'text-zinc-500')}>
                              {adsSpendDay > 0 ? fmtBrl(adsSpendDay) : '—'}
                            </td>
                            <td className={cn('px-md py-3 text-right font-mono-sm', lucroTone)}>{fmtBrl(lucro)}</td>
                            <td className="px-lg py-3 text-right">
                              <span
                                className={cn(
                                  'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold',
                                  margemBadge[tone],
                                )}
                              >
                                {margemPctDay !== null ? fmtPct(margemPctDay) : '—'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-white/10 text-center">
                  <button className="font-label-md text-label-md text-zinc-500 hover:text-zinc-50 transition-colors">
                    Ver histórico completo
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-h3 text-h3 text-zinc-50">Distribuição de Margem</h3>
                  <span className="material-symbols-outlined text-zinc-600">info</span>
                </div>
                <div className="flex flex-col gap-5 flex-1 justify-center">
                  {distribution.map((m) => (
                    <div key={m.label} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between font-label-md text-label-md">
                        <span className="text-zinc-50 flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full', m.color)} /> {m.label}
                        </span>
                        <span className="text-zinc-400">
                          {m.count} {m.count === 1 ? 'dia' : 'dias'} · {m.percent}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', m.color)} style={{ width: `${m.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
