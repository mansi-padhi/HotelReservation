import { requireHotel } from '@/lib/auth'
import { log } from '@/lib/automations/run'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { AppKey } from '@/lib/types'
import { APPS } from '@/lib/viasocket/apps'
import { revokeConnection, setFlowStatus } from '@/lib/viasocket/client'
import { publicIntegrations } from '@/lib/viasocket/view'

export const dynamic = 'force-dynamic'

/** Disable the flows built on the connection first, then revoke it (per the viaSocket doc). */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { app } = await body<{ app: AppKey }>(req)
    const conn = hotel.integrations[app]
    if (!APPS[app] || !conn) return json({ error: 'Not connected' }, 400)
    const warnings: string[] = []
    const subs = hotel.subscriptions.filter((s) => s.auth_id === conn.auth_id)
    for (const s of subs) await setFlowStatus(hotel.id, s.script_id, 0).catch((e) => warnings.push(`subscription: ${e.message}`))
    if (conn.script_id) await setFlowStatus(hotel.id, conn.script_id, 0).catch((e) => warnings.push(`script: ${e.message}`))
    await revokeConnection(hotel.id, conn.auth_id).catch((e) => warnings.push(`revoke: ${e.message}`))
    const fresh = mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      delete h.integrations[app]
      h.subscriptions = h.subscriptions.filter((s) => s.auth_id !== conn.auth_id)
      return h
    })
    log({ hotel_id: hotel.id, event_type: 'test', app, status: warnings.length ? 'failed' : 'success', summary: `${APPS[app].name} disconnected`, details: warnings.length ? { warnings } : undefined })
    return json({ ok: true, warnings, integrations: publicIntegrations(fresh) })
  })
}
