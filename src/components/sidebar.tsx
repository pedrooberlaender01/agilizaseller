'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { cn } from '@/lib/utils'
import { MarketplaceLogo } from '@/components/marketplace-logo'

type NavLink = { href: string; label: string; icon: string }
type NavGroup = { label: string; icon: string; basePath: string; children: NavLink[]; disabled?: boolean; brand?: string }
type NavItem = NavLink | NavGroup

const isGroup = (item: NavItem): item is NavGroup => 'children' in item

const baseNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/metricas', label: 'Métricas', icon: 'monitoring' },
  { href: '/pedidos', label: 'Pedidos', icon: 'receipt_long' },
  { href: '/envios', label: 'Envios', icon: 'local_shipping' },
  {
    label: 'Mercado Livre',
    icon: 'storefront',
    brand: 'mercado_livre',
    basePath: '/mercado-livre',
    children: [
      { href: '/mercado-livre/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/mercado-livre/anuncios', label: 'Anúncios', icon: 'sell' },
      { href: '/mercado-livre/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/mercado-livre/envios', label: 'Envios', icon: 'local_shipping' },
      { href: '/mercado-livre/financeiro', label: 'Financeiro', icon: 'payments' },
      { href: '/mercado-livre/saude', label: 'Saúde', icon: 'monitor_heart' },
    ],
  },
  {
    label: 'Shopee',
    icon: 'storefront',
    brand: 'shopee',
    basePath: '/shopee',
    children: [
      { href: '/shopee/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/shopee/anuncios', label: 'Anúncios', icon: 'sell' },
      { href: '/shopee/produtos', label: 'Produtos', icon: 'inventory_2' },
      { href: '/shopee/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/shopee/envios', label: 'Envios', icon: 'local_shipping' },
      { href: '/shopee/financeiro', label: 'Financeiro', icon: 'payments' },
      { href: '/shopee/devolucoes', label: 'Devoluções', icon: 'undo' },
      { href: '/shopee/saude', label: 'Saúde', icon: 'monitor_heart' },
    ],
  },
  {
    label: 'Magazord',
    icon: 'hub',
    basePath: '/magazord',
    children: [
      { href: '/magazord/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/magazord/financeiro', label: 'Financeiro', icon: 'account_balance_wallet' },
      { href: '/magazord/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/magazord/produtos', label: 'Produtos', icon: 'inventory_2' },
      { href: '/magazord/estoque', label: 'Estoque', icon: 'warehouse' },
      { href: '/magazord/fiscal', label: 'Fiscal', icon: 'receipt_long' },
    ],
  },
  {
    label: 'Shein',
    icon: 'storefront',
    brand: 'shein',
    basePath: '/shein',
    children: [
      { href: '/shein/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/shein/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/shein/produtos', label: 'Produtos', icon: 'inventory_2' },
      { href: '/shein/estoque', label: 'Estoque', icon: 'warehouse' },
      { href: '/shein/envios', label: 'Envios', icon: 'local_shipping' },
      { href: '/shein/devolucoes', label: 'Devoluções', icon: 'keyboard_return' },
      { href: '/shein/financeiro', label: 'Financeiro', icon: 'payments' },
      { href: '/shein/saude', label: 'Saúde', icon: 'monitor_heart' },
    ],
  },
  {
    label: 'TikTok Shop',
    icon: 'storefront',
    brand: 'tiktok_shop',
    basePath: '/tiktok',
    children: [
      { href: '/tiktok/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/tiktok/anuncios', label: 'Anúncios', icon: 'sell' },
      { href: '/tiktok/produtos', label: 'Produtos', icon: 'inventory_2' },
      { href: '/tiktok/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/tiktok/envios', label: 'Envios', icon: 'local_shipping' },
      { href: '/tiktok/financeiro', label: 'Financeiro', icon: 'payments' },
      { href: '/tiktok/devolucoes', label: 'Devoluções', icon: 'keyboard_return' },
      { href: '/tiktok/saude', label: 'Saúde', icon: 'monitor_heart' },
    ],
  },
  { href: '/alertas', label: 'Alertas', icon: 'notifications_active' },
]

const adminNav: NavItem = {
  href: '/admin/usuarios',
  label: 'Administração',
  icon: 'admin_panel_settings',
}

function NavLinkItem({
  href,
  label,
  icon,
  nested = false,
  collapsed = false,
}: NavLink & { nested?: boolean; collapsed?: boolean }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={[
        'group flex items-center gap-2.5 rounded-lg transition-colors duration-150',
        collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
        nested && !collapsed ? 'pl-10' : '',
        active
          ? 'text-zinc-50 bg-zinc-800/70'
          : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40',
      ].join(' ')}
    >
      <span className={['material-symbols-outlined text-[20px]', active && 'fill'].filter(Boolean).join(' ')}>{icon}</span>
      {!collapsed && <span className={cn('font-medium', active && 'font-semibold')}>{label}</span>}
    </Link>
  )
}

