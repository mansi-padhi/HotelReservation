/**
 * Minimal backend: one JSON document on disk, seeded with demo data on first run.
 * Swap for Supabase/Postgres later — every read/write goes through db() and mutate().
 */
import fs from 'node:fs'
import path from 'node:path'
import type { DB, Guest, Hotel, Reservation, ReservationView, Room } from './types'
import { seed } from './seed'

const DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/hotelos' : path.join(process.cwd(), '.data'))
const FILE = path.join(DIR, 'db.json')

const g = globalThis as unknown as { __hotelosDB?: DB }

export function db(): DB {
  if (!g.__hotelosDB) {
    try {
      g.__hotelosDB = JSON.parse(fs.readFileSync(FILE, 'utf8')) as DB
    } catch {
      g.__hotelosDB = seed()
      persist()
    }
  }
  return g.__hotelosDB
}

function persist() {
  try {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(g.__hotelosDB, null, 1))
  } catch (e) {
    console.error('[db] could not persist', e)
  }
}

export function mutate<T>(fn: (d: DB) => T): T {
  const result = fn(db())
  persist()
  return result
}

export function resetDB() {
  g.__hotelosDB = seed()
  persist()
}

// ── Queries ────────────────────────────────────────────────────────────────
export const getHotel = (id: string): Hotel | undefined => db().hotels.find((h) => h.id === id)

export function joinReservation(res: Reservation): ReservationView {
  const d = db()
  // Views are passed to client components; the password hash never goes with them.
  const { password_hash: _secret, ...guest } = d.guests.find((x) => x.id === res.guest_id) as Guest
  return {
    ...res,
    guest: guest as Guest,
    room: d.rooms.find((x) => x.id === res.room_id) as Room,
  }
}

export function reservationViews(hotelId: string): ReservationView[] {
  return db()
    .reservations.filter((r) => r.hotel_id === hotelId)
    .map(joinReservation)
    .sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
}

export function findReservationByToken(token: string): ReservationView | undefined {
  const res = db().reservations.find((r) => r.checkin_link_token === token)
  return res ? joinReservation(res) : undefined
}

export function roomIsFree(roomId: string, checkIn: string, checkOut: string, ignoreId?: string): boolean {
  return !db().reservations.some(
    (r) =>
      r.room_id === roomId &&
      r.id !== ignoreId &&
      !['cancelled', 'checked_out', 'no_show'].includes(r.status) &&
      checkIn < r.check_out &&
      r.check_in < checkOut,
  )
}
