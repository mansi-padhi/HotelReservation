import { findReservationByToken, mutate } from '@/lib/db'
import { body, handle, json } from '@/lib/http'
import type { Guest } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MAX = 3_000_000 // ~2.2 MB binary as a data URL
const FIELD = { id: 'id_document_url', photo: 'photo_url', signature: 'signature_url' } as const

/** Steps 3–5: ID document, selfie, signature. Stored as data URLs in the demo store (use object storage in production). */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  return handle(async () => {
    const res = findReservationByToken(params.token)
    if (!res || res.status === 'cancelled') return json({ error: 'Invalid check-in link' }, 404)
    const b = await body<{ kind: keyof typeof FIELD; dataUrl: string; id_type?: Guest['id_type']; id_number?: string }>(req)
    if (!FIELD[b.kind]) return json({ error: 'Unknown upload' }, 400)
    if (!/^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/.test(b.dataUrl || '')) return json({ error: 'Upload a JPG, PNG, WEBP or PDF' }, 400)
    if (b.dataUrl.length > MAX) return json({ error: 'File is too large (max ~2 MB)' }, 413)
    mutate((d) => {
      const g = d.guests.find((x) => x.id === res.guest_id)!
      g[FIELD[b.kind]] = b.dataUrl
      if (b.kind === 'id') {
        if (b.id_type) g.id_type = b.id_type
        if (b.id_number) g.id_number = b.id_number
      }
    })
    return json({ ok: true })
  })
}
