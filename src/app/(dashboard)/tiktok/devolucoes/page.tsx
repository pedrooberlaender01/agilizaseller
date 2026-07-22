import { TopBar } from '@/components/top-bar'
import { KpiCard } from '../_ui'

// Espelha /shopee/devolucoes. Return & Refund API TikTok ainda não integrada.
const KPIS = ['Devoluções', 'Taxa de Devolução', 'Valor Perdido', 'Disputas Ativas', 'Aguardando Ação', 'Top Motivo']
const COLS = ['Data', 'Return SN', 'Pedido', 'Status', 'Motivo', 'Reembolso', 'Prazo']

export default function TiktokDevolucoesPage() {
  return (
    <>
      <TopBar title="Devoluções — TikTok Shop" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {KPIS.map((l) => (
            <KpiCard key={l} label={l} value="—" soon />
          ))}
        </div>

        <div className="mb-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Top Motivos</h3>
            <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">TikTok Return API — não integrado</p>
          </div>
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="material-symbols-outlined text-3xl text-zinc-600">keyboard_return</span>
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200">Em breve</span>
          </div>
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
                <td colSpan={COLS.length} className="px-6 py-16 text-center text-sm text-zinc-500">
                  Devoluções TikTok Shop — não integrado.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
