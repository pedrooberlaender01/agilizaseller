import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

// Versão completa (cards + abas Receber/Pagar/Formas) fica no commit ac87d7f.
// Congelado em "Em desenvolvimento" até a equipe definir quais dados querem ver.
export function FinanceiroView({ nickname }: { nickname?: string | null }) {
  return (
    <>
      <TopBar title="Financeiro — Magazord" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-lg">
          <h2 className="text-h2 font-semibold text-white">Financeiro</h2>
          {nickname && <p className="mt-1 text-xs text-slate-400">Conexão: {nickname}</p>}
        </div>

        <div className="mb-lg flex items-center gap-1 border-b border-zinc-800">
          <span className="-mb-px flex items-center gap-2 border-b-2 border-primary px-4 py-2.5 text-sm font-medium text-zinc-50">
            <Icon name="dashboard" size={18} />
            Visão Geral
          </span>
        </div>

        <div style={{ display: 'block', width: '100%', maxWidth: 672 }} className="mx-auto rounded-2xl border border-amber-500/20 bg-zinc-900/60 px-12 py-14 text-center">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
            <Icon name="construction" size={32} />
          </span>
          <h3 style={{ display: 'block', width: '100%' }} className="text-2xl font-semibold text-white">Em desenvolvimento</h3>
          <p style={{ display: 'block', width: '100%', maxWidth: 576, margin: '12px auto 0' }} className="text-base leading-relaxed text-slate-200">
            Esperando a decisão de quais dados a equipe quer ver. A base já está sincronizando (Contas a Receber e a Pagar do Magazord) — os indicadores serão definidos assim que o time confirmar o que faz sentido acompanhar.
          </p>
        </div>
      </main>
    </>
  )
}
