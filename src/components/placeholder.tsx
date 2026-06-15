import { TopBar } from './top-bar'

export function Placeholder({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle: string
  icon: string
}) {
  return (
    <>
      <TopBar title={title} />
      <main className="flex flex-1 items-center justify-center p-10">
        <div className="glass-card flex max-w-md flex-col items-center gap-4 rounded-xl p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="text-[14px] text-slate-400">{subtitle}</p>
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[12px] font-medium text-blue-200">
            Em breve
          </span>
        </div>
      </main>
    </>
  )
}
