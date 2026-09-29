import { checkinUrl } from '@/lib/automations'
import { db } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import { createReservation } from '@/lib/operations'
import { DEMO_HOTEL_ID } from '@/lib/seed'

export const dynamic = 'force-dynamic'

/** Guest-facing booking from the website. Same pipeline as the admin: onNewBooking fires. */
export async function POST(req: Request) {
  return handle(async () => {
    const hotel = db().hotels.find((h) => h.id === DEMO_HOTEL_ID)!
    const b = await body<{ guest_name: string; guest_phone: string; guest_email?: string; room_type: string; check_in: string; check_out: string; adults?: number; children?: number; special_requests?: string }>(req)
    const res = await createReservation(hotel, { ...b, room_id: undefined, booking_source: 'online', is_vip: false })
    return json({ code: res.code, room_type: res.room.type, room_number: res.room.number, grand_total: res.grand_total, nights: res.total_nights, check_in: res.check_in, check_out: res.check_out, checkin_url: checkinUrl(res) }, 201)
  })
}
