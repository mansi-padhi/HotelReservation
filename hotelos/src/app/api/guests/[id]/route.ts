import { requireHotel } from '@/lib/auth'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { Guest } from '@/lib/types'

export const dynamic = 'force-dynamic'

const FIELDS = ['name', 'email', 'phone', 'nationality', 'date_of_birth', 'address', 'id_type', 'id_number', 'id_verified', 'tags', 'notes'] as const

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<Guest>>(req)
    const guest = mutate((d) => {
      const g = d.guests.find((x) => x.id === params.id && x.hotel_id === hotel.id)
      if (!g) return null
      for (const k of FIELDS) if (b[k] !== undefined) (g as any)[k] = b[k]
      return g
    })
    return guest ? json({ guest }) : json({ error: 'Guest not found' }, 404)
  })
}
