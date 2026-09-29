import { requireHotel } from '@/lib/auth'
import { db, mutate, resetDB } from '@/lib/db'
import { handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Re-seeds demo data but keeps the hotel's viaSocket connections, subscriptions and studio flows. */
export async function POST() {
  return handle(() => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const keep = db().hotels.find((h) => h.id === hotel.id)!
    const { integrations, subscriptions, custom_flows, automation_toggles } = keep
    resetDB()
    mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)
      if (h) Object.assign(h, { integrations, subscriptions, custom_flows, automation_toggles })
    })
    return json({ ok: true })
  })
}
