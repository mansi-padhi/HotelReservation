import { NextResponse } from 'next/server'
import { GUEST_COOKIE } from '@/lib/guestAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(GUEST_COOKIE)
  return res
}
