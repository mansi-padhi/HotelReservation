'use client'
import { Code2, Pause, Play, Radio, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { Badge, Button } from '@/components/ui'
import { api } from '@/lib/client-api'
import { timeAgo } from '@/lib/utils'
import type { PublicIntegrations } from '@/lib/viasocket/view'

/**
 * Subscribes to WhatsApp "Message Notification" with a handler that runs on viaSocket
 * and calls our /api/webhooks/whatsapp — the request bot needs no public server of ours in the event path.
 */
export function WhatsAppInbound({ integrations, onChange }: { integrations: PublicIntegrations; onChange: (i: PublicIntegrations) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [showCode, setShowCode] = useState(false)
  const sub = integrations.waInbound
  const wa = integrations.apps.whatsapp
  const canSubscribe = wa.enabled && Boolean(wa.config.wba_id && wa.config.phone_id)

  async function run(kind: string, fn: () => Promise<{ integrations: PublicIntegrations; warning?: string; already?: boolean }>) {
    setBusy(kind)
    try {
      const r = await fn()
      onChange(r.integrations)
      if (r.warning) toast.info('Subscribed — one thing to check', r.warning)
      else toast.success(r.already ? 'Already subscribed' : kind === 'subscribe' ? 'Listening for guest messages' : 'Updated')
    } catch (e: any) {
      toast.error('WhatsApp subscription failed', e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-ink-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Radio className="h-4 w-4 text-brand-400" />
          <div>
            <div className="text-sm font-medium text-white">Inbound messages → request bot</div>
            <div className="text-xs text-slate-400">Trigger: <code className="text-slate-300">Message Notification</code> · handler runs on viaSocket</div>
          </div>
        </div>
        {sub ? <Badge color={sub.status === 'active' ? 'green' : 'amber'}>{sub.status === 'active' ? '● listening' : 'paused'}</Badge> : <Badge>not subscribed</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!sub && <Button size="sm" disabled={!canSubscribe} loading={busy === 'subscribe'} onClick={() => run('subscribe', () => api('/api/viasocket/subscribe-whatsapp', { method: 'POST' }))}>Subscribe to inbound messages</Button>}
        {sub && (
          <>
            <Button size="sm" variant="secondary" loading={busy === 'pause'} onClick={() => run('pause', () => api('/api/viasocket/subscribe-whatsapp', { method: 'PATCH', body: { action: sub.status === 'active' ? 'pause' : 'resume' } }))}>
              {sub.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
            </Button>
            <Button size="sm" variant="secondary" loading={busy === 'redeploy'} onClick={() => run('redeploy', () => api('/api/viasocket/subscribe-whatsapp', { method: 'PATCH', body: { action: 'redeploy' } }))}><RefreshCw className="h-3.5 w-3.5" /> Redeploy handler</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCode((s) => !s)}><Code2 className="h-3.5 w-3.5" /> {showCode ? 'Hide' : 'View'} handler</Button>
          </>
        )}
      </div>
      {!canSubscribe && !sub && <p className="mt-2 text-xs text-slate-500">Pick the business account and phone number above first.</p>}
      {sub && <p className="mt-2 text-xs text-slate-500">Subscribed {timeAgo(sub.created_at)} on phone {String(integrations.apps.whatsapp.config.phone_id_label ?? sub.inputData.phone_id)}.</p>}
      {showCode && sub && <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-ink-950 p-3 text-[11px] leading-relaxed text-slate-300">{sub.handler}</pre>}
    </div>
  )
}
