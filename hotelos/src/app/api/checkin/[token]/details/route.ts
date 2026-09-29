import { findReservationByToken, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Step 2 of digital check-in. The check-in token is the guest's only credential. */
export async function PATCH(req: Request, { params }: { params: { token: string } }) {
  return handle(async () => {
    const res = findReservationByToken(params.token)
    if (!res || res.status === 'cancelled') return json({ error: 'Invalid check-in link' }, 404)
    const b = await body<{ name: string; email?: string; phone: string; date_of_birth?: string; nationality?: string; address?: string }>(req)
    if (!b.name || b.name.trim().length < 2) return json({ error: 'Please enter your full name' }, 400)
    if (!b.phone || b.phone.replace(/\D/g, '').length < 10) return json({ error: 'Please enter a valid phone number' }, 400)
    if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) return json({ error: 'Please enter a valid email' }, 400)
    mutate((d) => {
      const g = d.guests.find((x) => x.id === res.guest_id)!
      Object.assign(g, { name: b.name.trim(), email: b.email?.trim() || g.email, phone: b.phone.trim(), date_of_birth: b.date_of_birth || g.date_of_birth, nationality: b.nationality || g.nationality, address: b.address || g.address })
    })
    return json({ ok: true })
  })
}
