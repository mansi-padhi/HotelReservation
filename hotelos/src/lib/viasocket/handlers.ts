/**
 * Handlers are JavaScript strings viaSocket runs in its sandbox each time an event fires.
 * They stand alone (no imports); everything they need is baked in at subscribe time.
 * The event is context.req.body — for WhatsApp Cloud "Message Notification" it is Meta's
 * webhook shape: entry[0].changes[0].value.{messages[0], contacts[0], metadata}.
 */
import { webhookSecretFor } from '../auth'

/** Template B from the viaSocket doc: tell our own product, with our own auth header. */
export function whatsappInboundHandler(opts: { appUrl: string; hotelId: string }) {
  const secret = webhookSecretFor(opts.hotelId)
  return `
const event = context.req.body || {}
const value = (((event.entry || [])[0] || {}).changes || [])[0]?.value || {}
const msg = (value.messages || [])[0]
if (!msg) return { skipped: "no message in event" }
const contact = (value.contacts || [])[0] || {}
const res = await fetch(${JSON.stringify(`${opts.appUrl}/api/webhooks/whatsapp`)}, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-secret": ${JSON.stringify(secret)},
    "x-hotel-id": ${JSON.stringify(opts.hotelId)}
  },
  body: JSON.stringify({
    from: msg.from,
    name: contact.profile ? contact.profile.name : undefined,
    message: msg.text ? msg.text.body : (msg.button ? msg.button.text : "[" + msg.type + "]"),
    type: msg.type,
    timestamp: msg.timestamp,
    phone_number_id: value.metadata ? value.metadata.phone_number_id : undefined
  })
})
return { delivered: res.status }
`.trim()
}

/** The same handler with the secret masked, for showing in the UI. */
export function maskHandler(code: string) {
  return code.replace(/("x-webhook-secret":\s*")([^"]+)(")/, (_m, a, s: string, c) => `${a}${s.slice(0, 6)}••••••••${c}`)
}
