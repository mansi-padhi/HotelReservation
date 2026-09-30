import { db, joinReservation, mutate, roomIsFree } from './db'
import type { AttendanceShift, Employee, Folio, FolioItem, Guest, Hotel, Reservation } from './types'
import { last10, nightsBetween, today, uid } from './utils'
import { onCheckin, onCheckout, onCheckoutCreateHousekeeping, onEmployeeCheckin, onEmployeeCheckout, onGuestSignup, onNewBooking, onPaymentFailed, onPaymentSuccess } from './automations'
import { hashPassword } from './guestAuth'

/**
 * Website signup. Claims an existing guest profile (same phone or email, no account yet) so past
 * stays show up in the account; otherwise creates one. Then fires onGuestSignup.
 */
export async function signupGuest(hotel: Hotel, input: { name: string; email: string; phone: string; password: string; marketing_opt_in?: boolean }) {
  const name = input.name?.trim() ?? ''
  const email = input.email?.trim().toLowerCase() ?? ''
  const phone = input.phone?.trim() ?? ''
  if (name.length < 2) throw new OpError('Please enter your full name')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new OpError('Please enter a valid email')
  if (phone.replace(/\D/g, '').length < 10) throw new OpError('Please enter a valid mobile number')
  if ((input.password ?? '').length < 8) throw new OpError('Password must be at least 8 characters')

  const guests = db().guests.filter((g) => g.hotel_id === hotel.id)
  if (guests.some((g) => g.password_hash && (g.email?.toLowerCase() === email || last10(g.phone) === last10(phone))))
    throw new OpError('An account with this email or phone already exists — sign in instead', 409)

  const password_hash = hashPassword(input.password)
  const guest = mutate((d) => {
    let g = d.guests.find((x) => x.hotel_id === hotel.id && !x.password_hash && (x.email?.toLowerCase() === email || last10(x.phone) === last10(phone)))
    if (!g) {
      g = { id: uid('gst'), hotel_id: hotel.id, name, phone, email, tags: [], id_verified: false, total_stays: 0, total_spend: 0, created_at: new Date().toISOString() }
      d.guests.unshift(g)
    }
    Object.assign(g, { name, email, phone: g.phone || phone, password_hash, signed_up_at: new Date().toISOString(), marketing_opt_in: Boolean(input.marketing_opt_in) })
    if (!g.tags.includes('member')) g.tags.push('member')
    return g
  })
  await onGuestSignup(guest, hotel)
  return guest
}

export class OpError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export interface NewReservationInput {
  guest_name: string
  guest_phone: string
  guest_email?: string
  room_id?: string
  room_type?: string
  check_in: string
  check_out: string
  adults?: number
  children?: number
  booking_source?: Reservation['booking_source']
  special_requests?: string
  is_vip?: boolean
  deposit_paid?: number
}

