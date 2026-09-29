import { NextResponse } from 'next/server'
import { checkCredentials, SESSION_COOKIE, sessionValue } from '@/lib/auth'
import { body } from '@/lib/http'

export async function POST(req: Request) {
  const { email, password } = await body<{ email: string; password: string }>(req)
  const hotelId = checkCredentials(email ?? '', password ?? '')
  if (!hotelId) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, sessionValue(hotelId), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 14 })
  return res
}
