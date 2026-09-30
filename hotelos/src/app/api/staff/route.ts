import { requireHotel } from '@/lib/auth'
import { body, handle, json } from '@/lib/http'
import { saveEmployee } from '@/lib/operations'
import type { Employee } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<Employee>>(req)
    return json({ employee: saveEmployee(hotel, { name: b.name, email: b.email, role: b.role }) }, 201)
  })
}
