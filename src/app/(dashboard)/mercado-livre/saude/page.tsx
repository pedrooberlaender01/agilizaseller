import { TopBar } from '@/components/top-bar'
import { Icon } from '@/components/icon'

type Metric = {
  label: string
  value: string
  unit?: string
  limit: string
  pct: number
  tone: 'secondary' | 'tertiary' | 'error'
  alert?: boolean
}

const metrics: Metric[] = [
  { label: 'Cancelamentos', value: '0,8', unit: '%', limit: 'Limite: 3,0%', pct: 26, tone: 'secondary' },
  { label: 'Atraso no Envio', value: '12,4', unit: '%', limit: 'Limite: 15,0%', pct: 82, tone: 'tertiary', alert: true },
  { label: 'Reclamações', value: '0,3', unit: '%', limit: 'Limite: 2,0%', pct: 15, tone: 'secondary' },
]

function MetricCard({ m }: { m: Metric }) {
  const valueColor = m.tone === 'tertiary' ? 'text-tertiary' : 'text-white'
  const barColor =
    m.tone === 'tertiary' ? 'bg-tertiary' : m.tone === 'error' ? 'bg-error' : 'bg-secondary'
  const labelColor = m.alert ? 'text-tertiary font-bold' : 'text-outline'

  return (
    <div className="glass-card relative flex flex-col justify-between overflow-hidden p-lg">
      {m.alert ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-tertiary/20" />
          <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 -translate-y-1/2 translate-x-1/2 rounded-full bg-tertiary/10 blur-[40px]" />
        </>
      ) : null}

      <div className="relative z-10 mb-4 flex items-start justify-between">
        <h3 className={`text-xs font-medium uppercase tracking-wider ${labelColor}`}>{m.label}</h3>
        <Icon
          name={m.alert ? 'warning' : 'check_circle'}
          filled={m.alert}
          size={14}
          className={m.alert ? 'text-tertiary' : 'text-secondary'}
        />
      </div>
      <div className="relative z-10">
        <div className="mb-1 flex items-baseline gap-2">
          <span className={`text-[32px] font-bold leading-none ${valueColor}`}>{m.value}</span>
          <span className="text-sm text-outline">{m.unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${m.pct}%` }} />
          </div>
          <span className="whitespace-nowrap text-xs text-outline">{m.limit}</span>
        </div>
      </div>
    </div>
  )
}

function ReputationCard() {
  return (
    <div className="glass-card relative flex flex-col justify-between overflow-hidden p-lg">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/10 blur-[80px]" />
      <div className="relative z-10">
        <div className="mb-6 flex items-center gap-2">
          <Icon name="verified" className="text-secondary" />
          <h3 className="text-base font-semibold text-white">Reputação</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-4">
          <div className="relative mb-4 h-[80px] w-[160px]">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 160 80">
              <defs>
                <linearGradient id="gauge-grad" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <path
                d="M 10 80 A 70 70 0 0 1 150 80"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeLinecap="round"
                strokeWidth="12"
              />
              <path
                d="M 10 80 A 70 70 0 0 1 142 28"
                fill="none"
                stroke="url(#gauge-grad)"
                strokeLinecap="round"
                strokeWidth="12"
              />
            </svg>
            <div className="absolute bottom-0 left-0 w-full translate-y-2 text-center">
              <span className="text-[32px] font-bold leading-none text-secondary">87</span>
              <span className="text-base text-outline">/100</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-4 py-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">Verde Platinum</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryChart() {
  return (
    <div className="glass-card col-span-12 flex flex-col p-0">
      <div className="flex items-center justify-between border-b border-white/8 p-lg">
        <div className="flex items-center gap-2">
          <Icon name="show_chart" className="text-outline-variant" />
          <h3 className="text-base font-semibold text-white">Histórico de Infrações (30 Dias)</h3>
        </div>
        <div className="flex gap-4">
          {[
            { color: 'bg-secondary', label: 'Cancelamentos' },
            { color: 'bg-tertiary', label: 'Atrasos' },
            { color: 'bg-[#3b82f6]', label: 'Reclamações' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${l.color}`} />
              <span className="text-xs text-outline">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative h-[240px] p-lg">
        <div className="absolute inset-x-lg bottom-lg top-lg flex flex-col justify-between border-b border-l border-white/5 pb-6 pl-4">
          {['15%', '10%', '5%', '0%'].map((label, i) => (
            <div
              key={label}
              className={`relative w-full ${i === 3 ? 'border-t border-white/10' : 'border-t border-dashed border-white/10'}`}
            >
              <span className="absolute -left-8 -top-2 text-xs text-outline-variant">{label}</span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 flex justify-between px-4 text-xs text-outline-variant">
            {['01/04', '05/04', '10/04', '15/04', '20/04', '25/04', '30/04'].map((d) => (
              <span key={d} className={d === '20/04' ? 'text-white' : ''}>
                {d}
              </span>
            ))}
          </div>
        </div>
        <svg
          className="absolute inset-x-lg bottom-[48px] top-lg ml-4 h-[calc(100%-48px)] w-[calc(100%-48px)]"
          preserveAspectRatio="none"
          viewBox="0 0 1000 100"
        >
          <line opacity="0.3" stroke="#fbbf24" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="20" y2="20" />
          <line opacity="0.3" stroke="#34d399" strokeDasharray="4" strokeWidth="1" x1="0" x2="1000" y1="80" y2="80" />
          <path
            d="M 0 60 L 100 50 L 200 65 L 300 40 L 400 45 L 500 30 L 600 25 L 700 20 L 800 35 L 900 40 L 1000 30"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
          />
          <path
            d="M 0 95 L 100 92 L 200 90 L 300 94 L 400 96 L 500 95 L 600 92 L 700 94 L 800 93 L 900 91 L 1000 95"
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
          />
          <path
            d="M 0 98 L 100 97 L 200 99 L 300 98 L 400 97 L 500 99 L 600 98 L 700 96 L 800 98 L 900 99 L 1000 97"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          <line opacity="0.2" stroke="#ffffff" strokeDasharray="4" strokeWidth="1" x1="700" x2="700" y1="0" y2="100" />
          <circle cx="700" cy="20" fill="#051424" r="4" stroke="#fbbf24" strokeWidth="2" />
          <circle cx="700" cy="94" fill="#051424" r="4" stroke="#34d399" strokeWidth="2" />
          <circle cx="700" cy="96" fill="#051424" r="4" stroke="#3b82f6" strokeWidth="2" />
        </svg>
      </div>
    </div>
  )
}

function VolumeCard() {
  return (
    <div className="glass-card flex flex-col p-0">
      <div className="flex items-center gap-2 border-b border-white/8 p-lg">
        <Icon name="receipt_long" className="text-outline-variant" />
        <h3 className="text-base font-semibold text-white">Volume de Transações (60d)</h3>
      </div>
      <div className="flex flex-col gap-4 p-lg">
        {[
          { color: 'bg-secondary/10', icon: 'done_all', iconColor: 'text-secondary', label: 'Completadas', value: '1.488' },
          { color: 'bg-error/10', icon: 'cancel', iconColor: 'text-error', label: 'Canceladas', value: '12' },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-surface-container/50 p-3"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded ${row.color}`}>
                <Icon name={row.icon} size={14} className={row.iconColor} />
              </div>
              <span className="text-sm text-white">{row.label}</span>
            </div>
            <span className="font-mono text-xs font-bold text-white">{row.value}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-surface-container-highest p-3">
          <span className="text-xs font-medium uppercase tracking-wider text-outline">Total Apurado</span>
          <span className="font-mono text-xs font-bold text-[#3b82f6]">1.500</span>
        </div>
      </div>
    </div>
  )
}

function RatingsCard() {
  return (
    <div className="glass-card flex flex-col p-0">
      <div className="flex items-center gap-2 border-b border-white/8 p-lg">
        <Icon name="star_rate" className="text-outline-variant" />
        <h3 className="text-base font-semibold text-white">Avaliações</h3>
      </div>
      <div className="flex h-full flex-col justify-center p-lg">
        <div className="mb-6">
          <div className="mb-2 flex items-end justify-between">
            <span className="text-[36px] font-bold leading-none text-white">
              4.8<span className="text-base text-outline">/5</span>
            </span>
            <span className="text-sm text-outline">Baseado em 842 avaliações</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full bg-secondary" style={{ width: '92%' }} />
            <div className="h-full bg-tertiary" style={{ width: '5%' }} />
            <div className="h-full bg-error" style={{ width: '3%' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { color: 'bg-secondary', label: 'Positivas', value: '92%' },
            { color: 'bg-tertiary', label: 'Neutras', value: '5%' },
            { color: 'bg-error', label: 'Negativas', value: '3%' },
          ].map((r) => (
            <div key={r.label} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-sm ${r.color}`} />
                <span className="text-xs text-outline">{r.label}</span>
              </div>
              <span className="font-mono text-xs text-white">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SaudePage() {
  return (
    <>
      <TopBar title="Saúde da Conta" />
      <main className="flex-1 space-y-gutter p-margin">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h1 className="mb-1 text-[36px] font-bold leading-tight text-white">Saúde da Conta</h1>
            <p className="text-sm text-outline">
              Monitore a reputação e métricas operacionais para manter alta performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-surface-container px-3 py-1 text-xs text-outline">
              Última atualização: Hoje, 09:41
            </span>
            <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-container-highest px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/5">
              <Icon name="download" size={14} />
              Exportar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-gutter">
          <div className="col-span-12 lg:col-span-4">
            <ReputationCard />
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-gutter md:grid-cols-3 lg:col-span-8">
            {metrics.map((m) => (
              <MetricCard key={m.label} m={m} />
            ))}
          </div>

          <HistoryChart />

          <div className="col-span-12 grid grid-cols-1 gap-gutter md:grid-cols-2">
            <VolumeCard />
            <RatingsCard />
          </div>
        </div>
      </main>
    </>
  )
}
