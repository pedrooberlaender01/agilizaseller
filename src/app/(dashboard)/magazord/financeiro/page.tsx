import { createClient } from '@/lib/supabase/server'
import { FinanceiroView } from './financeiro-view'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Congelado em "Em desenvolvimento" até a equipe definir os indicadores.
// Pipeline (tabelas mag_contas_*, WF sync, RPCs) segue rodando; front completo no commit ac87d7f.
export default async function MagazordFinanceiroPage() {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('nickname')
    .eq('marketplace', 'magazord')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return <FinanceiroView nickname={conn?.nickname ?? null} />
}
