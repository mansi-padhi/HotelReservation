import { requireHotel } from '@/lib/auth'
import { body, handle, json } from '@/lib/http'
import type { AppKey } from '@/lib/types'
import { isAllowedPicker } from '@/lib/viasocket/apps'
import { listOptions } from '@/lib/viasocket/client'

export const dynamic = 'force-dynamic'

/** Fills a picker with the hotel's real data from the connected app (list-options). */
export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<{ app: AppKey; versionId: string; fieldKey: string; existingFields?: Record<string, unknown>; searchText?: string }>(req)
    if (!isAllowedPicker(b.app, b.versionId, b.fieldKey)) return json({ error: 'Unknown picker' }, 400)
    const conn = hotel.integrations[b.app]
    if (!conn) return json({ error: 'Connect the app first' }, 400)
    let options = await listOptions(hotel.id, b.versionId, b.fieldKey, b.existingFields ?? {}, conn.auth_id, b.searchText || undefined)
    // Subscribed public calendars (holidays, sports…) are read-only: creating an event there 404s.
    if (b.app === 'gcal' && b.fieldKey === 'calendar_id') options = options.filter((o) => !/group\.v\.calendar\.google\.com$/.test(String(o.value)))
    return json({ options })
  })
}
