import { TopBar } from '@/components/top-bar'

// Espelha /shopee/envios: 5 cards de resumo clicáveis + tabela. Logística TikTok ainda não integrada.
const SUMMARY = [
  { label: 'Enviado', icon: 'local_shipping', tone: 'text-blue-400' },
  { label: 'Concluído', icon: 'check_circle', tone: 'text-secondary' },
  { label: 'Problema', icon: 'error', tone: 'text-error' },
  { label: 'A Enviar', icon: 'pending_actions', tone: 'text-[#facc3c]' },
  { label: 'Cancelado', icon: 'cancel', tone: 'text-zinc-500' },
]
const COLS = ['Rastreio', 'Pedido', 'Comprador', 'Destino', 'Status', 'Atualizado', 'Data Pedido']

export default function TiktokEnviosPage() {
  return (
    <>
      <TopBar title="Envios — TikTok Shop" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-5">
          {SUMMARY.map((c) => (
            <div key={c.label} className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-lg">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{c.label}</span>
                <span className={`material-symbols-outlined text-lg ${c.tone}`}>{c.icon}</span>
              </div>
              <span className="text-[32px] font-semibold leading-none text-zinc-600">—</span>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                {COLS.map((c) => (
                  <th key={c} className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-slate-400">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLS.length} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-zinc-600">local_shipping</span>
                    <p className="text-sm text-zinc-500">Rastreio e logística TikTok Shop — não integrado.</p>
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200">Em breve</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
