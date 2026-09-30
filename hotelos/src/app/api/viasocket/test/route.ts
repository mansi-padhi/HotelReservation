import { requireHotel } from '@/lib/auth'
import { calendarEvent, gmailSend, sheetRow, SHEETS_NEEDS, slackPost, waText } from '@/lib/automations/inputs'
import { safeRun } from '@/lib/automations/run'
import { body, handle, json } from '@/lib/http'
import type { AppKey } from '@/lib/types'
import { today } from '@/lib/utils'
import { APPS } from '@/lib/viasocket/apps'

export const dynamic = 'force-dynamic'

/** Sends one real action through viaSocket so the hotel can see an app work before relying on it. */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { app, to } = await body<{ app: AppKey; to?: string }>(req)
    const def = APPS[app]
    if (!def) return json({ error: 'Unknown app' }, 400)
    const stamp = new Date().toLocaleString('en-IN')
    const common = { hotel, event: 'test' as const, app }
    let r
    if (app === 'whatsapp') {
      if (!to) return json({ error: 'Enter a WhatsApp number that messaged your business number in the last 24h' }, 400)
      r = await safeRun({ ...common, action: def.actions.sendText!, needs: ['phone_id'], summary: `Test WhatsApp → ${to}`, build: (c) => waText(c, to, `✅ Test from ${hotel.name} via Hotelator OS + viaSocket (${stamp})`) })
    } else if (app === 'gmail') {
      r = await safeRun({ ...common, action: def.actions.sendEmail!, summary: `Test email → ${to || hotel.email}`, build: (c) => gmailSend(c, hotel, to || hotel.email, `Test from ${hotel.name}`, `<p>✅ Gmail is connected to <b>Hotelator OS</b> through viaSocket.</p><p style="color:#6b7280">${stamp}</p>`) })
    } else if (app === 'slack') {
      r = await safeRun({ ...common, action: def.actions.sendMessage!, needs: ['channel_id'], summary: 'Test Slack message', build: (c) => slackPost(c, `✅ *Hotelator OS is connected.* Ops alerts for ${hotel.name} will land in this channel. _(${stamp})_`) })
    } else if (app === 'sheets') {
      r = await safeRun({
        ...common, action: def.actions.addRow!, needs: SHEETS_NEEDS, summary: 'Test ledger row',
        build: (c) => sheetRow(c, { event: 'test', reservation_code: 'TEST', guest_name: 'Test Guest', guest_phone: '+91 90000 00000', room: '101', room_type: 'Standard', check_in: today(), check_out: today(), nights: 1, amount: 0, paid: 0, status: 'test', source: 'direct', timestamp: new Date().toISOString() }),
      })
    } else {
      r = await safeRun({ ...common, action: def.actions.createEvent!, needs: ['calendar_id'], summary: 'Test calendar event', build: (c) => calendarEvent(c, hotel, { summary: '✅ Hotelator OS test event', description: 'Created through viaSocket to confirm the connection.', date: today(), time: '18:00', duration: '00:30' }) })
    }
    return json(r, r.ok ? 200 : r.status === 'skipped' ? 409 : 502)
  })
}
