'use client'

import { useState } from 'react'
import { TopBar } from '@/components/top-bar'
import { MetricsChart, type Period } from '@/components/metrics-chart'

const periods: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'mes', label: 'Este Mês' },
]

const kpis = [
  { label: 'Faturamento', value: 'R$ 142.850,00', delta: '+12.5%', trend: 'up' as const, icon: 'payments', iconClass: 'text-primary', valueClass: 'text-on-surface' },
  { label: 'Pedidos', value: '2.114', delta: '+8.2%', trend: 'up' as const, icon: 'local_shipping', iconClass: 'text-tertiary', valueClass: 'text-on-surface' },
  { label: 'Lucro Líquido', value: 'R$ 38.560,00', delta: '+15.3%', trend: 'up' as const, icon: 'account_balance_wallet', iconClass: 'text-secondary', valueClass: 'text-secondary-fixed' },
  { label: 'Ticket Médio', value: 'R$ 67,59', delta: '-0.5%', trend: 'flat' as const, icon: 'receipt_long', iconClass: 'text-primary-fixed-dim', valueClass: 'text-on-surface' },
  { label: 'Margem Média', value: '27,0%', delta: '+2.1%', trend: 'up' as const, icon: 'pie_chart', iconClass: 'text-secondary-container', valueClass: 'text-on-surface' },
  { label: 'Cancelamentos', value: '1,4%', delta: '-0.3%', trend: 'down' as const, icon: 'remove_shopping_cart', iconClass: 'text-error', valueClass: 'text-on-surface' },
]

type MargemTone = 'great' | 'good' | 'warn'
type Row = {
  date: string
  pedidos: number
  cancel: number
  fat: string
  taxas: string
  lucro: string
  margem: string
  margemTone: MargemTone
  cancelTone: 'normal' | 'warn'
  lucroTone: 'normal' | 'good'
}

const rows: Row[] = [
  { date: '30/04', pedidos: 82, cancel: 1, fat: '5.542,00', taxas: '1.108,40', lucro: '1.496,34', margem: '27.0%', margemTone: 'good', cancelTone: 'warn', lucroTone: 'good' },
  { date: '29/04', pedidos: 76, cancel: 0, fat: '5.136,50', taxas: '1.027,30', lucro: '1.438,22', margem: '28.0%', margemTone: 'great', cancelTone: 'normal', lucroTone: 'good' },
  { date: '28/04', pedidos: 91, cancel: 2, fat: '6.150,00', taxas: '1.230,00', lucro: '1.537,50', margem: '25.0%', margemTone: 'warn', cancelTone: 'warn', lucroTone: 'good' },
  { date: '27/04', pedidos: 65, cancel: 1, fat: '4.393,00', taxas: '878,60', lucro: '1.010,39', margem: '23.0%', margemTone: 'warn', cancelTone: 'normal', lucroTone: 'normal' },
  { date: '26/04', pedidos: 88, cancel: 3, fat: '5.948,00', taxas: '1.189,60', lucro: '1.665,44', margem: '28.0%', margemTone: 'great', cancelTone: 'warn', lucroTone: 'good' },
]

const margemBadge: Record<MargemTone, string> = {
  great: 'bg-primary/10 text-primary-fixed border border-primary/20',
  good: 'bg-secondary/10 text-secondary border border-secondary/20',
  warn: 'bg-tertiary/10 text-tertiary-fixed border border-tertiary/20',
}

const margemDist = [
  { label: 'Excelente (> 30%)', value: '42% dos pedidos', percent: 42, color: 'bg-primary-fixed' },
  { label: 'Boa (20% - 30%)', value: '35% dos pedidos', percent: 35, color: 'bg-secondary' },
  { label: 'Média (10% - 20%)', value: '15% dos pedidos', percent: 15, color: 'bg-tertiary' },
  { label: 'Baixa (0% - 10%)', value: '5% dos pedidos', percent: 5, color: 'bg-error-container' },
  { label: 'Prejuízo (< 0%)', value: '3% dos pedidos', percent: 3, color: 'bg-error' },
]

