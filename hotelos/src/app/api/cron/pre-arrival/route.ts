import { runPreArrival } from '@/lib/automations'
import { cronHotels } from '@/lib/cron'
import { handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Daily 09:00 — WhatsApp nudge to arrivals in 3 days who haven't checked in online. */
async function run(req: Request) {
  return handle(async () => {
    const hotels = cronHotels(req)
    if (!hotels) return json({ error: 'Forbidden' }, 403)
    let sent = 0
    for (const h of hotels) sent += await runPreArrival(h)
    return json({ ok: true, reservations: sent })
  })
}

export const GET = run
export const POST = run
