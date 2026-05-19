'use client'

import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/top-bar'
import { RevenueChart } from '@/components/revenue-chart'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'agiliza_dashboard_marketplace'

type Marketplace = 'mercado-livre' | 'shopee' | 'todos'

type Kpi = { label: string; value: string; delta: string; trend: 'up' | 'down'; icon: string }
type Alert = { icon: string; tone: string; title: string; body: string; marketplace: 'ml' | 'shopee' }
type HealthBar = { label: string; current: string; limit: string; percent: number; color: string }
type SystemRow = { label: string; when: string; ok: boolean }
type RevenueDay = { day: string; faturamento: number; lucro: number }

type DashboardData = {
  account: string
  kpis: Kpi[]
  revenue: RevenueDay[]
  healthTitle: string
  healthBars: HealthBar[]
  healthLocked?: { title: string; body: string }
  systemStatus: SystemRow[]
}

const mlKpis: Kpi[] = [
  { label: 'Faturamento', value: 'R$ 124.830', delta: '+12,4%', trend: 'up', icon: 'payments' },
  { label: 'Pedidos', value: '1.847', delta: '+8,1%', trend: 'up', icon: 'shopping_bag' },
  { label: 'Lucro Bruto', value: 'R$ 38.920', delta: '+15,2%', trend: 'up', icon: 'account_balance_wallet' },
  { label: 'Margem Média', value: '31,2%', delta: '-0,8%', trend: 'down', icon: 'percent' },
]

const shopeeKpis: Kpi[] = [
  { label: 'Faturamento', value: 'R$ 28.450', delta: '+9,4%', trend: 'up', icon: 'payments' },
  { label: 'Pedidos', value: '480', delta: '+6,1%', trend: 'up', icon: 'shopping_bag' },
  { label: 'Lucro Bruto', value: 'R$ 6.486', delta: '+11,2%', trend: 'up', icon: 'account_balance_wallet' },
  { label: 'Margem Média', value: '22,8%', delta: '+1,4%', trend: 'up', icon: 'percent' },
]

const todosKpis: Kpi[] = [
  { label: 'Faturamento', value: 'R$ 153.280', delta: '+11,8%', trend: 'up', icon: 'payments' },
  { label: 'Pedidos', value: '2.327', delta: '+7,7%', trend: 'up', icon: 'shopping_bag' },
  { label: 'Lucro Bruto', value: 'R$ 45.406', delta: '+14,4%', trend: 'up', icon: 'account_balance_wallet' },
  { label: 'Margem Média', value: '29,6%', delta: '-0,3%', trend: 'down', icon: 'percent' },
]

const mlRevenue: RevenueDay[] = [
  { day: 'Seg', faturamento: 14200, lucro: 4260 },
  { day: 'Ter', faturamento: 19800, lucro: 6930 },
  { day: 'Qua', faturamento: 16100, lucro: 4830 },
  { day: 'Qui', faturamento: 24900, lucro: 8715 },
  { day: 'Sex', faturamento: 21300, lucro: 7455 },
  { day: 'Sáb', faturamento: 30200, lucro: 12080 },
  { day: 'Dom', faturamento: 26700, lucro: 10680 },
]

const shopeeRevenue: RevenueDay[] = [
  { day: 'Seg', faturamento: 3200, lucro: 704 },
  { day: 'Ter', faturamento: 4800, lucro: 1056 },
  { day: 'Qua', faturamento: 3500, lucro: 770 },
  { day: 'Qui', faturamento: 5200, lucro: 1144 },
  { day: 'Sex', faturamento: 4100, lucro: 902 },
  { day: 'Sáb', faturamento: 6800, lucro: 1496 },
  { day: 'Dom', faturamento: 5400, lucro: 1188 },
]

const todosRevenue: RevenueDay[] = mlRevenue.map((d, i) => ({
  day: d.day,
  faturamento: d.faturamento + shopeeRevenue[i].faturamento,
  lucro: d.lucro + shopeeRevenue[i].lucro,
}))

const mlAlerts: Alert[] = [
  { icon: 'warning', tone: 'text-error', title: 'Estoque Crítico', body: 'Produto "Cadeira Gamer X" com menos de 5 unidades.', marketplace: 'ml' },
  { icon: 'info', tone: 'text-tertiary', title: 'Atraso de Envio', body: '2 pedidos da última terça-feira ainda não despachados.', marketplace: 'ml' },
  { icon: 'info', tone: 'text-tertiary', title: 'Mensagem de Cliente', body: 'Nova reclamação aberta no pedido #8923.', marketplace: 'ml' },
]

const shopeeAlerts: Alert[] = [
  { icon: 'warning', tone: 'text-error', title: 'Margem negativa Shopee', body: 'SKU SP-CABO-USBC-1M com margem -20,5% no pedido 2403214AB7K3E6.', marketplace: 'shopee' },
  { icon: 'info', tone: 'text-tertiary', title: 'Falha na entrega', body: 'Tracking BRSPX012345681 — destinatário ausente (Curitiba/PR).', marketplace: 'shopee' },
]

