'use client'

import { useState, useTransition } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/dates'
import { disconnectMarketplace } from '@/app/actions/connections'
import type { MarketplaceConnection } from '@/types'

type MarketplaceKey = MarketplaceConnection['marketplace']

type Meta = {
  key: MarketplaceKey
  name: string
  icon: string
  iconBg: string
  iconColor: string
  available: boolean
}

const MARKETPLACES_META: Meta[] = [
  { key: 'mercado_livre', name: 'Mercado Livre', icon: 'handshake',    iconBg: 'bg-[#FFF159]',                           iconColor: 'text-black', available: true },
  { key: 'shopee',        name: 'Shopee',        icon: 'shopping_bag', iconBg: 'bg-[#EE4D2D]',                           iconColor: 'text-white', available: true },
  { key: 'shein',         name: 'Shein',         icon: 'storefront',   iconBg: 'bg-black border border-white/10',        iconColor: 'text-white', available: true },
  { key: 'magazord',      name: 'Magazord',      icon: 'hub',           iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-700', iconColor: 'text-white', available: true },
  { key: 'tiktok_shop',   name: 'TikTok Shop',   icon: 'music_note',   iconBg: 'bg-black border border-white/10',        iconColor: 'text-white', available: false },
]

type Status = MarketplaceConnection['status']
type CardState = 'active' | 'reauth' | 'connect' | 'unavailable'

function cardStateOf(meta: Meta, conn: MarketplaceConnection | undefined): CardState {
  if (!meta.available) return 'unavailable'
  if (!conn || conn.status === 'disconnected') return 'connect'
  if (conn.status === 'expired' || conn.status === 'error') return 'reauth'
  return 'active'
}

function StatusBadge({ state, status }: { state: CardState; status?: Status }) {
  if (state === 'unavailable') {
    return (
      <span className="rounded border border-outline-variant/20 bg-surface-variant px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        Em breve
      </span>
    )
  }
  if (state === 'connect') {
    return (
      <span className="rounded border border-outline-variant/30 bg-surface-container-high px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        Não conectado
      </span>
    )
  }
  if (state === 'reauth') {
    const label = status === 'expired' ? 'Expirado' : 'Erro'
    return (
      <span className="flex items-center gap-1 rounded border border-tertiary/30 bg-tertiary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-tertiary">
        <span className="block h-1.5 w-1.5 rounded-full bg-tertiary" />
        {label}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 rounded border border-secondary/20 bg-secondary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
      <span className="block h-1.5 w-1.5 rounded-full bg-secondary" />
      Ativo
    </span>
  )
}

function ConnectionCard({ meta, conn }: { meta: Meta; conn: MarketplaceConnection | undefined }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const state = cardStateOf(meta, conn)

  function handleDisconnect() {
    if (!conn) return
    if (!window.confirm(`Desconectar ${meta.name}? Sincronizações pararão até reconectar.`)) return
    setError(null)
    startTransition(async () => {
      const res = await disconnectMarketplace(conn.id)
      if (!res.ok) setError(res.error ?? 'Falha ao desconectar')
    })
  }

  const desc =
    state === 'active' && conn?.nickname
      ? `Conectado como ${conn.nickname}`
      : state === 'active'
        ? 'Conta ativa'
        : state === 'reauth'
          ? `Token ${conn?.status === 'expired' ? 'expirado' : 'com erro'} — reconectar`
          : state === 'connect'
            ? 'Não conectado'
            : 'Integração em desenvolvimento'

  if (state === 'unavailable') {
    return (
      <div className="flex cursor-not-allowed flex-col justify-between rounded-xl border border-outline-variant/10 bg-surface-container-low/50 p-lg opacity-70">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg grayscale', meta.iconBg)}>
              <Icon name={meta.icon} className={meta.iconColor} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface">{meta.name}</h3>
              <p className="text-sm text-on-surface-variant">{desc}</p>
            </div>
          </div>
          <StatusBadge state={state} />
        </div>
      </div>
    )
  }

  const isActive = state === 'active'
  const isReauth = state === 'reauth'
  const isConnect = state === 'connect'

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-xl border bg-surface-container-high/70 p-lg backdrop-blur-[16px]',
        isReauth ? 'border-tertiary/40' : 'border-outline-variant/30',
      )}
    >
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shadow-inner', meta.iconBg, isConnect && 'grayscale')}>
            <Icon name={meta.icon} className={cn(meta.iconColor, 'font-bold')} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-on-surface">{meta.name}</h3>
            <p className="text-sm text-on-surface-variant">{desc}</p>
          </div>
        </div>
        <StatusBadge state={state} status={conn?.status} />
      </div>

      {error && (
        <div className="mb-3 rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-outline-variant/20 pt-4">
        <span className="text-xs text-on-surface-variant">
          {isActive && conn?.updated_at && <>Última sinc: {timeAgo(conn.updated_at)}</>}
          {isReauth && <>Reconecte para retomar sincronização</>}
          {isConnect && <>Comece a sincronizar dados em segundos</>}
        </span>
        <div className="flex gap-2">
          {isActive && (
            <>
              <button
                onClick={handleDisconnect}
                disabled={isPending}
                className="rounded border border-outline-variant bg-surface px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? 'Desconectando…' : 'Desconectar'}
              </button>
              <button
                disabled
                title="Disparado via workflow n8n — botão futuro"
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-on-primary shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sincronizar agora
              </button>
            </>
          )}
          {isReauth && (
            <button
              disabled
              title="Fluxo OAuth pendente"
              className="rounded bg-tertiary px-3 py-1.5 text-xs font-medium text-on-tertiary shadow-lg shadow-orange-900/20 transition-colors hover:bg-tertiary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Re-autorizar
            </button>
          )}
          {isConnect && (
            <button
              disabled
              title="Fluxo OAuth pendente"
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-on-primary shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Conectar agora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ConnectionsSection({ connections }: { connections: MarketplaceConnection[] }) {
  const cards = MARKETPLACES_META.map((meta) => ({
    meta,
    conn: connections.find((c) => c.marketplace === meta.key),
  }))

  const hasAnyActive = connections.some((c) => c.status === 'active')

  return (
    <section id="conexoes" className="scroll-mt-[100px]">
      <div className="mb-lg flex items-end justify-between">
        <h2 className="text-h2 font-semibold text-on-surface">Conexões de Plataforma</h2>
        {!hasAnyActive && connections.length === 0 && (
          <span className="text-xs text-on-surface-variant">Nenhum marketplace conectado ainda.</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        {cards.map(({ meta, conn }) => (
          <ConnectionCard key={meta.key} meta={meta} conn={conn} />
        ))}
      </div>
    </section>
  )
}
