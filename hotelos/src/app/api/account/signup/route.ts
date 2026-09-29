import { db } from '@/lib/db'
import { GUEST_COOKIE, guestCookieOptions, guestSessionValue, publicGuest } from '@/lib/guestAuth'
import { body, handle, json } from '@/lib/http'
import { signupGuest } from '@/lib/operations'
import { DEMO_HOTEL_ID } from '@/lib/seed'

export const dynamic = 'force-dynamic'

/** Creates the guest account, signs them in and fires the "Welcome new member" automation. */
export async function POST(req: Request) {
  return handle(async () => {
    const hotel = db().hotels.find((h) => h.id === DEMO_HOTEL_ID)!
    const b = await body<{ name: string; email: string; phone: string; password: string; marketing_opt_in?: boolean }>(req)
    const guest = await signupGuest(hotel, b)
    const res = json({ ok: true, guest: publicGuest(guest) }, 201)
    res.cookies.set(GUEST_COOKIE, guestSessionValue(guest.id), guestCookieOptions)
    return res
  })
}
