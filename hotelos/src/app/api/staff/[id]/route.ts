import { requireHotel } from '@/lib/auth'
import { body, handle, json } from '@/lib/http'
import { saveEmployee } from '@/lib/operations'
import type { Employee } from '@/lib/types'

export const dynamic = 'force-dynamic'

/** Edit an employee, or link them to a Keka employee picked from Keka's own list. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { hotel, error } = requireHotel()
    if (error) return error
    const b = await body<Partial<Employee>>(req)
    return json({ employee: saveEmployee(hotel, { ...b, id: params.id }) })
  })
}
