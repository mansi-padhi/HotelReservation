import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { checkInReservation } from '@/lib/operations'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ reservation: await checkInReservation(hotel, params.id, 'desk') })
  })
}
