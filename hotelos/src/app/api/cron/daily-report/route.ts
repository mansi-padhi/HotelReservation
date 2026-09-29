import { dailyOccupancyReport } from '@/lib/automations'
import { cronHotels } from '@/lib/cron'
import { handle, json } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Midnight — occupancy summary to Slack and a row in Sheets. */
async function run(req: Request) {
  return handle(async () => {
    const hotels = cronHotels(req)
    if (!hotels) return json({ error: 'Forbidden' }, 403)
    const stats = []
    for (const h of hotels) stats.push(await dailyOccupancyReport(h))
    return json({ ok: true, stats })
  })
}

export const GET = run
export const POST = run
