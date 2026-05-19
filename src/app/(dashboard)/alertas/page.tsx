import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

type AlertSeverity = 'critical' | 'warning' | 'info'

type Alert = {
  id: string
  severity: AlertSeverity
  title: string
  description?: string
  time: string
  unread?: boolean
  expanded?: boolean
}

type Group = { label: string; items: Alert[] }

const groups: Group[] = [
  {
    label: 'Hoje',
    items: [
      {
        id: '1',
        severity: 'critical',
        title: 'Prazo de entrega vencido',
        description:
          'O pedido #48291 para "Cliente VIP SA" excedeu o prazo de postagem de 24 horas estipulado pela plataforma. Risco de penalização na métrica de envio rápido.',
        time: 'há 1h',
        unread: true,
        expanded: true,
      },
      { id: '2', severity: 'critical', title: 'Estoque zerado: Cabo USB-C 2m', time: 'há 3h', unread: true },
    ],
  },
  {
    label: 'Ontem',
    items: [
      { id: '3', severity: 'warning', title: 'Margem abaixo de 10%: Carregador Wireless', time: 'Ontem, 14:30' },
    ],
  },
  {
    label: 'Esta Semana',
    items: [{ id: '4', severity: 'info', title: 'Sync de pedidos concluído', time: 'Segunda, 08:00' }],
  },
]

const severityConfig: Record<
  AlertSeverity,
  { bar: string; iconColor: string; iconName: string; filled: boolean }
> = {
  critical: { bar: 'bg-error', iconColor: 'text-error', iconName: 'error', filled: true },
  warning: { bar: 'bg-tertiary', iconColor: 'text-tertiary', iconName: 'warning', filled: false },
  info: { bar: 'bg-[#3b82f6]', iconColor: 'text-[#3b82f6]', iconName: 'info', filled: false },
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: string
  tone?: 'critical' | 'warning' | 'info' | 'neutral'
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-l-2 border-l-error'
      : tone === 'warning'
        ? 'border-l-2 border-l-tertiary'
        : tone === 'info'
          ? 'border-l-2 border-l-[#3b82f6]'
          : ''
  const labelColor =
    tone === 'critical'
      ? 'text-error'
      : tone === 'warning'
        ? 'text-tertiary'
        : tone === 'info'
          ? 'text-[#3b82f6]'
          : 'text-slate-400'
  const iconColor = labelColor

  return (
    <div className={`glass-card flex h-[120px] flex-col justify-between rounded-xl p-lg ${toneClass}`}>
      <div className="flex items-start justify-between">
        <span className={`text-xs font-medium uppercase tracking-wider ${labelColor}`}>{label}</span>
        <Icon name={icon} filled={tone !== 'neutral' && tone !== undefined} className={iconColor} />
      </div>
      <div className="text-[36px] font-bold leading-none text-white">{value}</div>
    </div>
  )
}

function AlertItem({ alert }: { alert: Alert }) {
  const cfg = severityConfig[alert.severity]
  const opacity = !alert.unread && !alert.expanded ? 'opacity-80' : ''

  if (alert.expanded) {
    return (
      <div className="glass-card group relative overflow-hidden rounded-xl p-lg">
        <div className={`absolute bottom-0 left-0 top-0 w-1 ${cfg.bar}`} />
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="relative mr-4 mt-1">
              <Icon name={cfg.iconName} filled={cfg.filled} className={cfg.iconColor} />
              {alert.unread ? (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0d1117] bg-[#3b82f6]" />
              ) : null}
            </div>
            <div>
              <h4 className="mb-1 flex items-center text-base font-semibold text-white">
                {alert.title}
                <span className="ml-2 text-xs text-slate-400">{alert.time}</span>
              </h4>
              {alert.description ? (
                <p className="mb-4 max-w-3xl text-sm leading-relaxed text-slate-300">{alert.description}</p>
              ) : null}
              <div className="flex gap-sm">
                <button className="rounded-lg bg-[#3b82f6] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2563eb]">
                  Resolver
                </button>
                <button className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/5">
                  Marcar lido
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`glass-card relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl p-md transition-colors hover:bg-white/5 ${opacity}`}
    >
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${cfg.bar}`} />
      <div className="flex items-center">
        <div className="relative mr-4">
          <Icon name={cfg.iconName} filled={cfg.filled} className={cfg.iconColor} />
          {alert.unread ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#0d1117] bg-[#3b82f6]" />
          ) : null}
        </div>
        <h4 className={alert.unread ? 'text-base font-semibold text-white' : 'text-base text-slate-300'}>
          {alert.title}
        </h4>
      </div>
      <span className={alert.unread ? 'text-xs text-slate-400' : 'text-xs text-slate-500'}>{alert.time}</span>
    </div>
  )
}

export default function AlertasPage() {
  return (
    <>
      <TopBar title="Alertas & Notificações" />
      <main className="overflow-y-auto p-margin">
        <div className="mb-xl flex items-end justify-between">
          <div>
            <h2 className="mb-2 text-[36px] font-bold leading-tight text-white">Alertas &amp; Notificações</h2>
            <p className="text-base text-slate-400">Monitore e resolva anomalias do sistema e eventos de negócio.</p>
          </div>
        </div>

        <div className="mb-xl grid grid-cols-2 gap-gutter md:grid-cols-4">
          <SummaryCard label="Total Ativos" value={8} icon="notifications" tone="neutral" />
          <SummaryCard label="Críticos" value={2} icon="error" tone="critical" />
          <SummaryCard label="Avisos" value={4} icon="warning" tone="warning" />
          <SummaryCard label="Informações" value={2} icon="info" tone="info" />
        </div>

        <div className="glass-card mb-lg flex items-center justify-between rounded-xl p-md">
          <div className="flex items-center gap-md">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
              <input
                className="w-[280px] rounded-lg border border-white/10 bg-[#050507] py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                placeholder="Buscar alertas..."
              />
            </div>
            <select className="appearance-none rounded-lg border border-white/10 bg-[#050507] px-4 py-2 pr-8 text-sm text-white outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]">
              <option>Severidade: Todas</option>
              <option>Crítico</option>
              <option>Aviso</option>
              <option>Info</option>
            </select>
            <select className="appearance-none rounded-lg border border-white/10 bg-[#050507] px-4 py-2 pr-8 text-sm text-white outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]">
              <option>Status: Não Lidos</option>
              <option>Todos</option>
              <option>Lidos</option>
            </select>
          </div>
          <button className="flex items-center rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5">
            <Icon name="done_all" size={18} className="mr-2" />
            Marcar todos como lidos
          </button>
        </div>

        <div className="space-y-xl">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-md pl-2 text-xs font-medium uppercase tracking-widest text-slate-500">
                {group.label}
              </h3>
              <div className="space-y-sm">
                {group.items.map((alert) => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
