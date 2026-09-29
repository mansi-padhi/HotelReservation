import { redirect } from 'next/navigation'
import { currentGuest } from '@/lib/guestAuth'
import AuthShell from '../../signup/AuthShell'
import GuestLoginForm from './GuestLoginForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign in' }

export default function GuestLoginPage() {
  if (currentGuest()) redirect('/account')
  return <AuthShell><GuestLoginForm /></AuthShell>
}
