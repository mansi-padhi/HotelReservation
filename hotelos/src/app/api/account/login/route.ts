import { db } from '@/lib/db'
import { GUEST_COOKIE, guestCookieOptions, guestSessionValue, publicGuest, verifyPassword } from '@/lib/guestAuth'
import { body, handle, json } from '@/lib/http'
import { last10 } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Sign in with email or mobile number + password. */
export async function POST(req: Request) {
  return handle(async () => {
    const { login, password } = await body<{ login: string; password: string }>(req)
    const id = (login ?? '').trim().toLowerCase()
    const guest = db().guests.find((g) => g.password_hash && (g.email?.toLowerCase() === id || (id.replace(/\D/g, '').length >= 10 && last10(g.phone) === last10(id))))
    if (!guest || !verifyPassword(password ?? '', guest.password_hash)) return json({ error: 'Wrong email/phone or password' }, 401)
    const res = json({ ok: true, guest: publicGuest(guest) })
    res.cookies.set(GUEST_COOKIE, guestSessionValue(guest.id), guestCookieOptions)
    return res
  })
}
