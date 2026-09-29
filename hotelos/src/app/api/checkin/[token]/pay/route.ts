import { db, findReservationByToken } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import { recordPayment } from '@/lib/operations'

export const dynamic = 'force-dynamic'

/**
 * Step 6. Demo gateway: the guest can pay or simulate a decline (which fires onPaymentFailed).
 * Swap for Razorpay create-order + signature verify in production.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  return handle(async () => {
    const res = findReservationByToken(params.token)
    if (!res || res.status === 'cancelled') return json({ error: 'Invalid check-in link' }, 404)
    const { outcome } = await body<{ outcome: 'success' | 'failed' }>(req)
    if (res.balance_due <= 0) return json({ ok: true, ref: null, balance_due: 0 })
    const hotel = db().hotels.find((h) => h.id === res.hotel_id)!
    const r = await recordPayment(hotel, res.id, res.balance_due, outcome === 'failed' ? 'failed' : 'success')
    return json({ ...r, balance_due: findReservationByToken(params.token)!.balance_due }, r.ok ? 200 : 402)
  })
}
