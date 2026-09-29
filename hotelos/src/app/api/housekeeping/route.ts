import { requireHotel } from '@/lib/auth'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { HousekeepingTask } from '@/lib/types'
import { uid } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<HousekeepingTask>>(req)
    if (!b.room_id) return json({ error: 'Pick a room' }, 400)
    const task: HousekeepingTask = {
      id: uid('hk'), hotel_id: hotel.id, room_id: b.room_id, type: b.type ?? 'cleaning', status: 'pending',
      priority: b.priority ?? 'normal', notes: b.notes, assigned_to: b.assigned_to, created_at: new Date().toISOString(),
    }
    mutate((d) => d.housekeeping_tasks.unshift(task))
    return json({ task }, 201)
  })
}
