import { requireHotel } from '@/lib/auth'
import { handle, json } from '@/lib/http'
import { embedToken } from '@/lib/viasocket/client'

export const dynamic = 'force-dynamic'

/** Signs the embed token for the signed-in hotel. The browser uses it only for the connect popup / prebuilt UI. */
export async function POST() {
  return handle(() => {
    const { hotel, error } = requireHotel()
    if (error) return error
    return json({ token: embedToken(hotel.id) })
  })
}
