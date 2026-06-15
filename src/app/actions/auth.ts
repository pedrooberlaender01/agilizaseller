'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SignInState = { error?: string; success?: string } | null

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Informe e-mail e senha.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
