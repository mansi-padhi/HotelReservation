import { requireHotel } from '@/lib/auth'
import { log } from '@/lib/automations/run'
import { getHotel, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { AppKey } from '@/lib/types'
import { APPS } from '@/lib/viasocket/apps'
import { enableApp, findEnabledApp } from '@/lib/viasocket/client'
import { publicIntegrations } from '@/lib/viasocket/view'

export const dynamic = 'force-dynamic'

/**
 * Called after the connect popup succeeds. Every app here runs actions, so we enable it —
 * once per hotel and app, looking up an existing script first — and keep auth_id + script_id server-side.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { app, auth_id } = await body<{ app: AppKey; auth_id: string }>(req)
    const def = APPS[app]
    if (!def || !auth_id) return json({ error: 'app and auth_id are required' }, 400)

    const existing = hotel.integrations[app]
    // Always ask viaSocket rather than trusting our cached script_id: an app can be re-enabled or
    // its script deleted on viaSocket's side (e.g. from Automation Studio) without us hearing about it.
    const scriptId = (await findEnabledApp(hotel.id, def.serviceId, auth_id)) ?? (await enableApp(hotel.id, def.serviceId, auth_id))

    mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      const keepConfig = existing?.auth_id === auth_id ? existing.config : {}
      const staticDefaults = Object.fromEntries([...(def.staticFields ?? []), ...(def.textFields ?? [])].map((f) => [f.key, f.default]))
      h.integrations[app] = { auth_id, script_id: scriptId, config: { ...staticDefaults, ...keepConfig }, connected_at: new Date().toISOString() }
    })
    log({ hotel_id: hotel.id, event_type: 'test', app, status: 'success', summary: `${def.name} connected and enabled via viaSocket` })
    return json({ ok: true, integrations: publicIntegrations(getHotel(hotel.id)!) })
  })
}
