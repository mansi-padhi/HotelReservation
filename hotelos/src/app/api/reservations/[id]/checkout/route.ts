import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { checkOutReservation } from '@/lib/operations'

export const dynamic = 'force-dynamic'

/** Settles the folio, then onCheckout (invoice + review + Sheets) and onCheckoutCreateHousekeeping. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json(await checkOutReservation(hotel, params.id))
  })
}
