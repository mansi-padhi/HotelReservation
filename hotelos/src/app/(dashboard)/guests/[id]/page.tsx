import { ArrowLeft, Crown, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, StatusBadge } from '@/components/ui'
import { currentHotel } from '@/lib/auth'
import { db, joinReservation } from '@/lib/db'
import { inr, initials, prettyDate, timeAgo } from '@/lib/utils'
import VerifyId from './VerifyId'

export const metadata = { title: 'Guest' }

export default function GuestPage({ params }: { params: { id: string } }) {
  const hotel = currentHotel()!
  const d = db()
  const g = d.guests.find((x) => x.id === params.id && x.hotel_id === hotel.id)
  if (!g) notFound()
  const stays = d.reservations.filter((r) => r.guest_id === g.id).map(joinReservation).sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
  const msgs = d.guest_requests.filter((m) => stays.some((s) => s.id === m.reservation_id))

  return (
    <div className="space-y-6">
      <Link href="/guests" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Guests</Link>
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        {g.photo_url ? <img src={g.photo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/30 to-sky-400/20 text-2xl font-semibold text-white">{initials(g.name)}</span>}
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">{g.name}{g.tags.includes('vip') && <Crown className="h-5 w-5 text-amber-300" />}</h1>
          <div className="mt-1 text-sm text-slate-400">{g.phone} · {g.email ?? 'no email'} · {g.nationality ?? '—'}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{g.tags.map((t) => <Badge key={t} color={t === 'vip' ? 'amber' : 'violet'}>{t}</Badge>)}</div>
        </div>
        <div className="grid grid-cols-2 gap-6 text-center">
          <div><div className="text-2xl font-semibold text-white">{g.total_stays}</div><div className="text-xs text-slate-500">stays</div></div>
          <div><div className="text-2xl font-semibold text-white">{inr(g.total_spend)}</div><div className="text-xs text-slate-500">lifetime</div></div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-medium text-white">Stays</h2>
          <div className="space-y-2">
            {stays.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-900 p-3 text-sm">
                <div><div className="text-slate-200">{prettyDate(s.check_in)} → {prettyDate(s.check_out)} · Room {s.room.number}</div><div className="text-xs text-slate-500">{s.code} · {s.total_nights} nights · {s.booking_source}</div></div>
                <div className="flex items-center gap-3"><span className="text-slate-300">{inr(s.grand_total)}</span><StatusBadge status={s.status} /></div>
              </div>
            ))}
          </div>
          {msgs.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 flex items-center gap-2 font-medium text-white"><MessageCircle className="h-4 w-4 text-brand-400" /> WhatsApp requests</h2>
              <div className="space-y-2">{msgs.map((m) => <div key={m.id} className="rounded-xl bg-ink-900 p-3 text-sm"><div className="text-slate-200">“{m.message}”</div><div className="mt-1 text-xs text-slate-500">{m.category.replace('_', ' ')} · {timeAgo(m.created_at)}</div></div>)}</div>
            </>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-white">Identity & check-in</h2>
          <dl className="space-y-2 text-sm">
            {[['ID type', g.id_type?.replace('_', ' ') ?? '—'], ['ID number', g.id_number ?? '—'], ['Date of birth', g.date_of_birth ? prettyDate(g.date_of_birth, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'], ['Address', g.address ?? '—']].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right capitalize text-slate-200">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {g.id_document_url && (g.id_document_url.startsWith('data:application/pdf') ? <a href={g.id_document_url} download="id.pdf" className="flex aspect-[4/3] items-center justify-center rounded-lg bg-ink-900 text-xs text-brand-400">ID (PDF)</a> : <img src={g.id_document_url} alt="ID document" className="aspect-[4/3] w-full rounded-lg object-cover" />)}
            {g.signature_url && <img src={g.signature_url} alt="Signature" className="aspect-[4/3] w-full rounded-lg bg-white object-contain p-2" />}
          </div>
          {!g.id_document_url && <p className="mt-3 text-xs text-slate-500">No ID uploaded yet — the guest adds it during online check-in.</p>}
          <VerifyId id={g.id} verified={g.id_verified} hasDoc={Boolean(g.id_document_url)} />
        </Card>
      </div>
    </div>
  )
}
