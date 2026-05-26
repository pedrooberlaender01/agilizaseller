'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { cn } from '@/lib/utils'

type NavLink = { href: string; label: string; icon: string }
type NavGroup = { label: string; icon: string; basePath: string; children: NavLink[] }
type NavItem = NavLink | NavGroup

const isGroup = (item: NavItem): item is NavGroup => 'children' in item

const baseNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/pedidos', label: 'Pedidos', icon: 'receipt_long' },
  {
    label: 'Mercado Livre',
    icon: 'storefront',
    basePath: '/mercado-livre',
    children: [
      { href: '/mercado-livre/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/mercado-livre/anuncios', label: 'Anúncios', icon: 'sell' },
      { href: '/mercado-livre/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/mercado-livre/envios', label: 'Envios', icon: 'local_shipping' },
      { href: '/mercado-livre/saude', label: 'Saúde', icon: 'monitor_heart' },
    ],
  },
  {
    label: 'Shopee',
    icon: 'storefront',
    basePath: '/shopee',
    children: [
      { href: '/shopee/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/shopee/anuncios', label: 'Anúncios', icon: 'sell' },
      { href: '/shopee/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/shopee/envios', label: 'Envios', icon: 'local_shipping' },
      { href: '/shopee/saude', label: 'Saúde', icon: 'monitor_heart' },
    ],
  },
  {
    label: 'Magazord',
    icon: 'hub',
    basePath: '/magazord',
    children: [
      { href: '/magazord/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/magazord/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/magazord/produtos', label: 'Produtos', icon: 'inventory_2' },
      { href: '/magazord/estoque', label: 'Estoque', icon: 'warehouse' },
      { href: '/magazord/fiscal', label: 'Fiscal', icon: 'receipt_long' },
    ],
  },
  {
    label: 'Shein',
    icon: 'storefront',
    basePath: '/shein',
    children: [
      { href: '/shein/metricas', label: 'Métricas', icon: 'monitoring' },
      { href: '/shein/pedidos', label: 'Pedidos', icon: 'shopping_cart' },
      { href: '/shein/produtos', label: 'Produtos', icon: 'inventory_2' },
      { href: '/shein/estoque', label: 'Estoque', icon: 'warehouse' },
      { href: '/shein/financeiro', label: 'Financeiro', icon: 'payments' },
    ],
  },
  { href: '/alertas', label: 'Alertas', icon: 'notifications_active' },
  { href: '/configuracoes', label: 'Configurações', icon: 'settings' },
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
}: NavLink & { nested?: boolean }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={[
        'group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-150',
        nested ? 'pl-10' : '',
        active
          ? 'text-zinc-50 bg-zinc-800/70'
          : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40',
      ].join(' ')}
    >
      <span className={['material-symbols-outlined text-[20px]', active && 'fill'].filter(Boolean).join(' ')}>{icon}</span>
      <span className={cn('font-medium', active && 'font-semibold')}>{label}</span>
    </Link>
  )
}

function NavGroupItem({ group }: { group: NavGroup }) {
  const pathname = usePathname()
  const groupActive = pathname.startsWith(group.basePath)
  const [open, setOpen] = useState(groupActive)

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
        <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
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

  return (
    <nav className="fixed left-0 top-0 h-screen flex-col p-3 z-50 bg-[#0a0a0c] w-[240px] border-r border-zinc-800 hidden md:flex font-sans text-sm font-medium">
      <Link href="/dashboard" className="flex items-center gap-3 px-2 py-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined fill text-[#0a0a0c] text-lg">
            insights
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-zinc-50 leading-tight tracking-tight">
            Painel Luzzo
          </span>
          <span className="text-[11px] text-zinc-500 font-medium">
            Marketplace intelligence
          </span>
        </div>
      </Link>

      <div className="flex flex-col gap-xs flex-1">
        {nav.map((item) =>
          isGroup(item) ? (
            <NavGroupItem key={item.label} group={item} />
          ) : (
            <NavLinkItem key={item.href} {...item} />
          ),
        )}
      </div>

      <div className="flex flex-col gap-1 mt-auto pt-3 border-t border-zinc-800">
        <a
          href="#"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40 transition-colors duration-150"
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
          <span className="font-medium">Suporte</span>
        </a>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/40 transition-colors duration-150"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span className="font-medium">Sair</span>
          </button>
        </form>
      </div>
    </nav>
  )
}
