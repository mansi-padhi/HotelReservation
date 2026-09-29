import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import { prettyDate, today } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const hotel = currentHotel()
  if (!hotel) redirect('/login')
  const d = db()
  const connected = Object.values(hotel.integrations).filter(Boolean).length
  const badges = {
    '/housekeeping': d.housekeeping_tasks.filter((t) => t.hotel_id === hotel.id && t.status === 'pending').length,
    '/maintenance': d.maintenance_requests.filter((m) => m.hotel_id === hotel.id && m.status === 'open').length,
  }
  return (
    <div className="min-h-screen bg-ink-900">
      <Sidebar hotelName={hotel.name} connected={connected} badges={badges} />
      <div className="lg:pl-[248px]">
        <header className="hidden items-center justify-between border-b border-white/[0.06] px-8 py-3.5 lg:flex">
          <div className="text-sm text-slate-400">{prettyDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand-400" /> Automations live · {connected}/5 apps
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
