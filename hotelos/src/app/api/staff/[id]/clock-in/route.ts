import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { clockInEmployee } from '@/lib/operations'

export const dynamic = 'force-dynamic'

/** Starts the shift, then logs it to Keka (Log Employee Clock In and Out). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ shift: await clockInEmployee(hotel, params.id) })
  })
}
