'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminActionState = { error?: string; success?: string } | null

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado.')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: 'admin' | 'user' }>()

  if (!profile || profile.role !== 'admin') {
    throw new Error('Acesso restrito a administradores.')
  }
  return user
}

export async function createUser(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdmin()

    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const fullName = String(formData.get('full_name') ?? '').trim()
    const role = String(formData.get('role') ?? 'user') as 'admin' | 'user'

    if (!email || !password) {
      return { error: 'E-mail e senha são obrigatórios.' }
    }
    if (password.length < 8) {
      return { error: 'Senha precisa ter ao menos 8 caracteres.' }
    }
    if (!['admin', 'user'].includes(role)) {
      return { error: 'Role inválido.' }
    }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email, role },
    })

    if (error) return { error: error.message }

    revalidatePath('/admin/usuarios')
    return { success: `Usuário ${email} criado.` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro desconhecido.' }
  }
}

export async function updateUserRole(userId: string, newRole: 'admin' | 'user') {
  const me = await requireAdmin()
  if (userId === me.id && newRole !== 'admin') {
    throw new Error('Não é possível remover o próprio acesso de admin.')
  }
  if (!['admin', 'user'].includes(newRole)) {
    throw new Error('Role inválido.')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ role: newRole }).eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/usuarios')
}

export async function deleteUser(userId: string) {
  const me = await requireAdmin()
  if (userId === me.id) {
    throw new Error('Não é possível deletar a própria conta.')
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/usuarios')
}
