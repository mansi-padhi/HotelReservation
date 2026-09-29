import { currentHotel } from '@/lib/auth'
import { checkinUrl } from '@/lib/automations'
import { db, reservationViews } from '@/lib/db'
import ReservationsView from './ReservationsView'

export const metadata = { title: 'Reservations' }

export default function ReservationsPage({ searchParams }: { searchParams: { new?: string } }) {
  const hotel = currentHotel()!
  const d = db()
  const views = reservationViews(hotel.id).map((r) => ({ ...r, checkin_url: checkinUrl(r) }))
  const rooms = d.rooms.filter((r) => r.hotel_id === hotel.id)
  const folios = d.folios.filter((f) => f.hotel_id === hotel.id)
  const items = d.folio_items.filter((i) => folios.some((f) => f.id === i.folio_id))
  const logs = d.automation_logs.filter((l) => l.hotel_id === hotel.id && l.reservation_id)
  return <ReservationsView reservations={views} rooms={rooms} folios={folios} items={items} logs={logs} taxRate={hotel.tax_rate} openNew={searchParams.new === '1'} />
}
