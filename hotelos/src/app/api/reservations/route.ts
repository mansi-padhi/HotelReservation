import { requireHotel } from '@/lib/auth'
import { reservationViews } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import { createReservation, type NewReservationInput } from '@/lib/operations'
import { checkinUrl } from '@/lib/automations'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(() => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ reservations: reservationViews(hotel.id) })
  })
}

/** Creates the reservation, then fires onNewBooking (WhatsApp, Gmail, Calendar, Sheets, VIP). */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const input = await body<NewReservationInput>(req)
    const reservation = await createReservation(hotel, input)
    return json({ reservation, checkin_url: checkinUrl(reservation) }, 201)
  })
}
