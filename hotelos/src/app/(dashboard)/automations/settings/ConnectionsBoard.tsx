'use client'
import { AlertTriangle, ArrowRight, KeyRound, Lock, ShieldCheck, Workflow } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogoMark } from '@/components/Logo'
import { Card, PageHeader } from '@/components/ui'
import { AppCard } from '@/components/viasocket/AppCard'
import { APP_LIST } from '@/lib/viasocket/apps'
import type { PublicIntegrations } from '@/lib/viasocket/view'

export default function ConnectionsBoard({ initial }: { initial: PublicIntegrations }) {
  const router = useRouter()
  const [integrations, setIntegrations] = useState(initial)
  const update = (i: PublicIntegrations) => {
    setIntegrations(i)
    router.refresh()
  }
  const ready = APP_LIST.filter((a) => integrations.apps[a.key].ready).length

  return (
    <div>
      <PageHeader eyebrow="viaSocket Embed" title="App connections" subtitle="Connect the hotel’s own WhatsApp, Gmail, Slack, Google Sheets and Calendar. viaSocket holds every OAuth token and runs the actions — Hotelator never stores a third-party credential." />

      {!integrations.configured && (
        <Card className="mb-6 border-amber-400/25 bg-amber-400/[0.06] p-5">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div className="text-sm">
              <div className="font-medium text-amber-100">One step before connecting: add your viaSocket embed secret</div>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-amber-100/70">
                <li>viaSocket dashboard → <b>Integrations</b> → your embed → <b>Install Code</b> (no embed yet? click <b>Create embed</b>).</li>
                <li>Put it in <code className="rounded bg-black/30 px-1">hotelos/.env.local</code> as <code className="rounded bg-black/30 px-1">VIASOCKET_EMBED_SECRET=…</code> and restart <code className="rounded bg-black/30 px-1">npm run dev</code>.</li>
              </ol>
              <p className="mt-2 text-amber-100/60">Until then every automation still runs and is logged as <i>skipped</i> with the exact payload it would send.</p>
            </div>
          </div>
        </Card>
      )}

      {/* How it works */}
      <Card className="mb-8 overflow-hidden p-0">
        <div className="grid items-stretch md:grid-cols-[1fr_auto_1.2fr_auto_1fr]">
          <div className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><LogoMark className="h-5" /> Hotelator OS</div>
            <p className="mt-1.5 text-xs text-slate-400">Bookings, check-ins, checkouts, housekeeping. Decides <i>what</i> should happen.</p>
          </div>
          <div className="hidden items-center text-slate-600 md:flex"><ArrowRight className="h-5 w-5" /></div>
          <div className="border-y border-white/[0.06] bg-brand-400/[0.04] p-5 md:border-x md:border-y-0">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Workflow className="h-4 w-4 text-brand-400" /> viaSocket Embed</div>
            <p className="mt-1.5 text-xs text-slate-400">Connect popup → <code>auth_id</code> · enable → <code>script_id</code> · <code>list-options</code> pickers · run actions · trigger handlers.</p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-400" /> OAuth + refresh held by viaSocket</span>
              <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-brand-400" /> script_ids stay server-side</span>
              <span className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5 text-brand-400" /> org {integrations.orgId} · {integrations.projectId}</span>
            </div>
          </div>
          <div className="hidden items-center text-slate-600 md:flex"><ArrowRight className="h-5 w-5" /></div>
          <div className="flex items-center gap-2 p-5">
            {APP_LIST.map((a) => (
              <span key={a.key} title={a.name} className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white p-1.5 ${integrations.apps[a.key].connected ? '' : 'opacity-40 grayscale'}`}><img src={a.icon} alt={a.name} className="h-full w-full object-contain" /></span>
            ))}
          </div>
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">{ready} of {APP_LIST.length} apps ready</h2>
        <Link href="/automations/studio" className="text-sm text-brand-400 hover:text-brand-300">Need another app? Build it in Automation Studio →</Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {APP_LIST.map((a) => <AppCard key={a.key} app={a.key} integrations={integrations} onChange={update} />)}
      </div>
    </div>
  )
}
