import { TopBar } from '@/components/top-bar'
import { KpiCard } from '../_ui'

// Estrutura espelhando /shopee/anuncios (aba Ads). Dados TikTok Ads ainda não integrados.
const ADS_KPIS = [
  'Saldo Conta Ads', 'Gasto Período', 'GMV Via Ads', 'ROAS Global', 'ACOS Global', '% Vendas via Ads',
  'Impressões', 'Visitantes (Cliques)', 'CTR', 'Conversão Ampla', 'Conversão Direta', 'Custo / Conversão',
]
const COMPARATIVO = ['Faturamento Bruto', 'GMV via Ads', 'Gasto em Ads', 'Lucro Líquido']

export default function TiktokAnunciosPage() {
  return (
    <>
      <TopBar title="Anúncios — TikTok Shop" />
      <main className="overflow-y-auto p-margin">
        {/* Tabs */}
        <div className="mb-lg flex items-center gap-1 border-b border-zinc-800">
          <span className="border-b-2 border-white px-3 pb-2 text-sm font-medium text-white">Ads</span>
          <span className="px-3 pb-2 text-sm font-medium text-zinc-500">Anúncios (catálogo → ver Produtos)</span>
        </div>

        {/* Hero resumo de ontem */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-5">
          {['Investido', 'Vendido (GMV Ads)', 'Pedidos Ads', 'ROAS', '% sobre Bruto'].map((l) => (
            <KpiCard key={l} label={l} value="—" soon />
          ))}
        </div>

        {/* KPIs período */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {ADS_KPIS.map((l) => (
            <KpiCard key={l} label={l} value="—" soon />
          ))}
        </div>

        {/* Comparativo */}
        <div className="mb-lg grid grid-cols-2 gap-4 md:grid-cols-4">
          {COMPARATIVO.map((l) => (
            <KpiCard key={l} label={l} value="—" soon />
          ))}
        </div>

        {/* Tabela de campanhas (vazia) */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-white/10 p-lg">
            <h3 className="font-h3 text-h3 text-white">Campanhas</h3>
            <p className="font-mono-sm text-mono-sm uppercase tracking-[0.18em] text-slate-500">TikTok Ads API — não integrado</p>
          </div>
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-3xl text-zinc-600">campaign</span>
            <p className="text-sm text-zinc-500">Integração de Ads pendente.</p>
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-200">Em breve</span>
          </div>
        </div>
      </main>
    </>
  )
}
