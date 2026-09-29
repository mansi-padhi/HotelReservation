import { currentHotel } from '@/lib/auth'
import { studioPayload } from '@/lib/automations'
import { db, joinReservation } from '@/lib/db'
import { publicIntegrations } from '@/lib/viasocket/view'
import Studio from './Studio'

export const metadata = { title: 'Automation Studio' }

export default function StudioPage() {
  const hotel = currentHotel()!
  const sample = db().reservations.find((r) => r.hotel_id === hotel.id && r.status === 'confirmed')
  const payload = studioPayload('new_booking', hotel, sample ? joinReservation(sample) : undefined)
  const view = publicIntegrations(hotel)
  return <Studio hotelId={hotel.id} samplePayload={payload} initialFlows={view.studioFlows} configured={view.configured} />
}
