import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import MaintenanceView from './MaintenanceView'

export const metadata = { title: 'Maintenance' }

export default function MaintenancePage() {
  const hotel = currentHotel()!
  const d = db()
  const rooms = d.rooms.filter((r) => r.hotel_id === hotel.id)
  const requests = d.maintenance_requests.filter((m) => m.hotel_id === hotel.id).map((m) => ({ ...m, room_number: rooms.find((r) => r.id === m.room_id)?.number }))
  return <MaintenanceView requests={requests} rooms={rooms} slackReady={Boolean(hotel.integrations.slack?.config.channel_id)} />
}
