'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'

type NavLink = { href: string; label: string; icon: string }
type NavGroup = { label: string; icon: string; basePath: string; children: NavLink[] }
type NavItem = NavLink | NavGroup

const isGroup = (item: NavItem): item is NavGroup => 'children' in item

const baseNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
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
        'flex items-center gap-sm px-sm py-2 rounded-lg transition-all active:translate-x-1 duration-200',
        nested ? 'pl-9' : '',
        active
          ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500'
          : 'text-slate-500 hover:text-slate-200 hover:bg-white/5',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      <span>{label}</span>
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
          'flex items-center gap-sm px-sm py-2 rounded-lg transition-all active:translate-x-1 duration-200',
          groupActive
            ? 'text-slate-200'
            : 'text-slate-500 hover:text-slate-200 hover:bg-white/5',
        ].join(' ')}
      >
        <span className="material-symbols-outlined text-lg">{group.icon}</span>
        <span className="flex-1 text-left">{group.label}</span>
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
    <nav className="fixed left-0 top-0 h-screen flex-col p-4 z-50 bg-[#0d1117]/60 backdrop-blur-2xl w-[240px] border-r border-white/10 hidden md:flex font-inter text-[13px] font-medium">
      <Link href="/dashboard" className="flex items-center gap-sm px-sm mb-lg">
        <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined fill text-on-primary-container text-xl">
            rocket_launch
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-black text-white leading-tight tracking-tight">
            Painel Luzzo
          </span>
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Mission Control
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

      <div className="flex flex-col gap-xs mt-auto pt-4 border-t border-white/10">
        <a
          href="#"
          className="flex items-center gap-sm px-sm py-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all active:translate-x-1 duration-200"
        >
          <span className="material-symbols-outlined text-lg">help</span>
          <span>Suporte</span>
        </a>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-sm px-sm py-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-all active:translate-x-1 duration-200"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span>Sair</span>
          </button>
        </form>
      </div>
    </nav>
  )
}
