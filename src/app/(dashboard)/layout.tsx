import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'

export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single<UserProfile>()

  const safeProfile: UserProfile = profile ?? {
    id: user.id,
    email: user.email ?? '',
    full_name: null,
    role: 'user',
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0c] text-zinc-50">
      <Sidebar role={safeProfile.role} userName={safeProfile.full_name ?? safeProfile.email} />
      <div className="flex h-screen flex-1 flex-col overflow-hidden md:ml-[240px] bg-[#0a0a0c]">
        {children}
      </div>
    </div>
  )
}
