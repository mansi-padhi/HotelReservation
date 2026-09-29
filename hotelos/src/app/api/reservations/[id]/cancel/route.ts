import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { cancelReservation } from '@/lib/operations'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ reservation: cancelReservation(hotel, params.id) })
  })
}
