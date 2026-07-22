import { TopBar } from '@/components/top-bar'

// Espelha /shopee/saude. Shop performance / penalties TikTok ainda não integrado.
export default function TiktokSaudePage() {
  return (
    <>
      <TopBar title="Saúde da Conta — TikTok Shop" />
      <main className="overflow-y-auto p-margin">
        <div className="grid grid-cols-12 gap-4">
          {/* Hero status */}
          <div className="col-span-12 flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-lg lg:col-span-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Performance</span>
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-200">Em breve</span>
            </div>
            <div>
              <p className="text-5xl font-semibold text-zinc-600">—</p>
              <p className="mt-1 text-sm text-zinc-500">Health Score / Violations</p>
            </div>
          </div>

          {/* 3 metric cards */}
          <div className="col-span-12 grid grid-cols-1 gap-4 md:grid-cols-3 lg:col-span-8">
            {['Penalty Points', 'Listing Violations', 'Performance Rating'].map((l) => (
              <div key={l} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">{l}</span>
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-medium text-blue-200">Em breve</span>
                </div>
                <p className="mt-2 text-3xl font-semibold text-zinc-600">—</p>
              </div>
            ))}
          </div>

          {/* Detalhe de métricas */}
          <div className="col-span-12 rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="border-b border-white/10 p-lg">
              <h3 className="font-h3 text-h3 text-white">Detalhes de Métricas</h3>
              <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">Shop performance API — não integrado</p>
            </div>
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <span className="material-symbols-outlined text-3xl text-zinc-600">monitor_heart</span>
              <p className="text-sm text-zinc-500">Saúde da conta TikTok Shop — não integrado.</p>
              <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200">Em breve</span>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
