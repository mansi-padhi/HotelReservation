import { currentHotel } from './auth'
import { db } from './db'
import type { Hotel } from './types'

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; a signed-in admin can also "Run now". */
export function cronHotels(req: Request): Hotel[] | null {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return db().hotels
  const hotel = currentHotel()
  return hotel ? [hotel] : null
}
