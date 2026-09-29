'use client'
import { AlertTriangle, ArrowLeft, Braces, Loader2, Play, Workflow } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui'
import { EVENT_LABELS, STUDIO_EVENTS } from '@/lib/automations/catalog'
import { api } from '@/lib/client-api'
import type { HotelEvent } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'
import type { PublicIntegrations } from '@/lib/viasocket/view'

type Flow = PublicIntegrations['studioFlows'][number]
const EMBED_ORIGIN = 'https://embedfrontend.viasocket.com'
const EMBED_SRC = 'https://embed.viasocket.com/prod-embedcomponent.js'

declare global {
  interface Window {
    viaSocket?: {
      mount: (opts: { embedToken: string; parent: string | Element; config?: Record<string, unknown>; open?: Record<string, unknown> }) => {
        on: (event: string, fn: (data: any) => void) => void
        destroy: () => void
        update: (c: Record<string, unknown>) => void
      }
    }
  }
}

function loadEmbed(): Promise<void> {
  if (window.viaSocket?.mount) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`script[src="${EMBED_SRC}"]`)) {
      const s = document.createElement('script')
      s.src = EMBED_SRC
      s.async = true
      document.body.appendChild(s)
    }
    const t0 = Date.now()
    const wait = () => (window.viaSocket?.mount ? resolve() : Date.now() - t0 > 12000 ? reject(new Error('viaSocket embed script did not load')) : setTimeout(wait, 120))
    wait()
  })
}

