import { requireHotel } from '@/lib/auth'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { AppKey } from '@/lib/types'
import { APPS } from '@/lib/viasocket/apps'
import { publicIntegrations } from '@/lib/viasocket/view'

export const dynamic = 'force-dynamic'

/** Stores what the hotel picked (channel, phone number, sheet + column mapping, calendar). */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { app, config } = await body<{ app: AppKey; config: Record<string, unknown> }>(req)
    if (!APPS[app] || !config || typeof config !== 'object') return json({ error: 'app and config are required' }, 400)
    if (!hotel.integrations[app]) return json({ error: 'Connect the app first' }, 400)
    const fresh = mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      const conn = h.integrations[app]!
      conn.config = { ...conn.config, ...config }
      return h
    })
    return json({ ok: true, integrations: publicIntegrations(fresh) })
  })
}
