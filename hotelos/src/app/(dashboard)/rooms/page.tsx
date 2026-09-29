import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import RoomsView from './RoomsView'

export const metadata = { title: 'Rooms' }

export default function RoomsPage() {
  const hotel = currentHotel()!
  const d = db()
  const rooms = d.rooms.filter((r) => r.hotel_id === hotel.id).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
  const guestIn = Object.fromEntries(d.reservations.filter((r) => r.hotel_id === hotel.id && r.status === 'checked_in').map((r) => [r.room_id, { name: d.guests.find((g) => g.id === r.guest_id)?.name ?? '', out: r.check_out }]))
  return <RoomsView rooms={rooms} guestIn={guestIn} />
}
