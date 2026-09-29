import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import HousekeepingBoard from './HousekeepingBoard'

export const metadata = { title: 'Housekeeping' }

export default function HousekeepingPage() {
  const hotel = currentHotel()!
  const d = db()
  const rooms = d.rooms.filter((r) => r.hotel_id === hotel.id)
  const tasks = d.housekeeping_tasks.filter((t) => t.hotel_id === hotel.id).map((t) => ({ ...t, room: rooms.find((r) => r.id === t.room_id) }))
  return <HousekeepingBoard tasks={tasks} rooms={rooms} />
}
