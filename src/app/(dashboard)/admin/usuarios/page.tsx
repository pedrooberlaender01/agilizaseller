import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/top-bar'
import { UsuariosView } from './usuarios-view'

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

export default async function AdminUsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: 'admin' | 'user' }>()

  if (!meProfile || meProfile.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: false })

  return (
    <>
      <TopBar title="Administração — Usuários" />
      <main className="flex-1 overflow-y-auto p-margin">
        <UsuariosView profiles={(profiles ?? []) as ProfileRow[]} currentUserId={user.id} />
      </main>
    </>
  )
}