export default function Studio({ hotelId, samplePayload, initialFlows, configured }: { hotelId: string; samplePayload: unknown; initialFlows: Flow[]; configured: boolean }) {
  const toast = useToast()
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(configured ? 'loading' : 'error')
  const [err, setErr] = useState(configured ? '' : 'Add VIASOCKET_EMBED_SECRET to .env.local to open the studio.')
  const [flows, setFlows] = useState(initialFlows)
  const [busy, setBusy] = useState<string | null>(null)
  const [showPayload, setShowPayload] = useState(false)
  // viaSocket's flow editor has no "back to catalog" control of its own — bumping this tears
  // down the current mount and opens a fresh one, which always lands back on the catalog.
  const [mountKey, setMountKey] = useState(0)

  // Read through refs so a new prop object or toast never re-runs the mount effect.
  const payloadRef = useRef(samplePayload)
  const toastRef = useRef(toast)
  payloadRef.current = samplePayload
  toastRef.current = toast

  useEffect(() => {
    if (!configured || !box.current) return
    setState('loading')
    const toast = toastRef.current
    let embed: ReturnType<NonNullable<Window['viaSocket']>['mount']> | null = null
    let cancelled = false
    // Each mount gets its own container, removed on cleanup: React dev mode mounts effects twice
    // and viaSocket's destroy() does not always take its UI out of the parent, which left two
    // stacked copies of the studio in the box.
    const host = box.current
    host.replaceChildren()
    const slot = document.createElement('div')
    slot.style.height = '100%'
    host.appendChild(slot)

    // What the user builds reaches Hotelator only through this listener.
    const onFlow = async (flow: any) => {
      if (!flow?.id || !flow.action) return
      try {
        const r = await api<{ integrations: PublicIntegrations }>('/api/viasocket/flows', {
          body: { id: flow.id, action: flow.action, status: flow.status, title: flow.title, description: flow.description, webhookurl: flow.webhookurl, payload: flow.payload, serviceIcons: flow.serviceIcons },
        })
        setFlows(r.integrations.studioFlows)
        if (flow.action === 'published') toast.success('Automation published', `“${flow.title || 'Untitled'}” will run on New booking. Change its events on the right.`)
        if (flow.action === 'deleted') toast.info('Automation deleted')
      } catch (e: any) {
        toast.error('Could not save the automation', e.message)
      }
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EMBED_ORIGIN) return
      onFlow(event.data)
    }

    ;(async () => {
      try {
        const [{ token }] = await Promise.all([api<{ token: string }>('/api/viasocket/token', { method: 'POST' }), loadEmbed()])
        if (cancelled || !slot.isConnected) return
        embed = window.viaSocket!.mount({
          embedToken: token,
          parent: slot,
          config: {
            pageheading: 'Automation',
            pagesubheading: 'Build your own workflows on Hotelator events — bookings, check-ins, checkouts, payments — into any of 2,300+ apps.',
            // The native flow list — see every flow, open, pause, trash. It also lists the
            // connections the Apps API made on this same embed (Gmail/Sheets/Calendar enable,
            // the WhatsApp trigger), titled by their bare service id — the warning below covers that.
            showEnabled: true,
            themeJson: { '--primary-color': '#16963c', '--font-family': 'Inter' },
          },
          open: { dummy_payload: payloadRef.current, meta: JSON.stringify({ hotel_id: hotelId, source: 'hotelator-studio' }) },
        })
        if (typeof embed.on === 'function') {
          embed.on('flow', onFlow)
          embed.on('error', (e: any) => { setState('error'); setErr(e?.message || 'Embed error') })
        } else {
          window.addEventListener('message', onMessage)
        }
        setState('ready')
      } catch (e: any) {
        if (!cancelled) {
          setState('error')
          setErr(e.message)
        }
      }
    })()
    return () => {
      cancelled = true
      window.removeEventListener('message', onMessage)
      try { embed?.destroy() } catch { /* already gone */ }
      slot.remove()
    }
  }, [configured, hotelId, mountKey])

  function backToCatalog() {
    setMountKey((k) => k + 1)
  }

  async function setEvents(flow: Flow, event: HotelEvent) {
    const events = flow.events.includes(event) ? flow.events.filter((e) => e !== event) : [...flow.events, event]
    const r = await api<{ integrations: PublicIntegrations }>('/api/viasocket/flows', { method: 'PATCH', body: { id: flow.id, events } })
    setFlows(r.integrations.studioFlows)
  }

  async function test(flow: Flow) {
    setBusy(flow.id)
    try {
      await api('/api/viasocket/flows', { method: 'PUT', body: { id: flow.id } })
      toast.success(`“${flow.title}” ran`, 'The response is in Automations → Logs.')
    } catch (e: any) {
      toast.error('Test run failed', e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="viaSocket prebuilt UI" title="Automation Studio" subtitle="Anything the 11 built-in automations don’t cover: connect any app, map fields from a Hotelator event and publish. Hotelator calls your flow every time that event happens."
        actions={<Button variant="secondary" onClick={() => setShowPayload((s) => !s)}><Braces className="h-4 w-4" /> Event payload</Button>} />

      {showPayload && (
        <Card className="mb-5 p-4">
          <div className="mb-2 text-xs text-slate-400">Every studio flow receives this shape (sample from a real reservation). It’s also passed to the builder as <code>dummy_payload</code> for field mapping.</div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-ink-950 p-3 text-[11px] text-slate-300">{JSON.stringify(samplePayload, null, 2)}</pre>
        </Card>
      )}

      {/*
        Full container width: viaSocket's flow editor toolbar (Publish, status, …) doesn't
        reflow below ~880px and gets clipped if squeezed into a side-by-side layout. The panels
        below get the space back instead of sitting beside a too-narrow box.
      */}
      <Card className="relative mb-5 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/20 px-4 py-2.5">
          <span className="text-xs text-slate-500">viaSocket Embed — Automation Studio</span>
          <Button size="sm" variant="secondary" onClick={backToCatalog} disabled={state === 'loading'}><ArrowLeft className="h-3.5 w-3.5" /> All apps</Button>
        </div>
        <div className="relative">
          <div ref={box} className="h-[720px] w-full bg-white" />
          {state !== 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-850 p-8 text-center">
              {state === 'loading' ? <><Loader2 className="h-6 w-6 animate-spin text-brand-400" /><div className="text-sm text-slate-400">Opening viaSocket…</div></> : (
                <><AlertTriangle className="h-6 w-6 text-amber-300" /><div className="font-medium text-white">Studio unavailable</div><div className="max-w-md text-sm text-slate-400">{err}</div></>
              )}
            </div>
          )}
        </div>
      </Card>

      <p className="mb-3 text-xs text-slate-500">Deep inside a flow and stuck? viaSocket’s own editor doesn’t have a back button — use <b className="text-slate-300">← All apps</b> above to return to the catalog. Unpublished changes to that flow are lost, same as closing the tab.</p>

      <div className="mb-5 flex gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-xs text-amber-100/80">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
        <p>The list inside the studio (open it from the <b>Flow</b> tab, or the app icon top-left) shows every flow, published or not, with full controls — open, pause, trash. It also lists rows named by a bare code like <code className="rounded bg-black/30 px-1">rowqm5xi2</code> or <code className="rounded bg-black/30 px-1">rowo0bqrhj5g</code> — those are Hotelator’s own Gmail/Sheets/Calendar/WhatsApp connections, not something you built. <b>Trashing one of those breaks that app’s built-in automations</b> (this happened to Sheets earlier — viaSocket deleted its script from inside the studio, silently). Only manage rows with a name you gave them here; disconnect an app from <Link href="/automations/settings" className="text-amber-200 underline underline-offset-2">App connections</Link> instead.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Your studio automations</h3>
              <Badge color="green">{flows.filter((f) => f.status === 'active').length} active</Badge>
            </div>
            {flows.length === 0 ? (
              <EmptyState icon={Workflow} title="Nothing published yet" body="Pick an app in the studio, map fields from the sample booking, and publish. It shows up here." />
            ) : (
              <div className="mt-4 space-y-3">
                {flows.map((f) => (
                  <div key={f.id} className="rounded-xl border border-white/[0.07] bg-ink-900/60 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{f.title}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">updated {timeAgo(f.updated_at)}</div>
                      </div>
                      <Badge color={f.status === 'active' ? 'green' : f.status === 'paused' ? 'amber' : 'gray'}>{f.status}</Badge>
                    </div>
                    {f.serviceIcons?.length ? <div className="mt-2 flex gap-1">{f.serviceIcons.slice(0, 5).map((s) => <img key={s} src={s} alt="" className="h-5 w-5 rounded bg-white p-0.5" />)}</div> : null}
                    <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-500">Runs on</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {STUDIO_EVENTS.map((e) => (
                        <button key={e} onClick={() => setEvents(f, e)} className={cn('rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset transition', f.events.includes(e) ? 'bg-brand-400/15 text-brand-300 ring-brand-400/30' : 'text-slate-500 ring-white/10 hover:text-slate-300')}>{EVENT_LABELS[e]}</button>
                      ))}
                    </div>
                    <Button size="sm" variant="secondary" className="mt-3 w-full" disabled={!f.hasUrl || f.status !== 'active'} loading={busy === f.id} onClick={() => test(f)}><Play className="h-3.5 w-3.5" /> Test with sample booking</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card className="h-fit p-5 text-xs leading-relaxed text-slate-400">
          <div className="mb-1.5 font-medium text-slate-200">How it works</div>
          The studio is viaSocket’s prebuilt UI mounted in this page with the hotel’s embed token. When you publish, its <code>flow</code> event hands Hotelator the flow URL, which is stored server-side and called with the event payload. Flows you pause or delete in the studio stop running here too. viaSocket’s own header has no way back to the catalog — that’s what the <b className="text-slate-300">← All apps</b> button above does, from Hotelator’s side.
        </Card>
      </div>
    </div>
  )
}
