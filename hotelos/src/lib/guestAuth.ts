import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from './db'
import type { Guest } from './types'

export const GUEST_COOKIE = 'hos_guest'
const secret = () => `${process.env.SESSION_SECRET || 'dev-session-secret'}:guest`
const sign = (v: string) => crypto.createHmac('sha256', secret()).update(v).digest('hex').slice(0, 32)

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64)
  const known = Buffer.from(hash, 'hex')
  return known.length === test.length && crypto.timingSafeEqual(known, test)
}

export const guestSessionValue = (guestId: string) => `${guestId}.${sign(guestId)}`

export const guestCookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 }

/** The signed-in website guest, or null. */
export function currentGuest(): Guest | null {
  const raw = cookies().get(GUEST_COOKIE)?.value
  if (!raw) return null
  const [id, mac] = raw.split('.')
  if (!id || !mac || sign(id) !== mac) return null
  const g = db().guests.find((x) => x.id === id && x.password_hash)
  return g ?? null
}

/** Strip what the browser must never see. */
export function publicGuest(g: Guest) {
  return { id: g.id, name: g.name, email: g.email ?? '', phone: g.phone, tags: g.tags, signed_up_at: g.signed_up_at }
}
