import { db, findReservationByToken, mutate } from '@/lib/db'
import { handle, json } from '@/lib/http'
import { checkInReservation } from '@/lib/operations'
import { today } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Step 7. Marks digital check-in complete. On arrival day the guest is checked straight in
 * (room → occupied, folio opened, onCheckin: Slack + WhatsApp welcome). Earlier, the front desk
 * sees "pre-checked-in" and onCheckin fires when they hand over the key.
 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  return handle(async () => {
    const res = findReservationByToken(params.token)
    if (!res || res.status === 'cancelled') return json({ error: 'Invalid check-in link' }, 404)
    if (res.digital_checkin_completed) return json({ ok: true, already: true, room_number: res.room.number })
    const hotel = db().hotels.find((h) => h.id === res.hotel_id)!
    if (res.status === 'confirmed' && res.check_in <= today()) {
      await checkInReservation(hotel, res.id, 'digital')
    } else {
      mutate((d) => {
        const r = d.reservations.find((x) => x.id === res.id)!
        r.digital_checkin_completed = true
        r.digital_checkin_at = new Date().toISOString()
      })
    }
    const after = findReservationByToken(params.token)!
    return json({ ok: true, room_number: after.room.number, status: after.status })
  })
}