export default function MetricasPage() {
  const [period, setPeriod] = useState<Period>('30d')

  return (
    <>
      <TopBar showSearch />
      <div className="p-margin flex flex-col gap-gutter flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-h1 text-h1 text-on-surface flex items-center gap-sm">
              Métricas
              <span className="text-outline font-normal">—</span>
              <span className="text-primary-fixed">Mercado Livre</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Overview de performance e rentabilidade da conta.
            </p>
          </div>

          <div className="flex items-center bg-surface-container-high/50 backdrop-blur-md rounded-lg p-1 border border-white/10">
            {periods.map((p) => {
              const active = period === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`px-4 py-1.5 rounded-md font-label-md text-label-md transition-colors ${
                    active
                      ? 'bg-primary-container text-on-primary-container shadow-sm border border-primary/20'
                      : 'text-on-surface-variant hover:text-on-surface border border-transparent'
                  }`}
                  aria-pressed={active}
                >
                  {p.label}
                </button>
              )
            })}
            <button
              type="button"
              className="px-2 py-1.5 rounded-md text-on-surface-variant hover:text-on-surface flex items-center justify-center border-l border-white/10 ml-1 pl-3"
              aria-label="Selecionar intervalo"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-2 relative overflow-hidden group hover:bg-surface-container/90 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                  {kpi.label}
                </span>
                <span className={`material-symbols-outlined ${kpi.iconClass} text-lg`}>
                  {kpi.icon}
                </span>
              </div>
              <div className={`font-h2 text-h2 ${kpi.valueClass}`}>{kpi.value}</div>
              <div
                className={`flex items-center gap-1 font-label-md text-label-md ${
                  kpi.trend === 'flat' ? 'text-outline' : 'text-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {kpi.trend === 'up' ? 'trending_up' : kpi.trend === 'down' ? 'trending_down' : 'trending_flat'}
                </span>
                <span>{kpi.delta}</span>
                <span className="text-outline ml-1 text-[10px]">vs ant.</span>
              </div>
            </div>
          ))}
        </div>

        <MetricsChart period={period} />

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-gutter">
          <div className="lg:col-span-6 bg-surface-container/70 backdrop-blur-[16px] rounded-xl border border-white/10 flex flex-col overflow-hidden">
            <div className="p-lg border-b border-white/10 flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-surface">Dados Diários</h3>
              <button className="font-label-md text-label-md text-primary flex items-center gap-1 hover:text-primary-fixed transition-colors">
                Exportar
                <span className="material-symbols-outlined text-[16px]">download</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-label-md text-label-md whitespace-nowrap">
                <thead className="bg-surface-container-high/30">
                  <tr>
                    <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px]">
                      Data
                    </th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">
                      Pedidos
                    </th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">
                      Canc.
                    </th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">
                      Fat. (R$)
                    </th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">
                      Taxas (R$)
                    </th>
                    <th className="px-md py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">
                      Lucro (R$)
                    </th>
                    <th className="px-lg py-3 text-on-surface-variant font-medium uppercase tracking-wider text-[11px] text-right">
                      Margem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((r) => (
                    <tr key={r.date} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-lg py-3 text-on-surface">{r.date}</td>
                      <td className="px-md py-3 text-on-surface-variant text-right">{r.pedidos}</td>
                      <td
                        className={`px-md py-3 text-right ${
                          r.cancelTone === 'warn' ? 'text-error' : 'text-on-surface-variant'
                        }`}
                      >
                        {r.cancel}
                      </td>
                      <td className="px-md py-3 text-on-surface text-right font-mono-sm">{r.fat}</td>
                      <td className="px-md py-3 text-on-surface-variant text-right font-mono-sm">
                        {r.taxas}
                      </td>
                      <td
                        className={`px-md py-3 text-right font-mono-sm ${
                          r.lucroTone === 'good' ? 'text-secondary' : 'text-on-surface-variant'
                        }`}
                      >
                        {r.lucro}
                      </td>
                      <td className="px-lg py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            margemBadge[r.margemTone]
                          }`}
                        >
                          {r.margem}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-white/10 text-center">
              <button className="font-label-md text-label-md text-outline hover:text-on-surface transition-colors">
                Ver histórico completo
              </button>
            </div>
          </div>

          <div className="lg:col-span-4 bg-surface-container/70 backdrop-blur-[16px] rounded-xl p-lg border border-white/10 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-surface">Distribuição de Margem</h3>
              <span className="material-symbols-outlined text-outline-variant">info</span>
            </div>
            <div className="flex flex-col gap-5 flex-1 justify-center">
              {margemDist.map((m) => (
                <div key={m.label} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between font-label-md text-label-md">
                    <span className="text-on-surface flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${m.color}`} /> {m.label}
                    </span>
                    <span className="text-on-surface-variant">{m.value}</span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
