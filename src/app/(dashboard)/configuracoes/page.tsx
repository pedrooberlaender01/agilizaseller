import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'
import { createClient } from '@/lib/supabase/server'
import type { MarketplaceConnection } from '@/types'
import { ConnectionsSection } from './connections-section'

const anchors = [
  { id: 'conexoes', label: 'Conexões', icon: 'cable', active: true },
  { id: 'perfil', label: 'Perfil', icon: 'person' },
  { id: 'dados', label: 'Dados da Demonstração', icon: 'database' },
]

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('marketplace_connections')
    .select('id, marketplace, external_user_id, nickname, status, connected_at, updated_at')
    .order('marketplace')

  const connections = (data ?? []) as MarketplaceConnection[]

  return (
    <>
      <TopBar title="Configurações" />
      <main className="max-w-7xl p-margin">
        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="sticky top-[calc(56px+40px)] flex flex-col gap-2">
              {anchors.map((a) => (
                <a
                  key={a.id}
                  href={`#${a.id}`}
                  className={
                    a.active
                      ? 'flex items-center gap-2 rounded-lg border-l-2 border-primary bg-primary/10 px-4 py-2 text-xs font-medium text-primary transition-colors'
                      : 'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface'
                  }
                >
                  <Icon name={a.icon} size={18} />
                  {a.label}
                </a>
              ))}
            </div>
          </aside>

          <div className="flex flex-col gap-margin lg:col-span-9">
            <ConnectionsSection connections={connections} />

            <hr className="border-outline-variant/20" />

            <section id="perfil" className="scroll-mt-[100px]">
              <h2 className="mb-lg text-h2 font-semibold text-on-surface">Perfil do Usuário</h2>
              <div className="flex flex-col items-start gap-xl rounded-xl border border-outline-variant/30 bg-surface-container-high/70 p-lg backdrop-blur-[16px] md:flex-row">
                <div className="flex flex-col items-center gap-4">
                  <div className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border-2 border-primary/30 p-1">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#3b82f6] text-2xl font-bold text-white">
                      JS
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Icon name="photo_camera" className="text-white" />
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Administrador
                  </span>
                </div>
                <div className="w-full flex-1 space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                      Nome Completo
                    </label>
                    <input
                      className="w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      defaultValue="João Silva"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                      E-mail (Login)
                    </label>
                    <div className="relative">
                      <input
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-sm text-on-surface-variant"
                        defaultValue="joao.silva@agiliza.com"
                      />
                      <Icon name="lock" size={20} className="absolute right-3 top-2.5 text-outline-variant" />
                    </div>
                    <p className="mt-1 text-xs text-outline-variant">
                      O e-mail de login não pode ser alterado diretamente.
                    </p>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button className="rounded bg-primary px-6 py-2 text-xs font-medium text-on-primary shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90">
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-outline-variant/20" />

            <section id="dados" className="mb-margin scroll-mt-[100px]">
              <h2 className="mb-lg text-h2 font-semibold text-on-surface">Controle de Dados</h2>
              <div className="relative overflow-hidden rounded-xl border border-tertiary/50 bg-surface-container-high/70 p-lg backdrop-blur-[16px]">
                <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-tertiary/10 blur-[50px]" />
                <div className="relative z-10 flex items-start gap-4">
                  <Icon name="warning" className="mt-1 text-[32px] text-tertiary" />
                  <div className="flex-1">
                    <h3 className="mb-2 text-base font-semibold text-on-surface">Ambiente de Demonstração</h3>
                    <p className="mb-6 max-w-2xl text-sm text-on-surface-variant">
                      Esta conta está operando em modo de demonstração. Você pode forçar a regeneração do
                      conjunto de dados fictícios para testar diferentes cenários, ou limpar completamente o
                      banco para simular uma conta vazia.
                    </p>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <button className="flex items-center justify-center gap-2 rounded border border-tertiary/50 px-4 py-2 text-xs font-medium text-tertiary transition-colors hover:bg-tertiary/10">
                        <Icon name="refresh" size={18} />
                        Regenerar dados de teste
                      </button>
                      <button className="flex items-center justify-center gap-2 rounded border border-error/50 bg-error/10 px-4 py-2 text-xs font-medium text-error transition-colors hover:bg-error hover:text-on-error">
                        <Icon name="delete_forever" size={18} />
                        Limpar todos os dados
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
