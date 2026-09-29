import { redirect } from 'next/navigation'
import { currentGuest } from '@/lib/guestAuth'
import AuthShell from './AuthShell'
import SignupForm from './SignupForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Create your account' }

export default function SignupPage() {
  if (currentGuest()) redirect('/account')
  return <AuthShell><SignupForm /></AuthShell>
}
