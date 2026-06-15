'use client'

import { useState, useTransition } from 'react'
import { updateProductCost } from './actions'

type Props = {
  productId: string
  skuCode: string
  initialCostPrice: number | null
  initialPackagingCost: number | null
  initialCostNotes: string | null
  costUpdatedAt: string | null
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return 'nunca'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function CostEditor({
  productId,
  skuCode,
  initialCostPrice,
  initialPackagingCost,
  initialCostNotes,
  costUpdatedAt,
}: Props) {
  const [costPrice, setCostPrice] = useState(initialCostPrice != null ? String(initialCostPrice) : '')
  const [packagingCost, setPackagingCost] = useState(initialPackagingCost != null ? String(initialPackagingCost) : '')
  const [costNotes, setCostNotes] = useState(initialCostNotes ?? '')
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; msg: string } | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(costUpdatedAt)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeedback(null)
    const cp = costPrice.trim() === '' ? null : Number(costPrice.replace(',', '.'))
    const pc = packagingCost.trim() === '' ? null : Number(packagingCost.replace(',', '.'))
    if (cp !== null && !Number.isFinite(cp)) {
      setFeedback({ tone: 'err', msg: 'Custo inválido.' })
      return
    }
    if (pc !== null && !Number.isFinite(pc)) {
      setFeedback({ tone: 'err', msg: 'Embalagem inválida.' })
      return
    }
    startTransition(async () => {
      const result = await updateProductCost({
        product_id: productId,
        sku_code: skuCode,
        cost_price: cp,
        packaging_cost: pc,
        cost_notes: costNotes.trim() || null,
      })
      if (result.ok) {
        setFeedback({ tone: 'ok', msg: 'Custo salvo.' })
        setLastUpdated(new Date().toISOString())
        setEditing(false)
      } else {
        setFeedback({ tone: 'err', msg: result.error || 'Erro ao salvar.' })
      }
    })
  }

  return (
    <div className="border border-zinc-800 bg-zinc-900/40 mb-lg overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Custos do produto</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">Atualizado: {fmtDateTime(lastUpdated)}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setFeedback(null)
            }}
            className="rounded border border-zinc-800 px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Editar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Custo unitário (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            disabled={!editing || pending}
            placeholder="0,00"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Embalagem (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            value={packagingCost}
            onChange={(e) => setPackagingCost(e.target.value)}
            disabled={!editing || pending}
            placeholder="0,00"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Notas</label>
          <input
            type="text"
            value={costNotes}
            onChange={(e) => setCostNotes(e.target.value)}
            disabled={!editing || pending}
            placeholder="Fornecedor, lote, etc"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-[#050507] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-zinc-50/40 disabled:opacity-60"
          />
        </div>

        {editing && (
          <div className="md:col-span-3 flex items-center justify-end gap-3">
            {feedback && (
              <span className={feedback.tone === 'ok' ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
                {feedback.msg}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setCostPrice(initialCostPrice != null ? String(initialCostPrice) : '')
                setPackagingCost(initialPackagingCost != null ? String(initialPackagingCost) : '')
                setCostNotes(initialCostNotes ?? '')
                setEditing(false)
                setFeedback(null)
              }}
              disabled={pending}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {pending ? 'Salvando…' : 'Salvar custo'}
            </button>
          </div>
        )}
        {!editing && feedback && (
          <div className="md:col-span-3">
            <span className={feedback.tone === 'ok' ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
              {feedback.msg}
            </span>
          </div>
        )}
      </form>
    </div>
  )
}
