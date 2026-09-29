import { BedDouble, Coffee, KeyRound, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, Users, Waves, Wifi } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { db } from '@/lib/db'
import { currentGuest } from '@/lib/guestAuth'
import { DEMO_HOTEL_ID } from '@/lib/seed'
import type { RoomType } from '@/lib/types'
import { inr } from '@/lib/utils'
import BookingWidget from './BookingWidget'

export const dynamic = 'force-dynamic'

const U = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`
const ROOM_IMG: Record<RoomType, string> = {
  Standard: U('photo-1631049307264-da0ec9d70304', 900),
  Deluxe: U('photo-1590490360182-c33d57733427', 900),
  Suite: U('photo-1582719478250-c89cae4dc85b', 900),
  Villa: U('photo-1571003123894-1f0594d2b5d9', 900),
}
const bg = (url: string) => ({ backgroundImage: `url(${url}), linear-gradient(135deg,#1f2630,#157534)` })

export default function Home() {
  const d = db()
  const hotel = d.hotels.find((h) => h.id === DEMO_HOTEL_ID)!
  const guest = currentGuest()
  const rooms = d.rooms.filter((r) => r.hotel_id === hotel.id)
  const types = (['Standard', 'Deluxe', 'Suite', 'Villa'] as RoomType[]).map((type) => {
    const list = rooms.filter((r) => r.type === type)
    return { type, rate: list[0]?.rate_per_night ?? 0, occ: list[0]?.max_occupancy ?? 2, amenities: list[0]?.amenities ?? [], description: list[0]?.description ?? '', count: list.length }
  })

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-ink-900" style={{ colorScheme: 'light' }}>
      {/* Hero */}
      <header className="relative min-h-[88vh] overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 bg-cover bg-center" style={bg(U('photo-1566073771259-6a8506099945', 2000))} />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/30 to-ink-950/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/85 via-ink-950/45 to-transparent" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Logo suffix={null} />
          <div className="flex items-center gap-6 text-sm">
            <a href="#rooms" className="hidden text-white/80 hover:text-white sm:block">Rooms</a>
            <a href="#stay" className="hidden text-white/80 hover:text-white sm:block">Smart stay</a>
            <a href="#dining" className="hidden text-white/80 hover:text-white sm:block">Dining</a>
            {guest ? (
              <Link href="/account" className="rounded-full bg-white px-4 py-2 font-medium text-ink-900 hover:bg-white/90">Hi, {guest.name.split(' ')[0]}</Link>
            ) : (
              <>
                <Link href="/account/login" className="hidden text-white/80 hover:text-white sm:block">Sign in</Link>
                <Link href="/signup" className="rounded-full bg-white px-4 py-2 font-medium text-ink-900 hover:bg-white/90">Join & save 10%</Link>
              </>
            )}
          </div>
        </nav>
        <div className="relative mx-auto max-w-7xl px-6 pb-36 pt-20 sm:pt-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur"><MapPin className="h-3.5 w-3.5 text-brand-400" /> Candolim Beach, Goa</div>
          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">Wake up to the<br /><em className="text-brand-300">Arabian Sea.</em></h1>
          <p className="mt-6 max-w-xl text-lg text-white/80">{hotel.name} — 24 rooms and villas steps from the sand. Book in a minute, check in from your phone, and message us on WhatsApp for anything.</p>
        </div>
        <div id="book" className="relative mx-auto -mt-24 max-w-7xl scroll-mt-6 px-6 pb-12">
          <BookingWidget types={types.map((t) => ({ type: t.type, rate: t.rate, occ: t.occ }))} taxRate={hotel.tax_rate} member={guest ? { name: guest.name, phone: guest.phone, email: guest.email ?? '' } : null} />
        </div>
      </header>

      {/* Rooms */}
      <section id="rooms" className="mx-auto max-w-7xl px-6 py-24">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[.18em] text-brand-700">Rooms & villas</div>
            <h2 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Four ways to stay</h2>
          </div>
          <p className="max-w-md text-stone-600">Every room has fast Wi-Fi, rain showers and blackout blinds. Villas come with a private plunge pool and butler.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {types.map((t) => (
            <article key={t.type} className="group overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_rgba(0,0,0,.04),0_20px_40px_-24px_rgba(0,0,0,.25)]">
              <div className="aspect-[4/5] bg-cover bg-center transition duration-700 group-hover:scale-[1.03]" style={bg(ROOM_IMG[t.type])} />
              <div className="p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-2xl">{t.type}</h3>
                  <div className="text-right text-sm"><b className="text-lg">{inr(t.rate)}</b><span className="text-stone-500"> /night</span></div>
                </div>
                <p className="mt-2 text-sm text-stone-600">{t.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 text-xs text-stone-600">
                  <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1"><Users className="h-3 w-3" /> up to {t.occ}</span>
                  {t.amenities.slice(0, 3).map((a) => <span key={a} className="rounded-full bg-stone-100 px-2.5 py-1">{a}</span>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Smart stay */}
      <section id="stay" className="bg-ink-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[.18em] text-brand-400">No queues, no paperwork</div>
            <h2 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Your whole stay,<br />on your phone.</h2>
            <div className="mt-10 space-y-6">
              {[
                [KeyRound, 'Check in before you arrive', 'Upload your ID, snap a selfie and sign — the link arrives on WhatsApp the moment you book.'],
                [MessageCircle, 'WhatsApp us for anything', '“Two extra towels please” goes straight to housekeeping. “AC isn’t cooling” reaches our engineer in seconds.'],
                [ShieldCheck, 'Invoice in your inbox', 'Check out and your invoice lands on WhatsApp and email before you reach the taxi.'],
              ].map(([Icon, title, body]) => {
                const I = Icon as typeof KeyRound
                return (
                  <div key={title as string} className="flex gap-4">
                    <div className="h-fit rounded-2xl bg-brand-400/15 p-3 ring-1 ring-brand-400/25"><I className="h-5 w-5 text-brand-400" /></div>
                    <div><h3 className="font-medium">{title as string}</h3><p className="mt-1 text-sm text-slate-400">{body as string}</p></div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-10 rounded-full bg-brand-400/20 blur-3xl" />
            <div className="relative rounded-[2.5rem] border-[10px] border-ink-800 bg-[#0b141a] p-4 shadow-2xl">
              <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-400"><BedDouble className="h-4 w-4 text-ink-950" /></div><div><div className="text-sm font-medium">{hotel.name}</div><div className="text-[10px] text-brand-400">online</div></div></div>
              <div className="space-y-2.5 text-[13px]">
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[#202c33] p-2.5">Welcome to <b>{hotel.name}</b>, Priya! 🎉<br />🔑 <b>Room 305</b> · Check-out Fri 11:00<br /><span className="text-white/60">Need anything? Just reply here.</span></div>
                <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-[#005c4b] p-2.5">Can I get two extra towels please?</div>
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[#202c33] p-2.5">Got it! 🧹 Housekeeping is on the way to Room 305.</div>
                <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-[#005c4b] p-2.5">What time is breakfast?</div>
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[#202c33] p-2.5">Breakfast: 7:00–10:30 at the Palm Café ☕</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dining & amenities */}
      <section id="dining" className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="relative min-h-[340px] overflow-hidden rounded-3xl bg-cover bg-center lg:col-span-2" style={bg(U('photo-1414235077428-338989a2e8c0', 1400))}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 p-8 text-white">
              <div className="text-xs font-semibold uppercase tracking-[.18em] text-brand-300">Palm Café</div>
              <h2 className="mt-1 font-display text-4xl">Goan kitchen, all day.</h2>
              <p className="mt-2 max-w-md text-white/80">Breakfast 7:00–10:30 · Room service 24/7 — WhatsApp your order or dial 101.</p>
            </div>
          </div>
          <div className="grid gap-4">
            {[[Waves, 'Infinity pool', '7:00 – 21:00, towels poolside'], [Wifi, 'Fast Wi-Fi', '300 Mbps everywhere, free'], [Coffee, 'Beach bar', 'Sunset cocktails from 17:00'], [Sparkles, 'Spa', 'Ayurvedic massage, book via WhatsApp']].map(([Icon, t, s]) => {
              const I = Icon as typeof Waves
              return <div key={t as string} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm"><I className="h-6 w-6 text-brand-600" /><div><div className="font-medium">{t as string}</div><div className="text-sm text-stone-500">{s as string}</div></div></div>
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-stone-500 sm:flex-row sm:items-center">
          <Logo light suffix={null} />
          <div className="flex flex-wrap gap-x-6 gap-y-2"><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{hotel.address}</span><span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{hotel.phone}</span></div>
          <span className="flex gap-4"><Link href="/login" className="hover:text-ink-900">Staff login</Link><span>Automations by viaSocket</span></span>
        </div>
      </footer>
    </div>
  )
}