const mlHealthBars: HealthBar[] = [
  { label: 'Cancelamentos', current: '0,8%', limit: '2,5%', percent: 32, color: 'bg-secondary-container' },
  { label: 'Atraso', current: '2,1%', limit: '3,0%', percent: 70, color: 'bg-tertiary' },
  { label: 'Reclamações', current: '0,3%', limit: '1,0%', percent: 30, color: 'bg-secondary-container' },
]

const shopeeHealthBars: HealthBar[] = [
  { label: 'Penalty Points', current: '0', limit: '12', percent: 0, color: 'bg-secondary-container' },
  { label: 'Listing Violations', current: '0', limit: '5', percent: 0, color: 'bg-secondary-container' },
  { label: 'Cancelamentos', current: '2,1%', limit: '5,0%', percent: 42, color: 'bg-tertiary' },
]

const mlSystem: SystemRow[] = [
  { label: 'Sincronização Mercado Livre', when: 'Há 2 min', ok: true },
  { label: 'ERP Bling Sync', when: 'Há 5 min', ok: true },
  { label: 'Atualização de Preços', when: 'Há 1 min', ok: true },
  { label: 'Fila de Mensagens', when: 'Operacional', ok: true },
]

const shopeeSystem: SystemRow[] = [
  { label: 'Sync Pedidos Shopee', when: 'Há 3 min', ok: true },
  { label: 'Sync Anúncios Shopee', when: 'Há 12 min', ok: true },
  { label: 'Sync Envios Shopee', when: 'Há 4 min', ok: true },
  { label: 'Snapshot de Saúde Shopee', when: 'Bloqueado (permissão)', ok: false },
]

const dataMap: Record<Marketplace, DashboardData> = {
  'mercado-livre': {
    account: 'GRUPOLUZZOO',
    kpis: mlKpis,
    revenue: mlRevenue,
    healthTitle: 'Saúde da Conta — Mercado Livre',
    healthBars: mlHealthBars,
    systemStatus: mlSystem,
  },
  shopee: {
    account: 'shopee_227525603',
    kpis: shopeeKpis,
    revenue: shopeeRevenue,
    healthTitle: 'Saúde da Conta — Shopee',
    healthBars: shopeeHealthBars,
    healthLocked: {
      title: 'Account Health bloqueado',
      body: 'Workflow Snapshot Shopee aguardando aprovação Live e categoria do app. Métricas exibidas vêm de pedidos próprios.',
    },
    systemStatus: shopeeSystem,
  },
  todos: {
    account: 'Múltiplas contas (2)',
    kpis: todosKpis,
    revenue: todosRevenue,
    healthTitle: 'Saúde Consolidada',
    healthBars: mlHealthBars,
    healthLocked: {
      title: 'Visão consolidada parcial',
      body: 'Métricas exibidas são da conta ML. Saúde Shopee não disponível enquanto app não for aprovado em Live.',
    },
    systemStatus: [...mlSystem, ...shopeeSystem],
  },
}

const marketplaces: { key: Marketplace; label: string; icon: string; accent: string }[] = [
  { key: 'mercado-livre', label: 'Mercado Livre', icon: 'storefront', accent: 'text-primary' },
  { key: 'shopee',        label: 'Shopee',        icon: 'storefront', accent: 'text-tertiary' },
  { key: 'todos',         label: 'Todos',         icon: 'apps',       accent: 'text-secondary' },
]

