'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'

function fmtPct(num: number, den: number): string {
  if (!den) return '0,00%'
  return ((num / den) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

const KPI_INFO: Record<string, { title: string; oQueE: string; origem: string; onde: string; difere?: string }> = {
  'Exceções envio': {
    title: 'Exceções de envio',
    oQueE: 'Percentual de pedidos da janela (30 dias) que estão travados com alguma exceção logística — sistema processando, produto zerado, NF pendente, pacote não gerado, etc.',
    origem: '`shein_orders` com `shipping_status = 2` na janela ÷ total de pedidos da janela. A lista abaixo decodifica o motivo (`raw.unProcessReason`) em texto.',
    onde: 'Painel Shein → Pedidos → filtro de pedidos com exceção / pendência de processamento.',
    difere: 'Alvo < 1%. Métrica derivada dos pedidos sincronizados (Shein não expõe API de saúde da conta).',
  },
  'NF reenviar': {
    title: 'NF para reenviar',
    oQueE: 'Percentual de pedidos cuja nota fiscal foi rejeitada e precisa ser reenviada. O detalhe "pendentes" ao lado são NFs ainda aguardando emissão (não rejeitadas).',
    origem: '`shein_orders` com `payment_status = 3` (reenviar) na janela ÷ pedidos da janela. "Pendentes" = `payment_status = 2`.',
    onde: 'Painel Shein → Pedidos → status de nota fiscal (reenviar / rejeitada).',
    difere: 'Alvo 0%. Derivada dos pedidos sincronizados.',
  },
  'Taxa devolução': {
    title: 'Taxa de devolução',
    oQueE: 'Percentual de devoluções abertas na janela (30 dias) sobre o total de pedidos da janela.',
    origem: '`shein_returns` por `request_return_time` na janela ÷ pedidos da janela.',
    onde: 'Painel Shein → Pedidos → Devolução e reembolso.',
    difere: 'Alvo < 5%. Obs: o total histórico de devoluções cobre 94,1% do painel (limite da API Shein) — ver página Devoluções. A taxa da janela é sobre o que a API retorna.',
  },
  'Produtos deslistados': {
    title: 'Produtos deslistados',
    oQueE: 'Percentual de SKUs do catálogo que estão inativos/deslistados (não disponíveis para venda).',
    origem: '`shein_products` com `status = inativo` ÷ total de SKUs. Populado pelo WF "Shein - Sync Produtos".',
    onde: 'Painel Shein → Produtos → filtro de produtos inativos / deslistados.',
    difere: 'Alvo < 10%. O WF de sync de produtos foi reativado — o dado volta a atualizar. Se aparecer defasado, aguardar o próximo ciclo do sync.',
  },
  'Items perdidos': {
    title: 'Items perdidos',
    oQueE: 'Devoluções marcadas como perdidas pela Shein — o produto sumiu no trajeto de volta. Gera penalidade.',
    origem: '`shein_returns` com `return_order_tag_code = 2` (histórico completo, não só a janela).',
    onde: 'Painel Shein → Devolução e reembolso → casos marcados como perdidos/extraviados.',
    difere: 'Qualquer valor > 0 fica em vermelho — cada item perdido é penalidade.',
  },
  'NF pendente': {
    title: 'NF pendente',
    oQueE: 'Pedidos da janela aguardando emissão de nota fiscal (ainda não emitida, não rejeitada).',
    origem: '`shein_orders` com `payment_status = 2` na janela.',
    onde: 'Painel Shein → Pedidos → status de nota fiscal (aguardando emissão).',
    difere: 'Amarelo quando > 0 — são NFs que ainda precisam ser emitidas.',
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 mb-1.5">Detalhe</div>
              <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-line">{info.difere}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HelpButton({ label, onHelp }: { label: string; onHelp: (k: string) => void }) {
  return (
    <button onClick={() => onHelp(label)} className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors" aria-label={`Explicação: ${label}`}>
      <span className="material-symbols-outlined text-[14px]">help</span>
    </button>
  )
}

type Tone = 'green' | 'yellow' | 'red' | 'gray'

function HealthCard({ label, value, detail, tone, icon, threshold, onHelp }: {
  label: string
  value: string
  detail: string
  tone: Tone
  icon: string
  threshold?: string
  onHelp: (k: string) => void
}) {
  const cls =
    tone === 'green' ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'yellow' ? 'border-amber-500/30 bg-amber-500/5'
        : tone === 'red' ? 'border-rose-500/30 bg-rose-500/5'
          : 'border-zinc-800 bg-zinc-900/40'
  const valCls =
    tone === 'green' ? 'text-emerald-300' : tone === 'yellow' ? 'text-amber-300' : tone === 'red' ? 'text-rose-300' : 'text-white'
  return (
    <div className={cn('rounded-2xl border p-5', cls)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
          <HelpButton label={label} onHelp={onHelp} />
        </div>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-3xl font-semibold', valCls)}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      {threshold && <p className="mt-0.5 text-[10px] text-zinc-500">Alvo: {threshold}</p>}
    </div>
  )
}

function CountCard({ label, value, detail, icon, danger, onHelp }: {
  label: string
  value: number
  detail: string
  icon: string
  danger: 'red' | 'yellow'
  onHelp: (k: string) => void
}) {
  const valCls = value > 0 ? (danger === 'red' ? 'text-rose-300' : 'text-amber-300') : 'text-white'
  return (
    <div className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
          <HelpButton label={label} onHelp={onHelp} />
        </div>
        <Icon name={icon} size={18} className="text-zinc-500" />
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', valCls)}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  )
}

const tone = (pct: number, warn: number, danger: number): Tone =>
  pct >= danger ? 'red' : pct >= warn ? 'yellow' : 'green'

export function SaudeCards({
  shipException,
  invoiceResend,
  invoicePending,
  returns,
  returnsLost,
  productsInactive,
  productsTotal,
  ordersDen,
}: {
  shipException: number
  invoiceResend: number
  invoicePending: number
  returns: number
  returnsLost: number
  productsInactive: number
  productsTotal: number
  ordersDen: number
}) {
  const [helpKey, setHelpKey] = useState<string | null>(null)
  const den = Math.max(1, ordersDen)
  const exceptionPct = (shipException / den) * 100
  const invoiceResendPct = (invoiceResend / den) * 100
  const returnPct = (returns / den) * 100
  const productsDelistedPct = (productsInactive / Math.max(1, productsTotal)) * 100

  return (
    <>
      <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HealthCard label="Exceções envio" value={fmtPct(shipException, ordersDen)} detail={`${shipException} de ${ordersDen} pedidos`} tone={tone(exceptionPct, 1, 3)} icon="local_shipping" threshold="< 1%" onHelp={setHelpKey} />
        <HealthCard label="NF reenviar" value={fmtPct(invoiceResend, ordersDen)} detail={`${invoiceResend} reenviar · ${invoicePending} pendentes`} tone={tone(invoiceResendPct, 0.5, 2)} icon="receipt_long" threshold="0%" onHelp={setHelpKey} />
        <HealthCard label="Taxa devolução" value={fmtPct(returns, ordersDen)} detail={`${returns} devoluções na janela`} tone={tone(returnPct, 5, 10)} icon="keyboard_return" threshold="< 5%" onHelp={setHelpKey} />
        <HealthCard label="Produtos deslistados" value={fmtPct(productsInactive, productsTotal)} detail={`${productsInactive} de ${productsTotal} SKUs`} tone={tone(productsDelistedPct, 10, 25)} icon="block" threshold="< 10%" onHelp={setHelpKey} />
      </div>

      <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2">
        <CountCard label="Items perdidos" value={returnsLost} detail="Devoluções marcadas como perdidas (penalidade Shein)" icon="error" danger="red" onHelp={setHelpKey} />
        <CountCard label="NF pendente" value={invoicePending} detail="Pedidos aguardando emissão NF" icon="hourglass_top" danger="yellow" onHelp={setHelpKey} />
      </div>

      <InfoModal infoKey={helpKey} onClose={() => setHelpKey(null)} />
    </>
  )
}