export async function createReservation(hotel: Hotel, input: NewReservationInput) {
  const name = input.guest_name?.trim()
  const phone = input.guest_phone?.trim()
  if (!name || name.length < 2) throw new OpError('Guest name is required')
  if (!phone || phone.replace(/\D/g, '').length < 10) throw new OpError('A valid phone number is required (used for WhatsApp)')
  if (!input.check_in || !input.check_out || input.check_out <= input.check_in) throw new OpError('Check-out must be after check-in')
  if (input.check_in < today()) throw new OpError('Check-in cannot be in the past')

  const d = db()
  const rooms = d.rooms.filter((r) => r.hotel_id === hotel.id && r.status !== 'maintenance')
  const room = input.room_id
    ? rooms.find((r) => r.id === input.room_id)
    : rooms.filter((r) => !input.room_type || r.type === input.room_type).find((r) => roomIsFree(r.id, input.check_in, input.check_out))
  if (!room) throw new OpError(input.room_type ? `No ${input.room_type} room is free for those dates` : 'Room not found', 409)
  if (!roomIsFree(room.id, input.check_in, input.check_out)) throw new OpError(`Room ${room.number} is already booked for those dates`, 409)

  const nights = nightsBetween(input.check_in, input.check_out)
  const roomTotal = nights * room.rate_per_night
  const tax = Math.round(roomTotal * hotel.tax_rate)
  const grand = roomTotal + tax
  const deposit = Math.min(grand, Math.max(0, Number(input.deposit_paid) || 0))

  const reservation = mutate((db2) => {
    let guest = db2.guests.find((g) => g.hotel_id === hotel.id && last10(g.phone) === last10(phone))
    if (!guest) {
      guest = { id: uid('gst'), hotel_id: hotel.id, name, phone, email: input.guest_email?.trim() || undefined, tags: [], id_verified: false, total_stays: 0, total_spend: 0, created_at: new Date().toISOString() } satisfies Guest
      db2.guests.unshift(guest)
    } else if (input.guest_email && !guest.email) guest.email = input.guest_email.trim()
    if (input.is_vip && !guest.tags.includes('vip')) guest.tags.push('vip')

    const res: Reservation = {
      id: uid('res'),
      code: `HT${1040 + db2.reservations.length}`,
      hotel_id: hotel.id,
      guest_id: guest.id,
      room_id: room.id,
      check_in: input.check_in,
      check_out: input.check_out,
      adults: Math.max(1, Number(input.adults) || 1),
      children: Math.max(0, Number(input.children) || 0),
      status: 'confirmed',
      is_vip: Boolean(input.is_vip || guest.tags.includes('vip')),
      booking_source: input.booking_source || 'direct',
      special_requests: input.special_requests?.trim() || undefined,
      rate_per_night: room.rate_per_night,
      total_nights: nights,
      room_total: roomTotal,
      extras_total: 0,
      tax_amount: tax,
      grand_total: grand,
      deposit_paid: deposit,
      balance_due: grand - deposit,
      checkin_link_token: uid().replace(/-/g, ''),
      digital_checkin_completed: false,
      created_at: new Date().toISOString(),
    }
    db2.reservations.unshift(res)
    return res
  })

  const view = joinReservation(reservation)
  await onNewBooking(view, hotel)
  return view
}

function ensureFolio(resId: string): Folio {
  return mutate((d) => {
    const res = d.reservations.find((r) => r.id === resId)!
    let folio = d.folios.find((f) => f.reservation_id === resId)
    if (!folio) {
      folio = { id: uid('fol'), reservation_id: res.id, guest_id: res.guest_id, hotel_id: res.hotel_id, status: 'open', subtotal: 0, tax_total: 0, grand_total: 0, paid_amount: res.deposit_paid, balance: 0, created_at: new Date().toISOString() }
      d.folios.push(folio)
      const room = d.rooms.find((r) => r.id === res.room_id)!
      d.folio_items.push({ id: uid('fit'), folio_id: folio.id, description: `Room ${room.number} × ${res.total_nights} night${res.total_nights > 1 ? 's' : ''}`, category: 'room', quantity: res.total_nights, unit_price: res.rate_per_night, total_price: res.room_total, date: res.check_in, created_by: 'system', created_at: new Date().toISOString() })
    }
    recalc(d, folio.id)
    return folio
  })
}

function recalc(d: ReturnType<typeof db>, folioId: string) {
  const folio = d.folios.find((f) => f.id === folioId)!
  const res = d.reservations.find((r) => r.id === folio.reservation_id)!
  const hotel = d.hotels.find((h) => h.id === folio.hotel_id)!
  const items = d.folio_items.filter((i) => i.folio_id === folioId)
  folio.subtotal = items.reduce((s, i) => s + i.total_price, 0)
  folio.tax_total = Math.round(folio.subtotal * hotel.tax_rate)
  folio.grand_total = folio.subtotal + folio.tax_total
  folio.paid_amount = res.deposit_paid
  folio.balance = Math.max(0, folio.grand_total - folio.paid_amount)
  res.extras_total = folio.subtotal - res.room_total
  res.tax_amount = folio.tax_total
  res.grand_total = folio.grand_total
  res.balance_due = folio.balance
}

