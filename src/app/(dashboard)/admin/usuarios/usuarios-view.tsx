'use client'

import { useActionState, useState, useTransition } from 'react'
import { createUser, updateUserRole, deleteUser, type AdminActionState } from '../actions'

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

type Props = {
  profiles: ProfileRow[]
  currentUserId: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function UsuariosView({ profiles, currentUserId }: Props) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(createUser, null)
  const [showForm, setShowForm] = useState(false)
  const [busy, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string>('')

  function handleRoleChange(userId: string, newRole: 'admin' | 'user') {
    setFeedback('')
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole)
        setFeedback(`Role atualizado para ${newRole}.`)
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : 'Erro.')
      }
    })
  }

  function handleDelete(userId: string, email: string) {
    if (!confirm(`Deletar usuário ${email}? Esta ação é irreversível.`)) return
    setFeedback('')
    startTransition(async () => {
      try {
        await deleteUser(userId)
        setFeedback(`Usuário ${email} deletado.`)
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : 'Erro.')
      }
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-lg pb-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-h1 text-h1 text-white mb-1">Usuários</h2>
          <p className="font-body-md text-body-md text-slate-400">
            {profiles.length} usuário(s) cadastrado(s)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="h-9 px-4 rounded-lg bg-[#3b82f6] hover:bg-blue-600 active:scale-[0.98] transition-all text-white font-label-md text-label-md flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showForm ? 'close' : 'person_add'}
          </span>
          {showForm ? 'Cancelar' : 'Novo usuário'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-lg">
          <h3 className="font-h3 text-h3 text-white mb-md">Criar novo usuário</h3>
          <form action={action} className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-slate-400" htmlFor="full_name">
                Nome completo
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="Nome do usuário"
                className="h-10 bg-[#050507] border border-white/10 rounded-lg px-3 text-white placeholder-slate-600 focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none"
              />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-slate-400" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="usuario@exemplo.com"
                className="h-10 bg-[#050507] border border-white/10 rounded-lg px-3 text-white placeholder-slate-600 focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none"
              />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-slate-400" htmlFor="password">
                Senha (mín. 8 caracteres)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                className="h-10 bg-[#050507] border border-white/10 rounded-lg px-3 text-white placeholder-slate-600 focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none"
              />
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-slate-400" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue="user"
                className="h-10 bg-[#050507] border border-white/10 rounded-lg px-3 text-white focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none"
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center justify-between gap-md mt-2">
              {state?.error && <span className="text-error font-label-md text-label-md">{state.error}</span>}
              {state?.success && <span className="text-secondary-fixed-dim font-label-md text-label-md">{state.success}</span>}
              {!state && <span />}
              <button
                type="submit"
                disabled={pending}
                className="h-10 px-6 rounded-lg bg-[#3b82f6] hover:bg-blue-600 active:scale-[0.98] transition-all text-white font-label-md text-label-md disabled:opacity-60"
              >
                {pending ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {feedback && (
        <div className="rounded-lg border border-white/10 bg-[#161b22]/80 px-4 py-2 text-slate-300 font-label-md text-label-md">
          {feedback}
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-slate-400 text-left font-label-md text-label-md">
            <tr>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const isMe = p.id === currentUserId
              return (
                <tr key={p.id} className="border-t border-white/5 text-slate-200">
                  <td className="px-4 py-3 font-mono-sm text-mono-sm">
                    {p.email}
                    {isMe && <span className="ml-2 text-[10px] text-blue-400 uppercase tracking-wider">Você</span>}
                  </td>
                  <td className="px-4 py-3">{p.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role}
                      disabled={busy || isMe}
                      onChange={(e) => handleRoleChange(p.id, e.target.value as 'admin' | 'user')}
                      className="bg-[#050507] border border-white/10 rounded px-2 py-1 text-slate-200 focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] outline-none disabled:opacity-50"
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono-sm text-mono-sm text-slate-400">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy || isMe}
                      onClick={() => handleDelete(p.id, p.email)}
                      className="h-8 px-3 rounded border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              )
            })}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
