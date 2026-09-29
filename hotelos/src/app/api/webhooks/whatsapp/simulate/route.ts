import { requireHotel } from '@/lib/auth'
import { onWhatsappInbound } from '@/lib/automations'
import { body, handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Admin-only: pretend a guest sent a WhatsApp message (same routing as the real webhook). */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { from, message } = await body<{ from: string; message: string }>(req)
    if (!from || !message?.trim()) return json({ error: 'from and message are required' }, 400)
    return json({ ok: true, ...(await onWhatsappInbound(hotel, { from, message, simulated: true })) })
  })
}
