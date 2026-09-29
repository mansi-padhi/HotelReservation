import { requireHotel } from '@/lib/auth'
import { db, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { Room } from '@/lib/types'

export const dynamic = 'force-dynamic'

const FIELDS = ['number', 'type', 'floor', 'max_occupancy', 'rate_per_night', 'status', 'amenities', 'description'] as const

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<Room>>(req)
    const room = mutate((d) => {
      const r = d.rooms.find((x) => x.id === params.id && x.hotel_id === hotel.id)
      if (!r) return null
      for (const k of FIELDS) if (b[k] !== undefined) (r as any)[k] = ['floor', 'max_occupancy', 'rate_per_night'].includes(k) ? Number(b[k]) : b[k]
      return r
    })
    return room ? json({ room }) : json({ error: 'Room not found' }, 404)
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const { hotel, error } = requireHotel()
    if (error) return error
    if (db().reservations.some((r) => r.room_id === params.id && ['confirmed', 'checked_in'].includes(r.status)))
      return json({ error: 'Room has active reservations' }, 409)
    mutate((d) => { d.rooms = d.rooms.filter((x) => !(x.id === params.id && x.hotel_id === hotel.id)) })
    return json({ ok: true })
  })
}
