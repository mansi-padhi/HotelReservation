import { safeEqual, webhookSecretFor } from '@/lib/auth'
import { onWhatsappInbound } from '@/lib/automations'
import { getHotel } from '@/lib/db'
import { body, handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Called by the handler running on viaSocket for each inbound WhatsApp message. */
export async function POST(req: Request) {
  return handle(async () => {
    const hotelId = req.headers.get('x-hotel-id') || ''
    const secret = req.headers.get('x-webhook-secret') || ''
    if (!hotelId || !safeEqual(secret, webhookSecretFor(hotelId))) return json({ error: 'Forbidden' }, 403)
    const hotel = getHotel(hotelId)
    if (!hotel) return json({ error: 'Unknown hotel' }, 404)
    const { from, message, name } = await body<{ from: string; message: string; name?: string }>(req)
    if (!from) return json({ error: 'from is required' }, 400)
    const result = await onWhatsappInbound(hotel, { from, message: message ?? '', name })
    return json({ ok: true, ...result })
  })
}
