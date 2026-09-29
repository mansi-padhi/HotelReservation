import { Check } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

const bg = 'url(https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=70), linear-gradient(135deg,#1f2630,#157534)'

/** Light, guest-facing split layout for /signup and /account/login. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-[#f6f5f1] text-ink-900 lg:grid-cols-[1.05fr_1fr]" style={{ colorScheme: 'light' }}>
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: bg }} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/40 to-ink-950/30" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/"><Logo suffix={null} /></Link>
          <div>
            <h2 className="font-display text-5xl leading-[1.05]">Members stay<br /><em className="text-brand-300">better.</em></h2>
            <ul className="mt-8 space-y-3 text-white/85">
              {['10% off every direct booking', 'Two-minute online check-in', 'WhatsApp concierge during your stay', 'All your invoices in one place'].map((p) => (
                <li key={p} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-400/25"><Check className="h-3.5 w-3.5 text-brand-300" /></span>{p}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/50">Hotelator Grand Goa · Candolim Beach</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 block lg:hidden"><Logo light suffix={null} /></Link>
          {children}
        </div>
      </div>
    </div>
  )
}
