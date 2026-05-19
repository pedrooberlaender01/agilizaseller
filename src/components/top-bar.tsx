type TopBarProps = {
  title?: string
  showSearch?: boolean
  userName?: string
  userRole?: string
}

export function TopBar({
  title,
  showSearch = false,
  userName = 'Usuário',
  userRole = 'Usuário',
}: TopBarProps) {
  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  return (
    <header className="flex items-center justify-between h-14 px-10 sticky top-0 z-40 bg-[#0d1117]/80 backdrop-blur-xl border-b border-white/10 font-inter text-sm antialiased w-full shrink-0">
      <div className="flex items-center gap-4">
        {title && <h1 className="font-h3 text-h3 text-white">{title}</h1>}
        {showSearch && (
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar pedidos, anúncios..."
              className="bg-surface-container-high/50 border border-white/10 text-on-surface rounded-lg pl-9 pr-4 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none w-64 font-body-md transition-colors placeholder:text-slate-500"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-md">
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/5 hover:text-white transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-xl">notifications</span>
        </button>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/5 hover:text-white transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-xl">settings</span>
        </button>
        <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white/5 hover:text-white transition-colors active:scale-95 duration-150">
          <span className="material-symbols-outlined text-xl">help</span>
        </button>
        <div className="w-px h-6 bg-white/10 mx-2" />
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="font-label-md text-label-md text-white">{userName}</div>
            <div className="font-mono-sm text-mono-sm text-slate-400">{userRole}</div>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-blue-500/20 text-blue-300 text-[13px] font-semibold flex items-center justify-center">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
