'use client'
import { BedDouble, Calendar, LayoutDashboard, LogOut, Menu, MessageCircle, Plug, Sparkles, SprayCan, Users, Workflow, Wrench, X, Zap } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

const NAV = [
  { section: 'Operate', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/reservations', label: 'Reservations', icon: Calendar },
    { href: '/guests', label: 'Guests', icon: Users },
    { href: '/rooms', label: 'Rooms', icon: BedDouble },
    { href: '/housekeeping', label: 'Housekeeping', icon: SprayCan },
    { href: '/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/inbox', label: 'Guest inbox', icon: MessageCircle },
  ] },
  { section: 'Automate', items: [
    { href: '/automations', label: 'Automations', icon: Zap },
    { href: '/automations/settings', label: 'App connections', icon: Plug },
    { href: '/automations/studio', label: 'Automation Studio', icon: Workflow },
  ] },
]

export function Sidebar({ hotelName, connected, badges }: { hotelName: string; connected: number; badges: Record<string, number> }) {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) => (href === '/automations' ? path === href : path === href || path.startsWith(`${href}/`))

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/login')
    router.refresh()
  }

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Property</div>
          <div className="truncate text-sm font-medium text-white">{hotelName}</div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">{group.section}</div>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)}
                  className={cn('group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition', isActive(href) ? 'bg-brand-400/10 text-white ring-1 ring-inset ring-brand-400/20' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white')}>
                  <Icon className={cn('h-4 w-4', isActive(href) ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300')} />
                  <span className="flex-1">{label}</span>
                  {badges[href] ? <span className="rounded-md bg-amber-400/15 px-1.5 text-[11px] font-medium text-amber-300">{badges[href]}</span> : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 p-3">
        <Link href="/automations/settings" className="block rounded-xl border border-brand-400/20 bg-gradient-to-br from-brand-400/10 to-transparent p-3.5">
          <div className="flex items-center gap-2 text-sm font-medium text-white"><Sparkles className="h-4 w-4 text-brand-400" /> viaSocket</div>
          <div className="mt-1 text-xs text-slate-400">{connected}/5 apps connected</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-400" style={{ width: `${(connected / 5) * 100}%` }} /></div>
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>
    </nav>
  )

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-white/[0.06] bg-ink-950/60 backdrop-blur lg:block">{nav}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-ink-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-[270px] bg-ink-900" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute left-[232px] top-5 rounded-lg p-1.5 text-slate-400" aria-label="Close menu"><X className="h-4 w-4" /></button>
            {nav}
          </aside>
        </div>
      )}
    </>
  )
}
