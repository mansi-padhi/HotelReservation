'use client'
import { ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/client-api'

export default function GuestLoginForm() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/api/account/login', { body: { login, password } })
      router.replace('/account')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 className="font-display text-4xl">Welcome back</h1>
      <p className="mt-2 text-stone-600">Sign in to see your bookings, check-in links and invoices.</p>
      <div className="mt-8 space-y-4">
        <label className="block"><span className="mb-1 block text-xs font-medium text-stone-500">Email or mobile</span><input required className="light-input" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="you@example.com" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-stone-500">Password</span><input required type="password" className="light-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink-900 py-4 font-semibold text-white hover:bg-ink-800 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />}Sign in {!loading && <ArrowRight className="h-4 w-4" />}</button>
      <p className="mt-6 text-center text-sm text-stone-500">New here? <Link href="/signup" className="font-medium text-brand-700 hover:underline">Create an account</Link></p>
      <p className="mt-2 text-center text-xs text-stone-400">Hotel staff? <Link href="/login" className="hover:underline">Staff login</Link></p>
    </form>
  )
}