export async function checkInReservation(hotel: Hotel, id: string, via: 'desk' | 'digital' = 'desk') {
  const res = db().reservations.find((r) => r.id === id && r.hotel_id === hotel.id)
  if (!res) throw new OpError('Reservation not found', 404)
  if (res.status === 'checked_in') throw new OpError('Already checked in')
  if (res.status !== 'confirmed') throw new OpError(`Cannot check in a ${res.status.replace('_', ' ')} reservation`)
  mutate((d) => {
    const r = d.reservations.find((x) => x.id === id)!
    r.status = 'checked_in'
    r.checked_in_at = new Date().toISOString()
    if (via === 'digital') {
      r.digital_checkin_completed = true
      r.digital_checkin_at = r.checked_in_at
    }
    const room = d.rooms.find((x) => x.id === r.room_id)
    if (room) room.status = 'occupied'
  })
  ensureFolio(id)
  const view = joinReservation(db().reservations.find((r) => r.id === id)!)
  await onCheckin(view, hotel)
  return view
}

export async function checkOutReservation(hotel: Hotel, id: string, settle = true) {
  const res = db().reservations.find((r) => r.id === id && r.hotel_id === hotel.id)
  if (!res) throw new OpError('Reservation not found', 404)
  if (res.status !== 'checked_in') throw new OpError('Only in-house guests can be checked out')
  const folio = ensureFolio(id)
  mutate((d) => {
    const r = d.reservations.find((x) => x.id === id)!
    const f = d.folios.find((x) => x.id === folio.id)!
    if (settle) r.deposit_paid = r.grand_total
    recalc(d, f.id)
    f.status = f.balance === 0 ? 'paid' : 'closed'
    r.status = 'checked_out'
    r.checked_out_at = new Date().toISOString()
    const g = d.guests.find((x) => x.id === r.guest_id)
    if (g) {
      g.total_stays += 1
      g.total_spend += r.grand_total
    }
  })
  const view = joinReservation(db().reservations.find((r) => r.id === id)!)
  const f = db().folios.find((x) => x.id === folio.id)!
  await Promise.all([onCheckout(view, f, hotel), onCheckoutCreateHousekeeping(view, hotel)])
  return { reservation: view, folio: f }
}

export function cancelReservation(hotel: Hotel, id: string) {
  return mutate((d) => {
    const r = d.reservations.find((x) => x.id === id && x.hotel_id === hotel.id)
    if (!r) throw new OpError('Reservation not found', 404)
    if (r.status !== 'confirmed') throw new OpError('Only upcoming reservations can be cancelled')
    r.status = 'cancelled'
    return r
  })
}

export function addCharge(hotel: Hotel, reservationId: string, item: { description: string; category: FolioItem['category']; quantity: number; unit_price: number }) {
  const res = db().reservations.find((r) => r.id === reservationId && r.hotel_id === hotel.id)
  if (!res) throw new OpError('Reservation not found', 404)
  if (!item.description?.trim() || !(item.unit_price > 0)) throw new OpError('Description and a positive price are required')
  const folio = ensureFolio(reservationId)
  return mutate((d) => {
    const qty = Math.max(1, Number(item.quantity) || 1)
    d.folio_items.push({ id: uid('fit'), folio_id: folio.id, description: item.description.trim(), category: item.category || 'service', quantity: qty, unit_price: Number(item.unit_price), total_price: qty * Number(item.unit_price), date: today(), created_by: 'staff', created_at: new Date().toISOString() })
    recalc(d, folio.id)
    return d.folios.find((f) => f.id === folio.id)!
  })
}

/** Mock payment gateway (swap for Razorpay create-order/verify in production). */
export async function recordPayment(hotel: Hotel, reservationId: string, amount: number, outcome: 'success' | 'failed') {
  const ref = `pay_${uid().slice(0, 10)}`
  const res = db().reservations.find((r) => r.id === reservationId)
  if (!res) throw new OpError('Reservation not found', 404)
  if (outcome === 'failed') {
    await onPaymentFailed(joinReservation(res), ref, amount, hotel)
    return { ok: false, ref }
  }
  mutate((d) => {
    const r = d.reservations.find((x) => x.id === reservationId)!
    r.deposit_paid = Math.min(r.grand_total, r.deposit_paid + amount)
    r.balance_due = r.grand_total - r.deposit_paid
    const f = d.folios.find((x) => x.reservation_id === reservationId)
    if (f) recalc(d, f.id)
  })
  await onPaymentSuccess(joinReservation(db().reservations.find((r) => r.id === reservationId)!), ref, amount, hotel)
  return { ok: true, ref }
}

