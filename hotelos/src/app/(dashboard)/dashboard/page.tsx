import { ArrowDownLeft, ArrowRight, ArrowUpRight, BedDouble, IndianRupee, Plug, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { OccupancyChart, type OccPoint } from '@/components/OccupancyChart'
import { AppIcon, Badge, Card, StatusBadge } from '@/components/ui'
import { currentHotel } from '@/lib/auth'
import { dailyStats } from '@/lib/automations'
import { EVENT_LABELS } from '@/lib/automations/catalog'
import { db, reservationViews } from '@/lib/db'
import { addDays, cn, inr, initials, prettyDate, timeAgo, today } from '@/lib/utils'
import { APPS, APP_LIST } from '@/lib/viasocket/apps'
import { publicIntegrations } from '@/lib/viasocket/view'

export const metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  const hotel = currentHotel()!
  const t = today()
  const views = reservationViews(hotel.id)
  const s = dailyStats(hotel.id, t)
  const arrivals = views.filter((r) => r.check_in === t && r.status !== 'cancelled')
  const departures = views.filter((r) => r.check_out === t && ['checked_in', 'checked_out'].includes(r.status))
  const revenueToday = db().folio_items.filter((i) => i.date === t && db().folios.find((f) => f.id === i.folio_id)?.hotel_id === hotel.id).reduce((a, i) => a + i.total_price, 0) + s.revenue
  const chart: OccPoint[] = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(t, i - 6)
    const st = dailyStats(hotel.id, d)
    return { date: d, label: prettyDate(d), pct: st.occupancy_pct, occupied: st.occupied, total: st.total_rooms, today: d === t }
  })
  const occColor = s.occupancy_pct > 80 ? 'text-brand-300' : s.occupancy_pct > 60 ? 'text-amber-300' : 'text-red-300'
  const integ = publicIntegrations(hotel)
  const logs = db().automation_logs.filter((l) => l.hotel_id === hotel.id && !l.sample).slice(0, 7)
  const recent = [...views].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 7)
  const ready = APP_LIST.filter((a) => integ.apps[a.key].ready).length

  const stats = [
    { label: "Today's check-ins", value: arrivals.length, sub: `${arrivals.filter((a) => a.status === 'checked_in').length} arrived · ${arrivals.filter((a) => a.digital_checkin_completed).length} pre-checked online`, icon: ArrowDownLeft },
    { label: "Today's check-outs", value: departures.length, sub: `${departures.filter((d) => d.status === 'checked_out').length} done`, icon: ArrowUpRight },
    { label: 'Current occupancy', value: `${s.occupancy_pct}%`, sub: `${s.occupied} of ${s.total_rooms} rooms`, icon: BedDouble, color: occColor },
    { label: "Today's revenue", value: inr(revenueToday), sub: 'room nights + folio charges', icon: IndianRupee },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[.16em] text-brand-400">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{hotel.name}</h1>
        </div>
        <Link href="/reservations?new=1" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-400 px-4 text-sm font-medium text-ink-950 shadow-glow hover:bg-brand-300">+ New reservation</Link>
      </div>

      {ready < 5 && (
        <Link href="/automations/settings" className="group flex items-center gap-4 rounded-2xl border border-brand-400/20 bg-gradient-to-r from-brand-400/[0.08] via-transparent to-transparent p-4 transition hover:border-brand-400/40">
          <div className="rounded-xl bg-brand-400/15 p-2.5"><Sparkles className="h-5 w-5 text-brand-400" /></div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">{ready === 0 ? 'Turn on your guest-journey automations' : `${ready}/${APP_LIST.length} apps ready — finish connecting`}</div>
            <div className="text-xs text-slate-400">Connect WhatsApp, Gmail, Slack, Sheets and Calendar through viaSocket. Two clicks each, no API keys.</div>
          </div>
          <div className="hidden gap-1.5 sm:flex">{APP_LIST.map((a) => <span key={a.key} className={cn(!integ.apps[a.key].ready && 'opacity-40 grayscale')}><AppIcon src={a.icon} name={a.name} size={28} /></span>)}</div>
          <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-brand-400" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center justify-between text-sm text-slate-400">{label}<Icon className="h-4 w-4 text-slate-500" /></div>
            <div className={cn('mt-3 text-3xl font-semibold tracking-tight text-white', color)}>{value}</div>
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-medium text-white">Occupancy</h2>
              <p className="text-xs text-slate-500">Past week and the week ahead</p>
            </div>
          </div>
          <OccupancyChart data={chart} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-white">Automation activity</h2>
            <Link href="/automations" className="text-xs text-brand-400 hover:text-brand-300">All logs →</Link>
          </div>
          <div className="space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3">
                {l.app in APPS ? <AppIcon src={APPS[l.app as keyof typeof APPS].icon} name={l.app} size={26} /> : <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-violet-400/15 text-violet-300"><Plug className="h-3.5 w-3.5" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{l.summary}</div>
                  <div className="text-[11px] text-slate-500">{EVENT_LABELS[l.event_type]} · {timeAgo(l.created_at)}{l.sample ? ' · sample' : ''}</div>
                </div>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', l.status === 'success' ? 'bg-brand-400' : l.status === 'failed' ? 'bg-red-400' : 'bg-amber-400')} title={l.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden p-0 xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-medium text-white">Recent reservations</h2>
            <Link href="/reservations" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-2 font-medium">Guest</th><th className="px-5 py-2 font-medium">Room</th><th className="px-5 py-2 font-medium">Check-in</th><th className="px-5 py-2 font-medium">Check-out</th><th className="px-5 py-2 font-medium">Status</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-white/[0.05]">
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-medium text-slate-300">{initials(r.guest.name)}</span><span className="text-slate-200">{r.guest.name}</span>{r.is_vip && <Badge color="amber">VIP</Badge>}</div></td>
                    <td className="px-5 py-3 text-slate-400">{r.room.number} · {r.room.type}</td>
                    <td className="px-5 py-3 text-slate-400">{prettyDate(r.check_in)}</td>
                    <td className="px-5 py-3 text-slate-400">{prettyDate(r.check_out)}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-white">Arriving today</h2>
          {arrivals.length === 0 ? <p className="text-sm text-slate-500">No arrivals today.</p> : (
            <div className="space-y-3">
              {arrivals.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex h-10 w-12 flex-col items-center justify-center rounded-lg bg-ink-900 text-xs"><span className="text-[9px] uppercase text-slate-500">Room</span><span className="font-semibold text-white">{r.room.number}</span></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-sm text-slate-200">{r.guest.name}{r.is_vip && <Badge color="amber">VIP</Badge>}</div>
                    <div className="text-[11px] text-slate-500">{r.total_nights} nights · {r.digital_checkin_completed ? '✓ online check-in done' : 'online check-in pending'}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
