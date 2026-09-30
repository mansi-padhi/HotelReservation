/**
 * The 11 hotel automations. Each step is one viaSocket action run through safeRun(),
 * so a missing connection is logged as "skipped" (with the payload it would have sent)
 * and never breaks the hotel operation that triggered it.
 */
import { db, getHotel, joinReservation, mutate } from '../db'
import type { Folio, Guest, Hotel, HotelEvent, MaintenanceRequest, ReservationView } from '../types'
import { addDays, inr, last10, prettyDate, today, uid } from '../utils'
import { APPS } from '../viasocket/apps'
import { runCustomFlow } from '../viasocket/client'
import { bookingEmailHTML, checkinEmailHTML, invoiceEmailHTML, welcomeEmailHTML } from './emails'
import { calendarEvent, gmailSend, sheetRow, SHEETS_NEEDS, slackPost, waText } from './inputs'
import { isEnabled, log, safeRun } from './run'

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
export const checkinUrl = (res: { checkin_link_token: string }) => `${appUrl()}/checkin/${res.checkin_link_token}`

const A = {
  wa: APPS.whatsapp.actions.sendText!,
  mail: APPS.gmail.actions.sendEmail!,
  slack: APPS.slack.actions.sendMessage!,
  sheet: APPS.sheets.actions.addRow!,
  cal: APPS.gcal.actions.createEvent!,
}

const first = (name: string) => name.split(' ')[0]
const fresh = (hotel: Hotel) => getHotel(hotel.id) ?? hotel

function ledgerRow(event: string, res: ReservationView, extra: Record<string, string | number> = {}) {
  return {
    event,
    reservation_code: res.code,
    guest_name: res.guest.name,
    guest_phone: res.guest.phone,
    guest_email: res.guest.email ?? '',
    room: res.room.number,
    room_type: res.room.type,
    check_in: res.check_in,
    check_out: res.check_out,
    nights: res.total_nights,
    amount: res.grand_total,
    paid: res.deposit_paid,
    status: res.status,
    source: res.booking_source,
    timestamp: new Date().toISOString(),
    ...extra,
  }
}

// ── Automation Studio flows (built by the hotel in the prebuilt UI) ─────────
export function studioPayload(event: HotelEvent, hotel: Hotel, res?: ReservationView, extra: Record<string, unknown> = {}) {
  return {
    event,
    occurred_at: new Date().toISOString(),
    hotel: { id: hotel.id, name: hotel.name, phone: hotel.phone, email: hotel.email },
    ...(res
      ? {
          reservation: {
            code: res.code,
            check_in: res.check_in,
            check_out: res.check_out,
            nights: res.total_nights,
            status: res.status,
            is_vip: res.is_vip,
            source: res.booking_source,
            grand_total: res.grand_total,
            balance_due: res.balance_due,
            checkin_url: checkinUrl(res),
          },
          guest: { name: res.guest.name, phone: res.guest.phone, email: res.guest.email ?? '' },
          room: { number: res.room.number, type: res.room.type },
        }
      : {}),
    ...extra,
  }
}

export async function fireStudioFlows(hotel: Hotel, event: HotelEvent, payload: unknown, reservationId?: string) {
  const flows = fresh(hotel).custom_flows.filter((f) => f.status === 'active' && f.webhookurl && f.events.includes(event))
  await Promise.all(
    flows.map(async (flow) => {
      try {
        const result = await runCustomFlow(flow.webhookurl!, payload)
        log({ hotel_id: hotel.id, reservation_id: reservationId, event_type: event, app: 'custom', status: 'success', summary: `Studio flow “${flow.title}” ran`, details: { flow_id: flow.id, payload, response: result } })
      } catch (e: any) {
        log({ hotel_id: hotel.id, reservation_id: reservationId, event_type: event, app: 'custom', status: 'failed', summary: `Studio flow “${flow.title}” failed — ${e.message}`, details: { flow_id: flow.id, payload } })
      }
    }),
  )
}

