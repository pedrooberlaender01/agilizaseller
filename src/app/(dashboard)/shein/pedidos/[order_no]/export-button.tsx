'use client'

import { useState, useTransition } from 'react'
import { exportAddress } from './actions'
import { cn } from '@/lib/utils'

export function ExportAddressButton({
  orderNo,
  connectionId,
  hasData,
}: {
  orderNo: string
  connectionId: string
  hasData: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean | null>(null)

  function trigger() {
    setConfirming(false)
    setMessage(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await exportAddress(orderNo, connectionId)
      if (result.ok) {
        setSuccess(true)
        setMessage(`Carregado: ${result.buyer_name || 'sem nome'}`)
      } else {
        setSuccess(false)
        setMessage(result.error || 'Falhou')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border border-zinc-50/40 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-50 transition-colors hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <span className="material-symbols-outlined text-[16px]">person_search</span>
          {hasData ? 'Recarregar comprador' : 'Carregar comprador'}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-error/40 bg-error/10 p-3">
          <p className="text-xs font-medium text-error">⚠️ Atenção</p>
          <p className="text-[11px] text-slate-300">
            Chamar export-address muda o status do pedido para <strong>&quot;To Be Shipped&quot;</strong> na Shein.
            Use só se o pedido já estiver pronto para envio (ou Lucas tiver autorizado).
          </p>
          <div className="flex gap-2">
            <button
              onClick={trigger}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded border border-error/60 bg-error/20 px-3 py-1 text-[11px] font-medium text-error transition-colors hover:bg-error/30 disabled:opacity-40"
            >
              {pending ? 'Chamando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded border border-zinc-800 px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className={cn('text-[11px]', success ? 'text-secondary' : 'text-error')}>
          {message}
        </p>
      )}
    </div>
  )
}
