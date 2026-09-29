import { requireHotel } from '@/lib/auth'
import { appUrl } from '@/lib/automations'
import { log } from '@/lib/automations/run'
import { getHotel, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import { APPS } from '@/lib/viasocket/apps'
import { setFlowStatus, subscribeEvent, updateSubscription } from '@/lib/viasocket/client'
import { whatsappInboundHandler } from '@/lib/viasocket/handlers'
import { publicIntegrations } from '@/lib/viasocket/view'

export const dynamic = 'force-dynamic'

const WA = APPS.whatsapp
const TRIGGER = WA.triggers!.inbound!

function localWarning(url: string) {
  return /localhost|127\.0\.0\.1/.test(url)
    ? 'NEXT_PUBLIC_APP_URL points at localhost — viaSocket runs the handler in the cloud and cannot reach it. Use a public URL (e.g. an https tunnel) and redeploy the handler.'
    : undefined
}

/** Subscribe once: WhatsApp "Message Notification" with a handler that calls our webhook. */
export async function POST() {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const conn = hotel.integrations.whatsapp
    if (!conn) return json({ error: 'Connect WhatsApp first' }, 400)
    const { wba_id, phone_id } = conn.config as { wba_id?: string; phone_id?: string }
    if (!wba_id || !phone_id) return json({ error: 'Pick the WhatsApp Business account and phone number first' }, 400)

    const inputData = { wba_id, phone_id }
    const existing = hotel.subscriptions.find((s) => s.key === 'wa_inbound' && s.auth_id === conn.auth_id && JSON.stringify(s.inputData) === JSON.stringify(inputData))
    if (existing) return json({ ok: true, already: true, integrations: publicIntegrations(hotel) })

    const url = appUrl()
    const code = whatsappInboundHandler({ appUrl: url, hotelId: hotel.id })
    const scriptId = await subscribeEvent(hotel.id, TRIGGER, conn.auth_id, inputData, { code }, { hotel_id: hotel.id, name: `WA inbound – ${hotel.name}` })

    // The subscription record the doc asks for: the response is only a script_id.
    mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      h.subscriptions = h.subscriptions.filter((s) => s.key !== 'wa_inbound')
      h.subscriptions.push({ key: 'wa_inbound', unique_identifier: hotel.id, service_id: WA.serviceId, trigger_version_id: TRIGGER, script_id: scriptId, auth_id: conn.auth_id, inputData, delivery: { code }, status: 'active', created_at: new Date().toISOString() })
    })
    log({ hotel_id: hotel.id, event_type: 'guest_message', app: 'whatsapp', status: 'success', summary: 'Subscribed to inbound WhatsApp messages (handler runs on viaSocket)' })
    return json({ ok: true, warning: localWarning(url), integrations: publicIntegrations(getHotel(hotel.id)!) })
  })
}

/** pause | resume | redeploy (swap the live handler in place, e.g. after the app URL changes). */
export async function PATCH(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { action } = await body<{ action: 'pause' | 'resume' | 'redeploy' }>(req)
    const sub = hotel.subscriptions.find((s) => s.key === 'wa_inbound')
    if (!sub) return json({ error: 'Not subscribed' }, 400)
    let warning: string | undefined
    if (action === 'redeploy') {
      const code = whatsappInboundHandler({ appUrl: appUrl(), hotelId: hotel.id })
      await updateSubscription(hotel.id, sub.script_id, { code })
      mutate((d) => { d.hotels.find((x) => x.id === hotel.id)!.subscriptions.find((s) => s.key === 'wa_inbound')!.delivery = { code } })
      warning = localWarning(appUrl())
    } else {
      await setFlowStatus(hotel.id, sub.script_id, action === 'pause' ? 0 : 1)
      mutate((d) => { d.hotels.find((x) => x.id === hotel.id)!.subscriptions.find((s) => s.key === 'wa_inbound')!.status = action === 'pause' ? 'paused' : 'active' })
    }
    return json({ ok: true, warning, integrations: publicIntegrations(getHotel(hotel.id)!) })
  })
}

export async function DELETE() {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const sub = hotel.subscriptions.find((s) => s.key === 'wa_inbound')
    if (sub) await setFlowStatus(hotel.id, sub.script_id, 0).catch(() => undefined)
    const fresh = mutate((d) => {
      const h = d.hotels.find((x) => x.id === hotel.id)!
      h.subscriptions = h.subscriptions.filter((s) => s.key !== 'wa_inbound')
      return h
    })
    return json({ ok: true, integrations: publicIntegrations(fresh) })
  })
}