// ── 1. New booking ─────────────────────────────────────────────────────────
export async function onNewBooking(res: ReservationView, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const url = checkinUrl(res)
  const base = { hotel, reservationId: res.id, event: 'new_booking' as const }
  await Promise.all([
    safeRun({
      ...base, app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Booking confirmation → ${res.guest.name}`,
      build: (c) => waText(c, res.guest.phone,
        `Hi ${first(res.guest.name)}! 🏨 Your booking at *${hotel.name}* is confirmed.\n\n` +
        `🧾 ${res.code}\n📅 Check-in: ${prettyDate(res.check_in)}\n📅 Check-out: ${prettyDate(res.check_out)}\n🛏 ${res.room.type} · Room ${res.room.number}\n💰 Total: ${inr(res.grand_total)}\n\n` +
        `✅ Skip the front desk — check in online:\n${url}`),
    }),
    res.guest.email
      ? safeRun({ ...base, app: 'gmail', action: A.mail, summary: `Confirmation email → ${res.guest.email}`, build: (c) => gmailSend(c, hotel, res.guest.email!, `Booking confirmed – ${hotel.name} | ${prettyDate(res.check_in)}`, bookingEmailHTML(res, hotel, url)) })
      : Promise.resolve(),
    safeRun({
      ...base, app: 'gcal', action: A.cal, needs: ['calendar_id'], summary: `Arrival event for ${res.guest.name}`,
      build: (c) => calendarEvent(c, hotel, { summary: `Arrival: ${res.guest.name} – Room ${res.room.number}`, description: `Booking ${res.code}\nPhone: ${res.guest.phone}\nNights: ${res.total_nights}\nSource: ${res.booking_source}${res.special_requests ? `\nRequests: ${res.special_requests}` : ''}`, date: res.check_in, time: '14:00', duration: '01:00' }),
    }),
    safeRun({ ...base, app: 'sheets', action: A.sheet, needs: SHEETS_NEEDS, summary: `Ledger row for ${res.code}`, build: (c) => sheetRow(c, ledgerRow('new_booking', res)) }),
    fireStudioFlows(hotel, 'new_booking', studioPayload('new_booking', hotel, res), res.id),
  ])
  if (res.is_vip) await onVIPReservation(res, hotel)
}

// ── 2. Pre-arrival ─────────────────────────────────────────────────────────
export async function onPreArrival(res: ReservationView, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  await safeRun({
    hotel, reservationId: res.id, event: 'pre_arrival', app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Pre-arrival nudge → ${res.guest.name}`,
    build: (c) => waText(c, res.guest.phone,
      `Hi ${first(res.guest.name)}! 👋\n\nYour stay at *${hotel.name}* starts in 3 days — *${prettyDate(res.check_in, { weekday: 'long', day: 'numeric', month: 'short' })}*.\n\n` +
      `🔑 Skip the front desk — complete online check-in:\n${checkinUrl(res)}\n\nYou can also ask us for:\n🚗 Airport pickup  🍳 Early breakfast  🛏 Room preferences\n\nJust reply here anytime!`),
  })
}

export async function runPreArrival(hotel: Hotel) {
  const target = addDays(today(), 3)
  const due = db().reservations.filter((r) => r.hotel_id === hotel.id && r.status === 'confirmed' && r.check_in === target && !r.digital_checkin_completed)
  for (const r of due) await onPreArrival(joinReservation(r), hotel)
  return due.length
}

// ── 3. Check-in ────────────────────────────────────────────────────────────
export async function onCheckin(res: ReservationView, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const base = { hotel, reservationId: res.id, event: 'checkin' as const }
  await Promise.all([
    safeRun({
      ...base, app: 'slack', action: A.slack, needs: ['channel_id'], summary: `Check-in alert: ${res.guest.name} → ${res.room.number}`,
      build: (c) => slackPost(c, `✅ *Guest checked in*\n*${res.guest.name}* → Room *${res.room.number}* (${res.room.type})\n📅 ${prettyDate(res.check_in)} → ${prettyDate(res.check_out)} (${res.total_nights}n)\n💳 Balance due: ${inr(res.balance_due)}${res.is_vip ? '\n⭐ *VIP GUEST*' : ''}${res.special_requests ? `\n📝 ${res.special_requests}` : ''}`),
    }),
    safeRun({
      ...base, app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Welcome message → ${res.guest.name}`,
      build: (c) => waText(c, res.guest.phone,
        `Welcome to *${hotel.name}*, ${first(res.guest.name)}! 🎉\n\n🔑 *Room ${res.room.number}*\n📅 Check-out: ${prettyDate(res.check_out)}, 11:00\n📶 Wi-Fi: Hotelator-Guest\n\n` +
        `*Need anything? Just WhatsApp us here:*\n🍽 Room service\n🧹 Housekeeping — “extra towels please”\n🔧 Maintenance — “AC not working”\n\nHave a wonderful stay!`),
    }),
    res.guest.email
      ? safeRun({ ...base, app: 'gmail', action: A.mail, summary: `Check-in confirmation (Room ${res.room.number}) → ${res.guest.email}`, build: (c) => gmailSend(c, hotel, res.guest.email!, `You’re checked in: Room ${res.room.number} – ${hotel.name}`, checkinEmailHTML(res, hotel, { account: `${appUrl()}/account` })) })
      : Promise.resolve(),
    fireStudioFlows(hotel, 'checkin', studioPayload('checkin', hotel, res), res.id),
  ])
}

// ── 4 + 5. Checkout, invoice, housekeeping ─────────────────────────────────
export async function onCheckout(res: ReservationView, folio: Folio, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const invoiceUrl = `${appUrl()}/invoice/${folio.id}`
  const items = db().folio_items.filter((i) => i.folio_id === folio.id)
  const base = { hotel, reservationId: res.id, event: 'checkout' as const }
  await Promise.all([
    safeRun({
      ...base, app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Thank-you + invoice → ${res.guest.name}`,
      build: (c) => waText(c, res.guest.phone,
        `Thank you for staying at *${hotel.name}*, ${first(res.guest.name)}! 🙏\n\n🧾 Your invoice (${inr(folio.grand_total)}):\n${invoiceUrl}\n\n⭐ *Would you share a quick review?*\n${hotel.google_review_url}\n\nHope to see you again! 💚`),
    }),
    res.guest.email
      ? safeRun({ ...base, app: 'gmail', action: A.mail, summary: `Invoice email → ${res.guest.email}`, build: (c) => gmailSend(c, hotel, res.guest.email!, `Your invoice – ${hotel.name} | ${prettyDate(res.check_in)}–${prettyDate(res.check_out)}`, invoiceEmailHTML(res, hotel, folio, items, invoiceUrl)) })
      : Promise.resolve(),
    safeRun({ ...base, app: 'sheets', action: A.sheet, needs: SHEETS_NEEDS, summary: `Checkout row for ${res.code}`, build: (c) => sheetRow(c, ledgerRow('checkout', res, { amount: folio.grand_total, paid: folio.paid_amount })) }),
    fireStudioFlows(hotel, 'checkout', studioPayload('checkout', hotel, res, { invoice_url: invoiceUrl, folio_total: folio.grand_total }), res.id),
  ])
}

export async function onCheckoutCreateHousekeeping(res: ReservationView, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  mutate((d) => {
    const room = d.rooms.find((r) => r.id === res.room_id)
    if (room) room.status = 'dirty'
    d.housekeeping_tasks.unshift({
      id: uid('hk'), hotel_id: hotel.id, room_id: res.room_id, reservation_id: res.id, type: 'cleaning', status: 'pending',
      priority: res.is_vip ? 'high' : 'normal', notes: `Post-checkout. Guest: ${res.guest.name}`, created_at: new Date().toISOString(),
    })
  })
  await safeRun({
    hotel, reservationId: res.id, event: 'housekeeping_created', app: 'slack', action: A.slack, needs: ['channel_id'], summary: `Cleaning alert: Room ${res.room.number}`,
    build: (c) => slackPost(c, `🧹 *Room ${res.room.number} needs cleaning*\nGuest ${res.guest.name} just checked out. ${res.is_vip ? '⭐ VIP room — *priority* clean.' : 'Normal priority.'}\nMark it done in Hotelator → Housekeeping.`),
  })
}

// ── 6. Maintenance ─────────────────────────────────────────────────────────
export async function onMaintenance(req: MaintenanceRequest, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const room = req.room_id ? db().rooms.find((r) => r.id === req.room_id) : undefined
  const emoji = { urgent: '🚨', high: '⚠️', normal: '🔧', low: '📋' }[req.priority]
  await Promise.all([
    safeRun({
      hotel, reservationId: req.reservation_id, event: 'maintenance', app: 'slack', action: A.slack, needs: ['channel_id'], summary: `Maintenance alert: ${req.issue.slice(0, 40)}`,
      build: (c) => slackPost(c, `${emoji} *Maintenance request*\n*Room:* ${room?.number ?? '—'}\n*Issue:* ${req.issue}\n*Category:* ${req.category}\n*Priority:* ${req.priority.toUpperCase()}\n*Reported by:* ${req.reported_by}\n*ID:* ${req.id.slice(-8)}`),
    }),
    fireStudioFlows(hotel, 'maintenance', studioPayload('maintenance', hotel, undefined, { maintenance: { issue: req.issue, room: room?.number, priority: req.priority, category: req.category, reported_by: req.reported_by } }), req.reservation_id),
  ])
}

// ── 7. WhatsApp inbound (called by the handler running on viaSocket) ───────
const INFO_REPLY = 'Breakfast: 7:00–10:30 at the Palm Café ☕ · Pool: 7:00–21:00 · Checkout: 11:00. Anything else?'

export async function onWhatsappInbound(hotelIn: Hotel, msg: { from: string; message: string; name?: string; simulated?: boolean }) {
  const hotel = fresh(hotelIn)
  const text = (msg.message || '').trim()
  const d = db()
  const guest = d.guests.find((g) => g.hotel_id === hotel.id && last10(g.phone) === last10(msg.from))
  const res = guest && d.reservations.find((r) => r.guest_id === guest.id && r.status === 'checked_in')
  const view = res ? joinReservation(res) : undefined

  let category: 'room_service' | 'housekeeping' | 'maintenance' | 'info' | 'other' | 'unknown_guest' = 'other'
  let reply: string
  if (!view) {
    category = 'unknown_guest'
    reply = `Hi${msg.name ? ` ${first(msg.name)}` : ''}! We couldn't find an active stay for this number. Please contact our front desk at ${hotel.phone}. 🙏`
  } else if (/towel|clean|housekeep|linen|pillow|blanket|sweep|toiletr|soap|shampoo|water bottle/i.test(text)) {
    category = 'housekeeping'
    mutate((db2) => db2.housekeeping_tasks.unshift({ id: uid('hk'), hotel_id: hotel.id, room_id: view.room_id, reservation_id: view.id, type: 'special', status: 'pending', priority: view.is_vip ? 'high' : 'normal', notes: `WhatsApp: “${text}”`, created_at: new Date().toISOString() }))
    reply = `Got it! 🧹 Housekeeping is on the way to Room ${view.room.number}.`
  } else if (/broken|not work|repair|fix|\bac\b|air ?con|wifi|wi-fi|tv|light|door|leak|hot water|shower/i.test(text)) {
    category = 'maintenance'
    const req: MaintenanceRequest = { id: uid('mnt'), hotel_id: hotel.id, room_id: view.room_id, reservation_id: view.id, reported_by: `guest (${view.guest.name})`, issue: text, category: /ac|air|cool/i.test(text) ? 'hvac' : /wifi|wi-fi|tv|light/i.test(text) ? 'electrical' : /leak|water|shower/i.test(text) ? 'plumbing' : 'other', priority: 'normal', status: 'open', created_at: new Date().toISOString() }
    mutate((db2) => db2.maintenance_requests.unshift(req))
    reply = `Sorry about that! 🔧 We've logged it and our engineer will be at Room ${view.room.number} shortly.`
    await onMaintenance(req, hotel)
  } else if (/food|eat|order|menu|room service|breakfast|dinner|lunch|coffee|tea/i.test(text)) {
    category = /breakfast/i.test(text) && /time|when/i.test(text) ? 'info' : 'room_service'
    reply = category === 'info' ? INFO_REPLY : `🍽 Room service is open 24/7 — call ext. 101, or see the menu: ${appUrl()}/#dining`
  } else if (/time|when|pool|checkout|check out|wifi password|where/i.test(text)) {
    category = 'info'
    reply = INFO_REPLY
  } else {
    reply = `Thanks, ${first(view.guest.name)}! 😊 We've noted your message and the front desk will reply shortly.`
  }

  mutate((db2) =>
    db2.guest_requests.unshift({ id: uid('greq'), hotel_id: hotel.id, reservation_id: view?.id, from: msg.from, guest_name: view?.guest.name ?? msg.name, via: 'whatsapp', message: text, category, status: 'acknowledged', response: reply, simulated: msg.simulated, created_at: new Date().toISOString() }),
  )

  await Promise.all([
    safeRun({ hotel, reservationId: view?.id, event: 'guest_message', app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Auto-reply (${category.replace('_', ' ')}) → ${view?.guest.name ?? msg.from}`, build: (c) => waText(c, msg.from, reply) }),
    view && category !== 'maintenance' && category !== 'info'
      ? safeRun({ hotel, reservationId: view.id, event: 'guest_message', app: 'slack', action: A.slack, needs: ['channel_id'], summary: `Guest request relayed to ops`, build: (c) => slackPost(c, `💬 *WhatsApp from Room ${view.room.number}* (${view.guest.name})\n> ${text}\n_Routed as ${category.replace('_', ' ')}._`) })
      : Promise.resolve(),
    fireStudioFlows(hotel, 'guest_message', studioPayload('guest_message', hotel, view, { message: { from: msg.from, text, category, reply } }), view?.id),
  ])
  return { category, reply, reservation: view?.code }
}

// ── 8. Payments ────────────────────────────────────────────────────────────
export async function onPaymentFailed(res: ReservationView, paymentRef: string, amount: number, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const payUrl = `${checkinUrl(res)}#payment`
  await Promise.all([
    safeRun({ hotel, reservationId: res.id, event: 'payment_failed', app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Payment retry link → ${res.guest.name}`, build: (c) => waText(c, res.guest.phone, `Hi ${first(res.guest.name)}, your payment of ${inr(amount)} for booking ${res.code} didn't go through. 😕\n\nYou can retry securely here:\n${payUrl}\n\nNeed help? Just reply to this message.`) }),
    safeRun({ hotel, reservationId: res.id, event: 'payment_failed', app: 'slack', action: A.slack, needs: ['channel_id'], summary: `Finance alert: payment failed (${res.code})`, build: (c) => slackPost(c, `💳 *Payment failed*\nGuest: ${res.guest.name} · ${res.code}\nAmount: ${inr(amount)} · Ref: ${paymentRef}\n_Retry link sent to guest on WhatsApp._`) }),
    fireStudioFlows(hotel, 'payment_failed', studioPayload('payment_failed', hotel, res, { payment: { amount, ref: paymentRef } }), res.id),
  ])
}

export async function onPaymentSuccess(res: ReservationView, paymentRef: string, amount: number, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  log({ hotel_id: hotel.id, reservation_id: res.id, event_type: 'payment_success', app: 'system', status: 'success', summary: `Payment ${inr(amount)} received (${paymentRef})` })
  await fireStudioFlows(hotel, 'payment_success', studioPayload('payment_success', hotel, res, { payment: { amount, ref: paymentRef } }), res.id)
}

// ── 9. VIP ─────────────────────────────────────────────────────────────────
export async function onVIPReservation(res: ReservationView, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const base = { hotel, reservationId: res.id, event: 'vip_arrival' as const }
  await Promise.all([
    safeRun({ ...base, app: 'slack', action: A.slack, needs: ['channel_id'], summary: `VIP prep alert: ${res.guest.name}`, build: (c) => slackPost(c, `⭐ *VIP GUEST ARRIVING*\n*${res.guest.name}* · ${res.code}\n📅 ${prettyDate(res.check_in)} → ${prettyDate(res.check_out)} (${res.total_nights}n)\n🛏 ${res.room.type} · Room ${res.room.number}\n\n*Preparation checklist*\n• Welcome amenities & card\n• Upgrade if available\n• Brief the duty manager\n• Fresh flowers in room`) }),
    safeRun({ ...base, app: 'gcal', action: A.cal, needs: ['calendar_id'], summary: `VIP prep reminder: ${res.guest.name}`, build: (c) => calendarEvent(c, hotel, { summary: `⭐ VIP prep – ${res.guest.name} (Room ${res.room.number})`, description: `VIP arriving ${prettyDate(res.check_in)}. Room ${res.room.number}. Amenities, upgrade check, duty manager briefing.`, date: res.check_in, time: '12:00', duration: '01:00' }) }),
  ])
}

// ── 10. Daily report ───────────────────────────────────────────────────────
export function dailyStats(hotelId: string, date = today()) {
  const d = db()
  const rooms = d.rooms.filter((r) => r.hotel_id === hotelId)
  const res = d.reservations.filter((r) => r.hotel_id === hotelId && r.status !== 'cancelled')
  const occupied = res.filter((r) => r.check_in <= date && r.check_out > date && ['checked_in', 'confirmed', 'checked_out'].includes(r.status)).length
  const checkins = res.filter((r) => r.check_in === date).length
  const checkouts = res.filter((r) => r.check_out === date).length
  const revenue = res.filter((r) => r.check_in <= date && r.check_out > date).reduce((s, r) => s + r.rate_per_night, 0)
  const total = rooms.length
  return { date, occupied, total_rooms: total, occupancy_pct: total ? Math.round((occupied / total) * 100) : 0, checkins, checkouts, revenue }
}

export async function dailyOccupancyReport(hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const s = dailyStats(hotel.id)
  const base = { hotel, event: 'daily_report' as const }
  await Promise.all([
    safeRun({ ...base, app: 'slack', action: A.slack, needs: ['channel_id'], summary: `Daily report posted (${s.occupancy_pct}% occupancy)`, build: (c) => slackPost(c, `📊 *Daily report – ${hotel.name}*\n📅 ${prettyDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })}\n\n🏠 Occupancy: *${s.occupancy_pct}%* (${s.occupied}/${s.total_rooms} rooms)\n✅ Arrivals: ${s.checkins}\n🚪 Departures: ${s.checkouts}\n💰 Room revenue: ${inr(s.revenue)}`) }),
    safeRun({ ...base, app: 'sheets', action: A.sheet, needs: SHEETS_NEEDS, summary: `Daily report row (${s.date})`, build: (c) => sheetRow(c, { event: 'daily_report', timestamp: new Date().toISOString(), check_in: s.date, nights: s.occupied, amount: s.revenue, status: `${s.occupancy_pct}% occupancy · ${s.checkins} in / ${s.checkouts} out`, room: `${s.occupied}/${s.total_rooms}` }) }),
    fireStudioFlows(hotel, 'daily_report', studioPayload('daily_report', hotel, undefined, { stats: s })),
  ])
  return s
}

// ── 11. Guest signup ───────────────────────────────────────────────────────
export async function onGuestSignup(guest: Guest, hotelIn: Hotel) {
  const hotel = fresh(hotelIn)
  const links = { account: `${appUrl()}/account`, book: `${appUrl()}/#book` }
  const base = { hotel, event: 'guest_signup' as const }
  const returning = guest.total_stays > 0
  await Promise.all([
    guest.email
      ? safeRun({ ...base, app: 'gmail', action: A.mail, summary: `Welcome email → ${guest.email}`, build: (c) => gmailSend(c, hotel, guest.email!, `Welcome to ${hotel.name} 🌴 — your member perks inside`, welcomeEmailHTML(guest, hotel, links)) })
      : Promise.resolve(),
    safeRun({
      ...base, app: 'sheets', action: A.sheet, needs: SHEETS_NEEDS, summary: `Member row for ${guest.name}`,
      build: (c) => sheetRow(c, { event: 'guest_signup', guest_name: guest.name, guest_phone: guest.phone, guest_email: guest.email ?? '', status: returning ? 'member (returning guest)' : 'member (new)', source: 'website signup', nights: guest.total_stays, amount: guest.total_spend, timestamp: new Date().toISOString() }),
    }),
    safeRun({ ...base, app: 'whatsapp', action: A.wa, needs: ['phone_id'], summary: `Welcome WhatsApp → ${guest.name}`, build: (c) => waText(c, guest.phone, `Hi ${first(guest.name)}! 💚 Welcome to *${hotel.name}* — your account is ready.\n\nBook direct for 10% off: ${links.book}\nSave this chat: during your stay, message us here for anything.`) }),
    safeRun({ ...base, app: 'slack', action: A.slack, needs: ['channel_id'], summary: `New member alert: ${guest.name}`, build: (c) => slackPost(c, `🎉 *New website member*\n*${guest.name}* · ${guest.phone}${guest.email ? ` · ${guest.email}` : ''}\n${returning ? `Returning guest — ${guest.total_stays} past stay(s), ${inr(guest.total_spend)} lifetime.` : 'First time with us.'}`) }),
    fireStudioFlows(hotel, 'guest_signup', studioPayload('guest_signup', hotel, undefined, { guest: { name: guest.name, phone: guest.phone, email: guest.email ?? '', returning, total_stays: guest.total_stays, marketing_opt_in: Boolean(guest.marketing_opt_in) } })),
  ])
}

export { isEnabled }
