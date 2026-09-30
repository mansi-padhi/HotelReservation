import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { clockOutEmployee } from '@/lib/operations'

export const dynamic = 'force-dynamic'

/** Closes the shift, then updates the day's Keka entry with the real clock-out. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ shift: await clockOutEmployee(hotel, params.id) })
  })
}
