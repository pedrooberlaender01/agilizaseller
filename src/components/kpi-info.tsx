'use client'

import { useEffect } from 'react'

// Modal "?" reutilizável (mesmo padrão dos cards de /shopee/metricas).
// Cada tela mantém seu próprio dicionário e passa o objeto info direto.
export type KpiInfo = { title: string; oQueE: string; origem: string; difere?: string }

export function InfoButton({ show, label, onOpen }: { show: boolean; label: string; onOpen: () => void }) {
  if (!show) return null
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-600 hover:bg-white/10 hover:text-zinc-300 transition-colors"
      aria-label={`Explicação: ${label}`}
    >
      <span className="material-symbols-outlined text-[14px]">help</span>
    </button>
  )
}

export function InfoModal({ info, onClose }: { info: KpiInfo | null; onClose: () => void }) {
  useEffect(() => {
    if (!info) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [info, onClose])

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
