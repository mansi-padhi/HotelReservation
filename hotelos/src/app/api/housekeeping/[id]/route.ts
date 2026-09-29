import { requireHotel } from '@/lib/auth'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { HousekeepingTask } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Completing a cleaning task on a dirty room flips the room back to available. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<HousekeepingTask>>(req)
    const out = mutate((d) => {
      const t = d.housekeeping_tasks.find((x) => x.id === params.id && x.hotel_id === hotel.id)
      if (!t) return null
      if (b.status) t.status = b.status
      if (b.assigned_to !== undefined) t.assigned_to = b.assigned_to
      if (b.priority) t.priority = b.priority
      if (b.notes !== undefined) t.notes = b.notes
      let roomFreed = false
      if (b.status === 'completed') {
        t.completed_at = new Date().toISOString()
        const room = d.rooms.find((r) => r.id === t.room_id)
        if (room && room.status === 'dirty') {
          room.status = 'available'
          roomFreed = true
        }
      }
      return { task: t, roomFreed }
    })
    return out ? json(out) : json({ error: 'Task not found' }, 404)
  })
}
