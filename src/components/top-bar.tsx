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
    <header className="flex items-center justify-between h-16 px-8 sticky top-0 z-40 bg-[#0a0a0c]/95 backdrop-blur-md border-b border-zinc-800 font-sans text-sm antialiased w-full shrink-0">
      <div className="flex items-center gap-4">
        {title && <h1 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h1>}
        {showSearch && (
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar pedidos, anúncios..."
              className="bg-zinc-900 border border-zinc-800 text-zinc-50 rounded-lg pl-10 pr-4 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none w-72 transition-colors placeholder:text-zinc-500"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-50 transition-colors duration-150">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-50 transition-colors duration-150">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </button>
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-50 transition-colors duration-150">
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
        </button>
        <div className="w-px h-6 bg-zinc-800 mx-2" />
        <div className="flex items-center gap-3 pl-1">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-zinc-50 leading-tight">{userName}</div>
            <div className="text-xs text-zinc-500 leading-tight">{userRole}</div>
          </div>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-500 text-white text-sm font-semibold flex items-center justify-center">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
