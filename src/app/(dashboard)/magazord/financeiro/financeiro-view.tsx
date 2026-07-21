import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

// Versão completa (cards + abas Receber/Pagar/Formas) fica no commit ac87d7f.
// Congelado em "Em desenvolvimento" até a equipe definir quais dados querem ver.
export function FinanceiroView({ nickname }: { nickname?: string | null }) {
  return (
    <>
      <TopBar title="Financeiro — Magazord" />
      <main className="flex flex-1 flex-col p-margin">
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

        <div className="flex flex-1 items-center justify-center py-16">
          <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border border-amber-500/20 bg-zinc-900/60 px-10 py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
              <Icon name="construction" size={32} />
            </span>
            <h3 className="text-2xl font-semibold text-white">Em desenvolvimento</h3>
            <p className="max-w-lg text-base leading-relaxed text-slate-200">
              Esperando a decisão de quais dados a equipe quer ver. A base já está
              sincronizando (Contas a Receber e a Pagar do Magazord) — os indicadores
              serão definidos assim que o time confirmar o que faz sentido acompanhar.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
