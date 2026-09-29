import { CheckCircle2, XCircle } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { db, findReservationByToken } from '@/lib/db'
import { prettyDate } from '@/lib/utils'
import CheckinWizard from './CheckinWizard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Online check-in' }

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f6f5f1] text-ink-900" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex justify-center"><Logo light suffix={null} /></div>
        {children}
      </div>
    </div>
  )
}

export default function CheckinPage({ params }: { params: { token: string } }) {
  const res = findReservationByToken(params.token)
  if (!res) return <Shell><Notice icon="x" title="Invalid or expired link" body="Please use the latest link from your WhatsApp or email, or contact the front desk." /></Shell>
  const hotel = db().hotels.find((h) => h.id === res.hotel_id)!
  if (res.status === 'cancelled') return <Shell><Notice icon="x" title="This reservation was cancelled" body={`Questions? Call us on ${hotel.phone}.`} /></Shell>
  if (res.digital_checkin_completed || res.status === 'checked_out')
    return <Shell><Notice icon="ok" title={res.status === 'checked_out' ? 'Thanks for staying with us!' : 'You’re all checked in'} body={res.status === 'checked_out' ? 'Your invoice was sent on WhatsApp and email.' : `Room ${res.room.number} · ${prettyDate(res.check_in, { weekday: 'long', day: 'numeric', month: 'long' })}. WhatsApp us if you need anything.`} /></Shell>

  return (
    <Shell>
      <CheckinWizard
        token={params.token}
        hotel={{ name: hotel.name, address: hotel.address, phone: hotel.phone }}
        res={{
          code: res.code, check_in: res.check_in, check_out: res.check_out, nights: res.total_nights, adults: res.adults, children: res.children,
          room_type: res.room.type, room_number: res.room.number, rate: res.rate_per_night, room_total: res.room_total, tax: res.tax_amount,
          grand_total: res.grand_total, deposit_paid: res.deposit_paid, balance_due: res.balance_due, special_requests: res.special_requests ?? '',
        }}
        guest={{ name: res.guest.name, email: res.guest.email ?? '', phone: res.guest.phone, date_of_birth: res.guest.date_of_birth ?? '', nationality: res.guest.nationality ?? '', address: res.guest.address ?? '', has_id: Boolean(res.guest.id_document_url), has_photo: Boolean(res.guest.photo_url), has_signature: Boolean(res.guest.signature_url) }}
      />
    </Shell>
  )
}

function Notice({ icon, title, body }: { icon: 'ok' | 'x'; title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
      {icon === 'ok' ? <CheckCircle2 className="mx-auto h-12 w-12 text-brand-600" /> : <XCircle className="mx-auto h-12 w-12 text-red-500" />}
      <h1 className="mt-4 font-display text-3xl">{title}</h1>
      <p className="mt-2 text-stone-600">{body}</p>
    </div>
  )
}
