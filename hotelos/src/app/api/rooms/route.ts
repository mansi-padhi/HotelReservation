import { requireHotel } from '@/lib/auth'
import { db, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { Room } from '@/lib/types'
import { uid } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  return handle(() => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ rooms: db().rooms.filter((r) => r.hotel_id === hotel.id) })
  })
}

export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<Room>>(req)
    if (!b.number?.trim() || !(Number(b.rate_per_night) > 0)) return json({ error: 'Room number and rate are required' }, 400)
    if (db().rooms.some((r) => r.hotel_id === hotel.id && r.number === b.number!.trim())) return json({ error: `Room ${b.number} already exists` }, 409)
    const room: Room = {
      id: uid('room'), hotel_id: hotel.id, number: b.number.trim(), type: b.type ?? 'Standard', floor: Number(b.floor) || 1,
      max_occupancy: Number(b.max_occupancy) || 2, rate_per_night: Number(b.rate_per_night), status: 'available',
      amenities: b.amenities ?? [], description: b.description ?? '', created_at: new Date().toISOString(),
    }
    mutate((d) => d.rooms.push(room))
    return json({ room }, 201)
  })
}