// ── Staff attendance ────────────────────────────────────────────────────────
export const openShift = (employeeId: string) => db().attendance.find((s) => s.employee_id === employeeId && !s.clock_out)

/** Starts a shift and logs the clock-in to Keka (with the planned shift end as its clock-out). */
export async function clockInEmployee(hotel: Hotel, employeeId: string) {
  const emp = db().employees.find((e) => e.id === employeeId && e.hotel_id === hotel.id)
  if (!emp) throw new OpError('Employee not found', 404)
  if (!emp.active) throw new OpError(`${emp.name} is marked inactive`)
  if (openShift(emp.id)) throw new OpError(`${emp.name} is already clocked in`)
  const hours = Math.min(24, Math.max(1, Number(hotel.integrations.keka?.config.shiftHours) || 9))
  const now = new Date()
  const shift: AttendanceShift = {
    id: uid('shf'), hotel_id: hotel.id, employee_id: emp.id,
    clock_in: now.toISOString(), planned_clock_out: new Date(now.getTime() + hours * 3_600_000).toISOString(),
  }
  mutate((d) => d.attendance.unshift(shift))
  const status = await onEmployeeCheckin(emp, shift, hotel)
  return mutate((d) => {
    const s = d.attendance.find((x) => x.id === shift.id)!
    s.keka_checkin = status
    return s
  })
}

/** Closes the shift and re-sends the day's entry to Keka with the real clock-out. */
export async function clockOutEmployee(hotel: Hotel, employeeId: string) {
  const emp = db().employees.find((e) => e.id === employeeId && e.hotel_id === hotel.id)
  if (!emp) throw new OpError('Employee not found', 404)
  const open = openShift(emp.id)
  if (!open) throw new OpError(`${emp.name} isn’t clocked in`)
  const shift = mutate((d) => {
    const s = d.attendance.find((x) => x.id === open.id)!
    s.clock_out = new Date().toISOString()
    return { ...s }
  })
  const status = await onEmployeeCheckout(emp, shift, hotel)
  return mutate((d) => {
    const s = d.attendance.find((x) => x.id === shift.id)!
    s.keka_checkout = status
    return s
  })
}

export function saveEmployee(hotel: Hotel, input: Partial<Employee> & { id?: string }) {
  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  if (input.id === undefined || name !== undefined) if (!name || name.length < 2) throw new OpError('Enter the employee’s name')
  if (input.id === undefined || email !== undefined) if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new OpError('Enter a valid work email — it’s how Keka finds them')
  return mutate((d) => {
    if (email && d.employees.some((e) => e.hotel_id === hotel.id && e.email === email && e.id !== input.id)) throw new OpError('Another employee already uses that email', 409)
    if (input.id) {
      const e = d.employees.find((x) => x.id === input.id && x.hotel_id === hotel.id)
      if (!e) throw new OpError('Employee not found', 404)
      if (name) e.name = name
      if (email) e.email = email
      if (input.role !== undefined) e.role = input.role.trim() || e.role
      if (input.active !== undefined) e.active = Boolean(input.active)
      if (input.keka_employee_id !== undefined) {
        e.keka_employee_id = input.keka_employee_id || undefined
        e.keka_employee_label = input.keka_employee_id ? input.keka_employee_label : undefined
      }
      return e
    }
    const e: Employee = { id: uid('emp'), hotel_id: hotel.id, name: name!, email: email!, role: input.role?.trim() || 'Staff', active: true, created_at: new Date().toISOString() }
    d.employees.push(e)
    return e
  })
}
