import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import { publicIntegrations } from '@/lib/viasocket/view'
import StaffView from './StaffView'

export const metadata = { title: 'Staff' }

export default function StaffPage() {
  const hotel = currentHotel()!
  const d = db()
  const employees = d.employees.filter((e) => e.hotel_id === hotel.id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const weekAgo = Date.now() - 7 * 864e5
  const shifts = d.attendance.filter((s) => s.hotel_id === hotel.id && (!s.clock_out || new Date(s.clock_in).getTime() > weekAgo))
  const keka = publicIntegrations(hotel).apps.keka
  return <StaffView employees={employees} shifts={shifts} keka={{ connected: keka.connected, ready: keka.ready, shiftHours: Number(keka.config.shiftHours) || 9 }} configured={publicIntegrations(hotel).configured} />
}
