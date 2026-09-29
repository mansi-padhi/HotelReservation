import { requireHotel } from '@/lib/auth'
import { TEMPLATES } from '@/lib/automations/catalog'
import { mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Pause / resume one of the 10 built-in automations. */
export async function PATCH(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const { key, enabled } = await body<{ key: string; enabled: boolean }>(req)
    if (!TEMPLATES.some((t) => t.key === key)) return json({ error: 'Unknown automation' }, 400)
    mutate((d) => { d.hotels.find((h) => h.id === hotel.id)!.automation_toggles[key] = Boolean(enabled) })
    return json({ ok: true })
  })
}
