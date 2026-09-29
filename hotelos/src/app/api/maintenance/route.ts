import { requireHotel } from '@/lib/auth'
import { onMaintenance } from '@/lib/automations'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { MaintenanceRequest } from '@/lib/types'
import { uid } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** Logs the request, optionally takes the room out of service, then alerts Slack. */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<MaintenanceRequest> & { block_room?: boolean }>(req)
    if (!b.issue?.trim()) return json({ error: 'Describe the issue' }, 400)
    const request: MaintenanceRequest = {
      id: uid('mnt'), hotel_id: hotel.id, room_id: b.room_id || undefined, reported_by: b.reported_by || 'staff', issue: b.issue.trim(),
      category: b.category ?? 'other', priority: b.priority ?? 'normal', status: 'open', created_at: new Date().toISOString(),
    }
    mutate((d) => {
      d.maintenance_requests.unshift(request)
      if (b.block_room && request.room_id) {
        const room = d.rooms.find((r) => r.id === request.room_id)
        if (room && room.status !== 'occupied') room.status = 'maintenance'
      }
    })
    await onMaintenance(request, hotel)
    return json({ request }, 201)
  })
}
