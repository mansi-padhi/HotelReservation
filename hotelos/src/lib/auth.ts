import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getHotel } from './db'
import { DEMO_HOTEL_ID } from './seed'
import type { Hotel } from './types'

export const SESSION_COOKIE = 'hos_session'
const secret = () => process.env.SESSION_SECRET || 'dev-session-secret'

const sign = (value: string) => crypto.createHmac('sha256', secret()).update(value).digest('hex').slice(0, 32)

export function sessionValue(hotelId: string) {
  return `${hotelId}.${sign(hotelId)}`
}

export function checkCredentials(email: string, password: string): string | null {
  const okEmail = (process.env.ADMIN_EMAIL || 'admin@hotelator.com').toLowerCase()
  const okPass = process.env.ADMIN_PASSWORD || 'hotelator'
  return email.trim().toLowerCase() === okEmail && password === okPass ? DEMO_HOTEL_ID : null
}

/** The signed-in hotel, or null. Its id is the viaSocket unique_identifier. */
export function currentHotel(): Hotel | null {
  const raw = cookies().get(SESSION_COOKIE)?.value
  if (!raw) return null
  const [hotelId, mac] = raw.split('.')
  if (!hotelId || !mac || sign(hotelId) !== mac) return null
  return getHotel(hotelId) ?? null
}

type Guarded = { hotel: Hotel; error?: undefined } | { hotel?: undefined; error: NextResponse }

export function requireHotel(): Guarded {
  const hotel = currentHotel()
  if (!hotel) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { hotel }
}

/** Per-hotel shared secret baked into the WhatsApp handler that runs on viaSocket. */
export function webhookSecretFor(hotelId: string) {
  const base = process.env.INTERNAL_WEBHOOK_SECRET || 'dev-webhook-secret'
  return crypto.createHmac('sha256', base).update(`wa:${hotelId}`).digest('hex')
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
