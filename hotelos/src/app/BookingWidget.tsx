'use client'
import { ArrowRight, CalendarDays, Check, Copy, Loader2, MessageCircle, Users, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/client-api'
import type { RoomType } from '@/lib/types'
import { addDays, inr, nightsBetween, prettyDate, today } from '@/lib/utils'

interface Booked { code: string; room_type: string; room_number: string; grand_total: number; nights: number; check_in: string; check_out: string; checkin_url: string }

export default function BookingWidget({ types, taxRate, member }: { types: Array<{ type: RoomType; rate: number; occ: number }>; taxRate: number; member?: { name: string; phone: string; email: string } | null }) {
  const [f, setF] = useState({ check_in: addDays(today(), 7), check_out: addDays(today(), 10), adults: 2, room_type: 'Deluxe' as RoomType })
  const [step, setStep] = useState<'search' | 'details' | 'done'>('search')
  const [g, setG] = useState({ guest_name: member?.name ?? '', guest_phone: member?.phone ?? '', guest_email: member?.email ?? '', special_requests: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<Booked | null>(null)
  const [copied, setCopied] = useState(false)
  const t = types.find((x) => x.type === f.room_type)!
  const nights = nightsBetween(f.check_in, f.check_out)
  const total = nights * t.rate * (1 + taxRate)

  async function book(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await api<Booked>('/api/public/book', { body: { ...f, ...g } })
      setBooked(r)
      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setStep('details') }} className="grid gap-3 rounded-3xl bg-white p-3 text-ink-900 shadow-2xl sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.7fr_1fr_auto]">
        <label className="rounded-2xl px-4 py-2.5 hover:bg-stone-50"><span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500"><CalendarDays className="h-3.5 w-3.5" /> Check-in</span><input type="date" min={today()} value={f.check_in} onChange={(e) => setF({ ...f, check_in: e.target.value, check_out: e.target.value >= f.check_out ? addDays(e.target.value, 1) : f.check_out })} className="mt-0.5 w-full bg-transparent text-[15px] font-medium outline-none" /></label>
        <label className="rounded-2xl px-4 py-2.5 hover:bg-stone-50"><span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500"><CalendarDays className="h-3.5 w-3.5" /> Check-out</span><input type="date" min={addDays(f.check_in, 1)} value={f.check_out} onChange={(e) => setF({ ...f, check_out: e.target.value })} className="mt-0.5 w-full bg-transparent text-[15px] font-medium outline-none" /></label>
        <label className="rounded-2xl px-4 py-2.5 hover:bg-stone-50"><span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500"><Users className="h-3.5 w-3.5" /> Guests</span><select value={f.adults} onChange={(e) => setF({ ...f, adults: Number(e.target.value) })} className="mt-0.5 w-full bg-transparent text-[15px] font-medium outline-none">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} adult{n > 1 ? 's' : ''}</option>)}</select></label>
        <label className="rounded-2xl px-4 py-2.5 hover:bg-stone-50"><span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Room</span><select value={f.room_type} onChange={(e) => setF({ ...f, room_type: e.target.value as RoomType })} className="mt-0.5 w-full bg-transparent text-[15px] font-medium outline-none">{types.filter((x) => x.occ >= f.adults).map((x) => <option key={x.type} value={x.type}>{x.type} · {inr(x.rate)}</option>)}</select></label>
        <button type="submit" className="flex items-center justify-center gap-2 rounded-2xl bg-brand-500 px-7 py-4 font-semibold text-white transition hover:bg-brand-600 sm:col-span-2 lg:col-span-1">Book {nights > 0 && <span className="font-normal opacity-80">· {inr(total)}</span>}<ArrowRight className="h-4 w-4" /></button>
      </form>

      {step !== 'search' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 text-ink-900 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && step !== 'done' && setStep('search')}>
          <div className="w-full max-w-lg animate-fade-up rounded-t-3xl bg-white p-7 sm:rounded-3xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-3xl">{step === 'done' ? 'You’re booked!' : 'Almost there'}</h2>
                <p className="mt-1 text-sm text-stone-500">{f.room_type} · {prettyDate(f.check_in)} → {prettyDate(f.check_out)} · {nights} night{nights !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => { setStep('search'); setBooked(null) }} className="rounded-full p-2 text-stone-400 hover:bg-stone-100" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            {step === 'details' ? (
              <form onSubmit={book} className="mt-6 space-y-3">
                <input required className="light-input" placeholder="Full name" value={g.guest_name} onChange={(e) => setG({ ...g, guest_name: e.target.value })} />
                <input required className="light-input" placeholder="WhatsApp number, e.g. +91 98xxx xxxxx" value={g.guest_phone} onChange={(e) => setG({ ...g, guest_phone: e.target.value })} />
                <input type="email" className="light-input" placeholder="Email (for your confirmation & invoice)" value={g.guest_email} onChange={(e) => setG({ ...g, guest_email: e.target.value })} />
                <textarea className="light-input min-h-[70px]" placeholder="Anything we should know? (optional)" value={g.special_requests} onChange={(e) => setG({ ...g, special_requests: e.target.value })} />
                <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-4 py-3 text-sm"><span className="text-stone-600">Total incl. {Math.round(taxRate * 100)}% GST</span><b className="text-lg">{inr(total)}</b></div>
                {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-4 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm booking</button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-stone-500"><MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> Confirmation + online check-in link arrive on WhatsApp</p>
              </form>
            ) : booked && (
              <div className="mt-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 ring-8 ring-brand-50/50"><Check className="h-8 w-8 text-brand-600" /></div>
                <p className="mt-4 text-sm text-stone-600">Booking <b className="text-ink-900">{booked.code}</b> · {booked.room_type} · {inr(booked.grand_total)}</p>
                <p className="mt-1 text-sm text-stone-500">We’ve sent your confirmation. Save time at arrival:</p>
                <a href={booked.checkin_url} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-900 py-4 font-semibold text-white hover:bg-ink-800">Check in online now <ArrowRight className="h-4 w-4" /></a>
                <button onClick={() => { navigator.clipboard.writeText(booked.checkin_url); setCopied(true) }} className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink-900">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Link copied' : 'Copy check-in link'}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
