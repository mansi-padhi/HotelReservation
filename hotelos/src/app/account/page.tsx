import { ArrowRight, CalendarDays, KeyRound, MessageCircle, Receipt } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { db, joinReservation } from '@/lib/db'
import { currentGuest } from '@/lib/guestAuth'
import { inr, prettyDate, today } from '@/lib/utils'
import SignOut from './SignOut'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My account' }

const STATUS: Record<string, [string, string]> = {
  confirmed: ['Upcoming', 'bg-sky-50 text-sky-700'],
  checked_in: ['Staying now', 'bg-brand-50 text-brand-700'],
  checked_out: ['Completed', 'bg-stone-100 text-stone-600'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-700'],
  no_show: ['No-show', 'bg-red-50 text-red-700'],
}

export default function AccountPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const guest = currentGuest()
  if (!guest) redirect('/account/login')
  const d = db()
  const hotel = d.hotels.find((h) => h.id === guest.hotel_id)!
  const stays = d.reservations.filter((r) => r.guest_id === guest.id).map(joinReservation).sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
  const upcoming = stays.filter((s) => ['confirmed', 'checked_in'].includes(s.status) && s.check_out >= today())
  const past = stays.filter((s) => !upcoming.includes(s))
  const folioFor = (id: string) => d.folios.find((f) => f.reservation_id === id)

  const Card = ({ s }: { s: (typeof stays)[number] }) => {
    const [label, cls] = STATUS[s.status] ?? ['', '']
    const folio = folioFor(s.id)
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-2xl">{s.room.type} · Room {s.room.number}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-stone-500"><CalendarDays className="h-4 w-4" />{prettyDate(s.check_in, { weekday: 'short', day: 'numeric', month: 'short' })} → {prettyDate(s.check_out, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {s.total_nights} nights</div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">{s.code} · {inr(s.grand_total)}{s.balance_due > 0 && s.status !== 'cancelled' ? ` · ${inr(s.balance_due)} due` : ''}</span>
          <span className="ml-auto flex gap-2">
            {s.status === 'confirmed' && !s.digital_checkin_completed && <Link href={`/checkin/${s.checkin_link_token}`} className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 font-medium text-white hover:bg-ink-800"><KeyRound className="h-4 w-4" /> Check in online</Link>}
            {s.status === 'confirmed' && s.digital_checkin_completed && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">✓ Checked in online</span>}
            {folio && <Link href={`/invoice/${folio.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 hover:bg-stone-50"><Receipt className="h-4 w-4" /> Invoice</Link>}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-ink-900" style={{ colorScheme: 'light' }}>
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link href="/"><Logo light suffix={null} /></Link>
        <SignOut />
      </nav>
      <main className="mx-auto max-w-4xl px-6 pb-20">
        {searchParams.welcome && (
          <div className="mb-6 rounded-3xl bg-ink-900 p-6 text-white">
            <div className="text-xs font-semibold uppercase tracking-[.18em] text-brand-300">Welcome to the club</div>
            <p className="mt-1 text-lg">Your account is ready, {guest.name.split(' ')[0]}. We’ve sent your member perks to <b>{guest.email}</b>.</p>
          </div>
        )}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-stone-500">Member since {prettyDate(guest.signed_up_at ?? guest.created_at, { month: 'long', year: 'numeric' })}</p>
            <h1 className="font-display text-4xl sm:text-5xl">Hi, {guest.name.split(' ')[0]}</h1>
          </div>
          <Link href="/#book" className="inline-flex items-center gap-2 self-start rounded-2xl bg-brand-500 px-5 py-3 font-semibold text-white hover:bg-brand-600">Book a stay <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[['Stays', guest.total_stays], ['Upcoming', upcoming.length], ['Lifetime', inr(guest.total_spend)]].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs text-stone-500">{k}</div><div className="mt-1 text-2xl font-semibold">{v}</div></div>
          ))}
        </div>

        <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-[.14em] text-stone-500">Upcoming</h2>
        {upcoming.length ? <div className="space-y-3">{upcoming.map((s) => <Card key={s.id} s={s} />)}</div> : (
          <div className="rounded-3xl border-2 border-dashed border-stone-300 p-8 text-center text-stone-500">No upcoming stays. <Link href="/#book" className="font-medium text-brand-700">Book one →</Link></div>
        )}
        {past.length > 0 && (
          <>
            <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-[.14em] text-stone-500">Past stays</h2>
            <div className="space-y-3">{past.map((s) => <Card key={s.id} s={s} />)}</div>
          </>
        )}
        <div className="mt-10 flex items-center gap-3 rounded-3xl bg-[#25D366]/10 p-5 text-sm text-stone-700">
          <MessageCircle className="h-5 w-5 shrink-0 text-[#1da851]" /> During your stay, WhatsApp us at {hotel.phone} for towels, food or anything else.
        </div>
      </main>
    </div>
  )
}