function MarketplaceToggle({ value, onChange }: { value: Marketplace; onChange: (m: Marketplace) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-white/10 bg-surface-container/60 p-1 backdrop-blur-md">
      {marketplaces.map((m) => {
        const active = value === m.key
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              active ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white',
            )}
            aria-pressed={active}
          >
            <span className={cn('material-symbols-outlined text-[16px]', active ? m.accent : '')}>
              {m.icon}
            </span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const [marketplace, setMarketplace] = useState<Marketplace>('mercado-livre')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'mercado-livre' || stored === 'shopee' || stored === 'todos') {
      setMarketplace(stored)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, marketplace)
  }, [marketplace, hydrated])

  const data = dataMap[marketplace]
  const alerts = useMemo<Alert[]>(() => {
    if (marketplace === 'mercado-livre') return mlAlerts
    if (marketplace === 'shopee') return shopeeAlerts
    return [...mlAlerts, ...shopeeAlerts]
  }, [marketplace])

  const subtitle =
    marketplace === 'mercado-livre' ? 'Últimos 7 dias · ML · BRL'
      : marketplace === 'shopee'    ? 'Últimos 7 dias · Shopee · BRL'
      :                                 'Últimos 7 dias · Todos · BRL'

  const accentClass =
    marketplace === 'mercado-livre' ? 'text-primary'
      : marketplace === 'shopee'    ? 'text-tertiary'
      :                                 'text-secondary'

  return (
    <>
      <TopBar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-lg">
        <div className="max-w-[1200px] mx-auto space-y-lg pb-xl">
          <div className="flex flex-wrap items-end justify-between gap-md">
            <div>
              <h2 className="font-h1 text-h1 text-white mb-1 flex items-center gap-sm">
                Bom dia, Pedro
                <span className={cn('text-sm font-normal', accentClass)}>·</span>
                <span className={cn('text-sm font-medium', accentClass)}>{marketplaces.find((m) => m.key === marketplace)?.label}</span>
              </h2>
              <p className="font-body-md text-body-md text-slate-400 flex items-center gap-2">
                Últimos 30 dias <span className="w-1 h-1 rounded-full bg-slate-600" /> conta {data.account}
              </p>
            </div>
            <MarketplaceToggle value={marketplace} onChange={setMarketplace} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {data.kpis.map((kpi) => (
              <div key={kpi.label} className="glass-card rounded-xl p-lg flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <span className="font-label-md text-label-md text-slate-400 uppercase tracking-wider">
                    {kpi.label}
                  </span>
                  <span className="material-symbols-outlined text-slate-500 text-[20px]">
                    {kpi.icon}
                  </span>
                </div>
                <div>
                  <div className="font-display text-display text-white mb-1">{kpi.value}</div>
                  <div
                    className={cn(
                      'flex items-center gap-1',
                      kpi.trend === 'up' ? 'text-secondary-container' : 'text-error',
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {kpi.trend === 'up' ? 'trending_up' : 'trending_down'}
                    </span>
                    <span className="font-label-md text-label-md">{kpi.delta}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-gutter">
            <RevenueChart data={data.revenue} subtitle={subtitle} />

            <div className="glass-card rounded-xl lg:w-[35%] flex flex-col">
              <div className="p-lg border-b border-white/10 flex justify-between items-center">
                <h3 className="font-h3 text-h3 text-white">Alertas Ativos</h3>
                {alerts.length > 0 && (
                  <span className="bg-error/10 text-error font-label-md text-label-md px-2 py-1 rounded">
                    {alerts.length} {alerts.length === 1 ? 'Novo' : 'Novos'}
                  </span>
                )}
              </div>
              <div className="p-lg flex flex-col gap-4">
                {alerts.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <span className="material-symbols-outlined text-2xl text-secondary">check_circle</span>
                    <span className="text-sm text-slate-400">Sem alertas ativos.</span>
                  </div>
                ) : (
                  alerts.map((a, i) => (
                    <div
                      key={i}
                      className="bg-surface-container-high border border-white/5 p-4 rounded-lg flex items-start gap-3"
                    >
                      <span className={`material-symbols-outlined ${a.tone} mt-0.5`}>{a.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-label-md text-label-md text-white">{a.title}</div>
                          {marketplace === 'todos' && (
                            <span className={cn(
                              'rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider',
                              a.marketplace === 'ml' ? 'bg-primary/15 text-primary' : 'bg-tertiary/15 text-tertiary',
                            )}>
                              {a.marketplace === 'ml' ? 'ML' : 'Shopee'}
                            </span>
                          )}
                        </div>
                        <div className="font-body-md text-body-md text-slate-400 mt-1">{a.body}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <div className="glass-card rounded-xl flex flex-col">
              <div className="p-lg border-b border-white/10">
                <h3 className="font-h3 text-h3 text-white">{data.healthTitle}</h3>
              </div>
              <div className="p-lg flex flex-col gap-6">
                {data.healthLocked && (
                  <div className="flex items-start gap-2 rounded-lg border border-tertiary/30 bg-tertiary/5 p-3">
                    <span className="material-symbols-outlined text-tertiary text-[18px] mt-0.5">lock</span>
                    <div>
                      <p className="text-xs font-medium text-tertiary">{data.healthLocked.title}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{data.healthLocked.body}</p>
                    </div>
                  </div>
                )}
                {data.healthBars.map((h) => (
                  <div key={h.label}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-label-md text-label-md text-slate-300">{h.label}</span>
                      <span className="font-label-md text-label-md text-white">
                        {h.current} <span className="text-slate-500">/ {h.limit}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={`h-full ${h.color} rounded-full`} style={{ width: `${h.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl flex flex-col">
              <div className="p-lg border-b border-white/10">
                <h3 className="font-h3 text-h3 text-white">Status do Sistema</h3>
              </div>
              <div className="p-lg flex flex-col gap-4">
                {data.systemStatus.map((s, i) => (
                  <div
                    key={`${s.label}-${i}`}
                    className={cn(
                      'flex items-center justify-between',
                      i < data.systemStatus.length - 1 && 'pb-4 border-b border-white/5',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          s.ok ? 'bg-secondary-container' : 'bg-tertiary',
                        )}
                        style={{
                          boxShadow: s.ok
                            ? '0 0 8px rgba(0,189,133,0.5)'
                            : '0 0 8px rgba(250,204,60,0.5)',
                        }}
                      />
                      <span className="font-body-md text-body-md text-slate-300">{s.label}</span>
                    </div>
                    <span
                      className={cn(
                        'font-mono-sm text-mono-sm',
                        s.ok ? 'text-slate-500' : 'text-tertiary',
                      )}
                    >
                      {s.when}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
