'use client'

import { useActionState } from 'react'
import { signIn, type SignInState } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, null)

  return (
    <main className="bg-[#0a0a0f] min-h-screen flex items-center justify-center relative overflow-hidden font-body-lg text-on-background selection:bg-primary-container selection:text-on-primary-container">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#0a0a0f_100%)] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-[400px] bg-[#161b22]/95 backdrop-blur-[16px] border border-white/10 rounded-xl p-lg shadow-2xl mx-4">
        <div className="flex flex-col items-center mb-lg text-center">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="material-symbols-outlined fill text-[28px] text-[#3b82f6]"
            >
              insert_chart
            </span>
            <h1 className="text-[22px] font-bold text-white tracking-tight leading-none">
              Painel Luzzo
            </h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Painel de inteligência para marketplaces
          </p>
        </div>

        <div className="h-px w-full bg-white/5 mb-lg" />

        <form action={action} className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="email">
              E-mail
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                mail
              </span>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full h-[44px] bg-[#050507] border border-white/10 rounded-lg pl-[40px] pr-3 font-body-md text-body-md text-white placeholder-outline focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-xs">
            <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                lock
              </span>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-[44px] bg-[#050507] border border-white/10 rounded-lg pl-[40px] pr-3 font-body-md text-body-md text-white placeholder-outline focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors outline-none"
              />
            </div>
          </div>

          {state?.error && (
            <p className="font-label-md text-label-md text-error">{state.error}</p>
          )}
          {state?.success && (
            <p className="font-label-md text-label-md text-secondary-fixed-dim">
              {state.success}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full h-[44px] bg-[#3b82f6] hover:bg-blue-600 active:scale-[0.98] transition-all rounded-lg font-h3 text-h3 text-white mt-2 flex items-center justify-center disabled:opacity-60"
          >
            {pending ? 'Entrando...' : 'Entrar no painel'}
          </button>
        </form>

        <div className="mt-lg pt-md border-t border-white/5 flex items-center justify-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          <span className="font-mono-sm text-mono-sm">
            Acesso restrito — credenciais fornecidas pelo administrador
          </span>
        </div>
      </div>
    </main>
  )
}
