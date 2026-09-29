import { NextResponse } from 'next/server'
import { OpError } from './operations'
import { ViasocketError } from './viasocket/client'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })

/** Wraps a route body: known errors become JSON with their status, anything else a 500. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn()
  } catch (e: any) {
    if (e instanceof OpError) return json({ error: e.message }, e.status)
    if (e instanceof ViasocketError) return json({ error: e.message, details: e.body }, e.status >= 400 ? e.status : 502)
    console.error('[api]', e)
    return json({ error: e?.message || 'Server error' }, 500)
  }
}

export async function body<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return {} as T
  }
}
