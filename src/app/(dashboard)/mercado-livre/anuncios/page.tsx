import Link from 'next/link'
import { TopBar } from '@/components/top-bar'
import { createClient } from '@/lib/supabase/server'
import { AnunciosView, type MlItemRow } from './anuncios-view'

export const revalidate = 60

function NoConnectionState() {
  return (
    <>
      <TopBar title="Anúncios — Mercado Livre" />
      <main className="flex flex-1 items-center justify-center p-margin">
        <div className="glass-card flex max-w-md flex-col items-center gap-md rounded-2xl p-xl text-center">
          <span className="material-symbols-outlined text-4xl text-tertiary">link_off</span>
          <h2 className="text-h2 font-semibold text-on-surface">Sem conexão Mercado Livre ativa</h2>
          <p className="text-sm text-on-surface-variant">
            Conecte sua conta Mercado Livre em Configurações para começar a sincronizar anúncios.
          </p>
          <Link
            href="/configuracoes"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-tertiary px-4 py-2 text-sm font-medium text-on-tertiary transition-colors hover:bg-tertiary/90"
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Ir para Configurações
          </Link>
        </div>
      </main>
    </>
  )
}

export default async function MercadoLivreAnunciosPage() {
  const supabase = await createClient()

  const { data: conn } = await supabase
    .from('marketplace_connections')
    .select('id')
    .eq('marketplace', 'mercado_livre')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!conn) return <NoConnectionState />

  const { data } = await supabase
    .from('ml_items')
    .select(
      'id, external_id, seller_sku, title, category_id, price, available_quantity, sold_quantity, listing_type_id, status, permalink, thumbnail',
    )
    .eq('connection_id', conn.id)
    .order('sold_quantity', { ascending: false })
    .limit(1000)

  const items = (data ?? []) as MlItemRow[]

  return <AnunciosView items={items} />
}
