import { requireHotel } from '@/lib/auth'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { MaintenanceRequest } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<MaintenanceRequest>>(req)
    const request = mutate((d) => {
      const m = d.maintenance_requests.find((x) => x.id === params.id && x.hotel_id === hotel.id)
      if (!m) return null
      if (b.status) m.status = b.status
      if (b.priority) m.priority = b.priority
      if (b.resolution_notes !== undefined) m.resolution_notes = b.resolution_notes
      if (b.status === 'resolved' || b.status === 'closed') {
        m.resolved_at = new Date().toISOString()
        const room = d.rooms.find((r) => r.id === m.room_id)
        const stillOpen = d.maintenance_requests.some((x) => x.id !== m.id && x.room_id === m.room_id && ['open', 'in_progress'].includes(x.status))
        if (room?.status === 'maintenance' && !stillOpen) room.status = 'available'
      }
      return m
    })
    return request ? json({ request }) : json({ error: 'Not found' }, 404)
  })
}
