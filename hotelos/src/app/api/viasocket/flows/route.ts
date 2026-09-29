import { requireHotel } from '@/lib/auth'
import { studioPayload } from '@/lib/automations'
import { log } from '@/lib/automations/run'
import { STUDIO_EVENTS } from '@/lib/automations/catalog'
import { db, getHotel, joinReservation, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { CustomFlow, HotelEvent } from '@/lib/types'
import { runCustomFlow } from '@/lib/viasocket/client'
import { publicIntegrations } from '@/lib/viasocket/view'

export const dynamic = 'force-dynamic'

const FLOW_URL = /^https:\/\/flow\.sokt\.io\/func\/[A-Za-z0-9_-]+$/

/**
 * The prebuilt UI's `flow` listener posts here. We key by flow.id and keep webhookurl
 * server-side (it runs the hotel's apps); the browser only ever gets hasUrl.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const f = await body<{ id: string; action: string; status?: string; title?: string; description?: string; webhookurl?: string; payload?: unknown; serviceIcons?: string[] }>(req)
    if (!f.id || !f.action) return json({ error: 'id and action are required' }, 400)
    if (f.webhookurl && !FLOW_URL.test(f.webhookurl)) return json({ error: 'Unexpected flow URL' }, 400)

    const fresh = mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      const existing = h.custom_flows.find((x) => x.id === f.id)
      if (f.action === 'deleted') {
        h.custom_flows = h.custom_flows.filter((x) => x.id !== f.id)
        return h
      }
      const status = (f.action === 'paused' ? 'paused' : f.action === 'initiated' ? 'drafted' : 'active') as CustomFlow['status']
      const next: CustomFlow = {
        id: f.id,
        title: f.title || existing?.title || 'Untitled automation',
        description: f.description ?? existing?.description,
        status: f.action === 'initiated' && existing ? existing.status : status,
        webhookurl: f.webhookurl || existing?.webhookurl,
        payload: f.payload ?? existing?.payload,
        serviceIcons: f.serviceIcons ?? existing?.serviceIcons,
        events: existing?.events ?? ['new_booking'],
        updated_at: new Date().toISOString(),
      }
      h.custom_flows = [next, ...h.custom_flows.filter((x) => x.id !== f.id)]
      return h
    })
    if (f.action === 'published') log({ hotel_id: hotel.id, event_type: 'test', app: 'custom', status: 'success', summary: `Studio flow “${f.title || f.id}” published` })
    return json({ ok: true, integrations: publicIntegrations(fresh) })
  })
}

/** Choose which hotel events feed a studio flow. */
export async function PATCH(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { id, events } = await body<{ id: string; events: HotelEvent[] }>(req)
    const clean = (events ?? []).filter((e) => STUDIO_EVENTS.includes(e))
    const fresh = mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      const flow = h.custom_flows.find((x) => x.id === id)
      if (flow) flow.events = clean
      return h
    })
    return json({ ok: true, integrations: publicIntegrations(fresh) })
  })
}

/** Fire a studio flow once with a real sample payload. */
export async function PUT(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { id } = await body<{ id: string }>(req)
    const flow = hotel.custom_flows.find((x) => x.id === id)
    if (!flow?.webhookurl) return json({ error: 'Publish the flow in the studio first' }, 400)
    const sample = db().reservations.find((r) => r.hotel_id === hotel.id && r.status === 'confirmed')
    const payload = studioPayload(flow.events[0] ?? 'new_booking', getHotel(hotel.id)!, sample ? joinReservation(sample) : undefined, { test: true })
    try {
      const response = await runCustomFlow(flow.webhookurl, payload)
      log({ hotel_id: hotel.id, event_type: 'test', app: 'custom', status: 'success', summary: `Studio flow “${flow.title}” test run`, details: { payload, response } })
      return json({ ok: true, response })
    } catch (e: any) {
      log({ hotel_id: hotel.id, event_type: 'test', app: 'custom', status: 'failed', summary: `Studio flow “${flow.title}” test failed — ${e.message}`, details: { payload } })
      return json({ error: e.message }, 502)
    }
  })
}
