import { redirect } from 'next/navigation'
import { currentHotel } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  if (currentHotel()) redirect('/dashboard')
  return <LoginForm defaultEmail={process.env.ADMIN_EMAIL || 'admin@hotelator.com'} />
}
