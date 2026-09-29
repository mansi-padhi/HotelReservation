import { notFound } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { db, joinReservation } from '@/lib/db'
import { inr, prettyDate } from '@/lib/utils'
import PrintButton from './PrintButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoice' }

/** Public invoice link sent at checkout (the folio id is an unguessable UUID). */
export default function InvoicePage({ params }: { params: { id: string } }) {
  const d = db()
  const folio = d.folios.find((f) => f.id === params.id)
  if (!folio) notFound()
  const res = joinReservation(d.reservations.find((r) => r.id === folio.reservation_id)!)
  const hotel = d.hotels.find((h) => h.id === folio.hotel_id)!
  const items = d.folio_items.filter((i) => i.folio_id === folio.id)
  const long = { day: 'numeric', month: 'short', year: 'numeric' } as const

  return (
    <div className="min-h-screen bg-[#f6f5f1] px-4 py-10 text-ink-900 print:bg-white print:p-0" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm print:shadow-none sm:p-12">
        <div className="flex items-start justify-between gap-6">
          <div><Logo light suffix={null} /><div className="mt-3 text-sm text-stone-500">{hotel.name}<br />{hotel.address}<br />{hotel.phone} · {hotel.email}</div></div>
          <div className="text-right"><div className="font-display text-3xl">Invoice</div><div className="mt-1 text-sm text-stone-500">#{res.code}-{folio.id.slice(-4).toUpperCase()}</div><div className="text-sm text-stone-500">{prettyDate(res.checked_out_at ?? new Date().toISOString(), long)}</div></div>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div><div className="text-xs font-semibold uppercase tracking-wider text-stone-400">Billed to</div><div className="mt-1 font-medium">{res.guest.name}</div><div className="text-stone-500">{res.guest.phone}<br />{res.guest.email}</div></div>
          <div><div className="text-xs font-semibold uppercase tracking-wider text-stone-400">Stay</div><div className="mt-1 font-medium">{res.room.type} · Room {res.room.number}</div><div className="text-stone-500">{prettyDate(res.check_in, long)} → {prettyDate(res.check_out, long)}<br />{res.total_nights} nights</div></div>
        </div>
        <table className="mt-10 w-full text-sm">
          <thead><tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wider text-stone-400"><th className="pb-2 font-medium">Description</th><th className="pb-2 text-right font-medium">Qty</th><th className="pb-2 text-right font-medium">Rate</th><th className="pb-2 text-right font-medium">Amount</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.id} className="border-b border-stone-100"><td className="py-3">{i.description}</td><td className="py-3 text-right">{i.quantity}</td><td className="py-3 text-right">{inr(i.unit_price)}</td><td className="py-3 text-right">{inr(i.total_price)}</td></tr>)}</tbody>
        </table>
        <div className="ml-auto mt-6 w-64 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span>{inr(folio.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">GST {Math.round(hotel.tax_rate * 100)}%</span><span>{inr(folio.tax_total)}</span></div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold"><span>Total</span><span>{inr(folio.grand_total)}</span></div>
          <div className="flex justify-between text-stone-500"><span>Paid</span><span>{inr(folio.paid_amount)}</span></div>
          <div className="flex justify-between font-medium"><span>Balance</span><span>{inr(folio.balance)}</span></div>
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-stone-100 pt-6 text-sm text-stone-500">
          <span>Thank you for staying with us 💚 <a href={hotel.google_review_url} className="font-medium text-brand-700">Leave a review</a></span>
          <PrintButton />
        </div>
      </div>
    </div>
  )
}
