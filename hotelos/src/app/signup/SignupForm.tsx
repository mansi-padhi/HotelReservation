'use client'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/client-api'
import { cn } from '@/lib/utils'

export default function SignupForm() {
  const router = useRouter()
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', marketing_opt_in: true })
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 2) e.name = 'Enter your full name'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email'
    if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid mobile number'
    if (f.password.length < 8) e.password = 'At least 8 characters'
    setErr(e)
    return !Object.keys(e).length
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError('')
    try {
      await api('/api/account/signup', { body: f })
      router.replace('/account?welcome=1')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  const input = (k: 'name' | 'email' | 'phone', label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-500">{label}</span>
      <input className={cn('light-input', err[k] && 'border-red-400')} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
      {err[k] && <span className="mt-1 block text-xs text-red-600">{err[k]}</span>}
    </label>
  )

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="font-display text-4xl">Create your account</h1>
      <p className="mt-2 text-stone-600">Stayed with us before? Use the same phone or email and your past stays will appear.</p>
      <div className="mt-8 space-y-4">
        {input('name', 'Full name', { autoComplete: 'name', placeholder: 'Priya Sharma' })}
        {input('email', 'Email', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
        {input('phone', 'Mobile (WhatsApp)', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '+91 98xxx xxxxx' })}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500">Password</span>
          <div className="relative">
            <input type={show ? 'text' : 'password'} autoComplete="new-password" className={cn('light-input pr-11', err.password && 'border-red-400')} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="8+ characters" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-ink-900" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          {err.password && <span className="mt-1 block text-xs text-red-600">{err.password}</span>}
        </label>
        <label className="flex gap-3 text-sm text-stone-600">
          <input type="checkbox" checked={f.marketing_opt_in} onChange={(e) => setF({ ...f, marketing_opt_in: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-600" />
          Send me member offers by email and WhatsApp
        </label>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-4 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create account {!loading && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="mt-6 text-center text-sm text-stone-500">Already a member? <Link href="/account/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></p>
    </form>
  )
}
