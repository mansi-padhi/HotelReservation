import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import InboxView from './InboxView'

export const metadata = { title: 'Guest inbox' }

export default function InboxPage() {
  const hotel = currentHotel()!
  const d = db()
  const inHouse = d.reservations
    .filter((r) => r.hotel_id === hotel.id && r.status === 'checked_in')
    .map((r) => {
      const g = d.guests.find((x) => x.id === r.guest_id)!
      return { phone: g.phone, name: g.name, room: d.rooms.find((x) => x.id === r.room_id)?.number ?? '' }
    })
  const messages = d.guest_requests.filter((m) => m.hotel_id === hotel.id)
  return <InboxView messages={messages} inHouse={inHouse} subscribed={hotel.subscriptions.find((s) => s.key === 'wa_inbound')?.status ?? null} />
}
