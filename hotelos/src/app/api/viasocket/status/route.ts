import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { listConnections, viasocketConfigured } from '@/lib/viasocket/client'
import { publicIntegrations } from '@/lib/viasocket/view'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const view = publicIntegrations(hotel)
    // ?live=1 also asks viaSocket which connections it holds for this hotel (no ids returned).
    if (new URL(req.url).searchParams.get('live') && viasocketConfigured()) {
      try {
        const live = await listConnections(hotel.id)
        return json({ ...view, live: { ok: true, count: Array.isArray(live) ? live.length : undefined } })
      } catch (e: any) {
        return json({ ...view, live: { ok: false, error: e.message } })
      }
    }
    return json(view)
  })
}