function NavGroupItem({ group, collapsed = false }: { group: NavGroup; collapsed?: boolean }) {
  const pathname = usePathname()
  const groupActive = pathname.startsWith(group.basePath)
  const [open, setOpen] = useState(groupActive)

  if (group.disabled) {
    if (collapsed) {
      return (
        <div
          title={`${group.label} (em breve)`}
          aria-disabled="true"
          className="flex items-center justify-center rounded-lg px-2 py-2 text-zinc-600 opacity-50 cursor-not-allowed"
        >
          {group.brand ? (
          <MarketplaceLogo name={group.brand} size={20} />
        ) : (
          <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
        )}
        </div>
      )
    }
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-600 opacity-50 cursor-not-allowed select-none"
      >
        {group.brand ? (
          <MarketplaceLogo name={group.brand} size={20} />
        ) : (
          <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
        )}
        <span className="flex-1 text-left font-medium">{group.label}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">em breve</span>
      </div>
    )
  }

  if (collapsed) {
    return (
      <Link
        href={group.children[0]?.href ?? group.basePath}
        title={group.label}
        className={cn(
          'flex items-center justify-center rounded-lg px-2 py-2 transition-colors duration-150',
          groupActive ? 'text-zinc-50 bg-zinc-800/70' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40',
        )}
      >
        {group.brand ? (
          <MarketplaceLogo name={group.brand} size={20} />
        ) : (
          <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
        )}
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150',
          groupActive
            ? 'text-zinc-50'
            : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40',
        ].join(' ')}
      >
        {group.brand ? (
          <MarketplaceLogo name={group.brand} size={20} />
        ) : (
          <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
        )}
        <span className="flex-1 text-left font-medium">{group.label}</span>
        <span
          className={`material-symbols-outlined text-base transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-xs">
          {group.children.map((child) => (
            <NavLinkItem key={child.href} {...child} nested />
          ))}
        </div>
      )}
    </div>
  )
}

type SidebarProps = {
  role?: 'admin' | 'user'
  userName?: string
}

export function Sidebar({ role = 'user' }: SidebarProps) {
  const nav: NavItem[] = role === 'admin' ? [...baseNav, adminNav] : baseNav
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('sidebar-collapsed') : null
    if (stored === '1') setCollapsed(true)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded'
    localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  const renderContent = (isCollapsed: boolean) => (
    <>
      <Link href="/dashboard" className={cn('flex items-center mb-4', isCollapsed ? 'justify-center px-0 py-2' : 'gap-3 px-2 py-2')}>
        <div className="w-9 h-9 overflow-hidden flex items-center justify-center shrink-0">
          <Image
            src="/logo-luzzo.svg"
            alt="Painel Luzzo"
            width={36}
            height={36}
            priority
            className="w-full h-full object-contain scale-125"
          />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-zinc-50 leading-tight tracking-tight">
              Painel Luzzo
            </span>
            <span className="text-[11px] text-zinc-500 font-medium">
              Marketplace intelligence
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-col gap-xs flex-1 overflow-y-auto">
        {nav.map((item) =>
          isGroup(item) ? (
            <NavGroupItem key={item.label} group={item} collapsed={isCollapsed} />
          ) : (
            <NavLinkItem key={item.href} {...item} collapsed={isCollapsed} />
          ),
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          className={cn(
            'flex items-center rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40 transition-colors duration-150',
            isCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <span className="material-symbols-outlined text-[20px]">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
          {!isCollapsed && <span className="font-medium">Recolher</span>}
        </button>
      </div>

      <div className="flex flex-col gap-1 mt-auto pt-3 border-t border-zinc-800">
        <a
          href="#"
          title={isCollapsed ? 'Suporte' : undefined}
          className={cn(
            'flex items-center rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40 transition-colors duration-150',
            isCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2',
          )}
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
          {!isCollapsed && <span className="font-medium">Suporte</span>}
        </a>
        <form action={signOut}>
          <button
            type="submit"
            title={isCollapsed ? 'Sair' : undefined}
            className={cn(
              'w-full flex items-center rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40 transition-colors duration-150',
              isCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2',
            )}
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            {!isCollapsed && <span className="font-medium">Sair</span>}
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
        className="md:hidden fixed left-3 top-3 z-[55] flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-50 shadow-lg shadow-black/40 active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      {/* Desktop sidebar */}
      <nav
        className={cn(
          'fixed left-0 top-0 h-screen flex-col p-3 z-50 bg-[#0a0a0c] border-r border-zinc-800 hidden md:flex font-sans text-sm font-medium transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-[240px]',
        )}
      >
        {renderContent(collapsed)}
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Mobile drawer panel */}
      <nav
        className={cn(
          'md:hidden fixed left-0 top-0 h-screen z-[70] flex flex-col p-3 bg-[#0a0a0c] w-[280px] border-r border-zinc-800 font-sans text-sm font-medium transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-50"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        {renderContent(false)}
      </nav>
    </>
  )
}
