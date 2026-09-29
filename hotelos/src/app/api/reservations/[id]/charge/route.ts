import { requireHotel } from '@/lib/auth'
import { body, handle, json } from '@/lib/http'
import { addCharge } from '@/lib/operations'
import type { FolioItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Adds a folio charge (restaurant, minibar, spa …) to an in-house reservation. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const item = await body<{ description: string; category: FolioItem['category']; quantity: number; unit_price: number }>(req)
    return json({ folio: addCharge(hotel, params.id, { ...item, unit_price: Number(item.unit_price), quantity: Number(item.quantity) }) })
  })
}
