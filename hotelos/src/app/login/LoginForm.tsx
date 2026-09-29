'use client'
import { ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { Button, Field, Input } from '@/components/ui'
import { api } from '@/lib/client-api'
import { APP_LIST } from '@/lib/viasocket/apps'

export default function LoginForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter()
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/api/auth/login', { body: { email, password } })
      router.replace('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <img src="/brand/hero-city.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-950/80 to-brand-900/40" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <h2 className="font-display text-5xl leading-[1.05] text-white">Your front desk,<br />on autopilot.</h2>
            <p className="mt-5 max-w-md text-slate-300">Bookings, digital check-in, housekeeping and guest messaging — with WhatsApp, Gmail, Slack, Sheets and Calendar wired in through viaSocket.</p>
            <div className="mt-8 flex gap-2">
              {APP_LIST.map((a) => (
                <span key={a.key} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-2 shadow-lg"><img src={a.icon} alt={a.name} className="h-full w-full object-contain" /></span>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">Integrations powered by viaSocket Embed</p>
        </div>
      </div>
      <div className="grid-glow flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-400">Sign in to Hotelator Grand Goa.</p>
          <div className="mt-8 space-y-4">
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></Field>
            <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required autoFocus /></Field>
          </div>
          {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          <Button type="submit" size="lg" className="mt-6 w-full" loading={loading}>Sign in <ArrowRight className="h-4 w-4" /></Button>
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5 text-brand-400" /> Demo login: <code className="text-slate-200">{defaultEmail}</code> / <code className="text-slate-200">hotelator</code>
          </div>
          <Link href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-300">← Back to the hotel website</Link>
        </form>
      </div>
    </div>
  )
}
