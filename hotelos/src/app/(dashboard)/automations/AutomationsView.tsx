'use client'
import { ArrowRight, BarChart3, CalendarPlus, CheckCircle2, ChevronRight, CircleDashed, Clock, CreditCard, Crown, DoorOpen, Filter, MessageCircle, Play, Plug, Receipt, ScrollText, SprayCan, UserPlus, Workflow, Wrench, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useMemo, useState } from 'react'
import { LogoMark } from '@/components/Logo'
import { useToast } from '@/components/Toast'
import { AppIcon, Badge, Button, Card, EmptyState, PageHeader, Select, StatusBadge, Tabs, Toggle } from '@/components/ui'
import { EVENT_LABELS, TEMPLATES, type AutomationTemplate } from '@/lib/automations/catalog'
import { api } from '@/lib/client-api'
import type { AppKey, AutomationLog } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'
import { APPS } from '@/lib/viasocket/apps'

type Log = AutomationLog & { code?: string }
type State = 'live' | 'partial' | 'off' | 'paused'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = { CalendarPlus, Clock, DoorOpen, Receipt, SprayCan, Wrench, MessageCircle, CreditCard, Crown, BarChart3, UserPlus }
const WEEK = 7 * 864e5

export default function AutomationsView({ logs, toggles, ready, connected, configured, studio }: {
  logs: Log[]
  toggles: Record<string, boolean>
  ready: Record<string, boolean>
  connected: Record<string, boolean>
  configured: boolean
  studio: Array<{ title: string; events: string[] }>
}) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<'automations' | 'logs'>('automations')
  const [on, setOn] = useState(toggles)
  const [running, setRunning] = useState<string | null>(null)
  const [status, setStatus] = useState('all')
  const [app, setApp] = useState('all')
  const [event, setEvent] = useState('all')
  const [day, setDay] = useState('all')
  const [open, setOpen] = useState<string | null>(null)

  const stateOf = (t: AutomationTemplate): { state: State; live: number; total: number } => {
    const appSteps = t.steps.filter((s) => s.app !== 'system')
    const live = appSteps.filter((s) => ready[s.app]).length
    if (on[t.key] === false) return { state: 'paused', live, total: appSteps.length }
    return { state: live === 0 ? 'off' : live === appSteps.length ? 'live' : 'partial', live, total: appSteps.length }
  }

  const perEvent = useMemo(() => {
    const m: Record<string, { last?: Log; lastAny: Log; week: number; delivered: number; failed: number }> = {}
    for (const l of logs) {
      const e = (m[l.event_type] ??= { lastAny: l, week: 0, delivered: 0, failed: 0 })
      if (!e.last && l.status !== 'skipped') e.last = l
      if (Date.now() - new Date(l.created_at).getTime() < WEEK) {
        e.week++
        if (l.status === 'success') e.delivered++
        if (l.status === 'failed') e.failed++
      }
    }
    return m
  }, [logs])

  const states = TEMPLATES.map(stateOf)
  // Only app actions set off by hotel events — not connection tests or internal bookkeeping.
  const recent = logs.filter((l) => l.event_type !== 'test' && l.app !== 'system' && Date.now() - new Date(l.created_at).getTime() < WEEK)
  const summary = {
    live: states.filter((s) => s.state === 'live').length,
    partial: states.filter((s) => s.state === 'partial').length,
    off: states.filter((s) => s.state === 'off' || s.state === 'paused').length,
    delivered: recent.filter((l) => l.status === 'success').length,
    failed: recent.filter((l) => l.status === 'failed').length,
  }

  const filtered = logs.filter((l) =>
    (status === 'all' || l.status === status) &&
    (app === 'all' || l.app === app) &&
    (event === 'all' || l.event_type === event) &&
    (day === 'all' || (day === 'today' ? new Date(l.created_at).toDateString() === new Date().toDateString() : Date.now() - new Date(l.created_at).getTime() < WEEK)),
  )

  async function toggle(key: string, v: boolean) {
    setOn((s) => ({ ...s, [key]: v }))
    try {
      await api('/api/automations', { method: 'PATCH', body: { key, enabled: v } })
      toast.success(v ? 'Automation resumed' : 'Automation paused')
    } catch (e: any) {
      setOn((s) => ({ ...s, [key]: !v }))
      toast.error('Could not update', e.message)
    }
  }

  async function runNow(path: string, name: string) {
    setRunning(path)
    try {
      const r = await api<any>(`/api/cron/${path}`, { method: 'POST' })
      toast.success(`${name} ran`, path === 'pre-arrival' ? `${r.reservations} guest(s) arriving in 3 days` : `Occupancy ${r.stats?.[0]?.occupancy_pct}% — see Logs`)
      router.refresh()
    } catch (e: any) {
      toast.error('Run failed', e.message)
    } finally {
      setRunning(null)
    }
  }

  function showRuns(key: string) {
    setEvent(key)
    setStatus('all')
    setApp('all')
    setDay('all')
    setTab('logs')
  }

  return (
    <div>
      <PageHeader eyebrow="Powered by viaSocket" title="Automations" subtitle="What runs on each hotel event, step by step, and which steps are live with the apps you’ve connected. Every run is logged with the exact payload and the app’s reply."
        actions={<>
          <Link href="/automations/studio"><Button variant="secondary"><Workflow className="h-4 w-4" /> Automation Studio</Button></Link>
          <Link href="/automations/settings"><Button><Plug className="h-4 w-4" /> App connections</Button></Link>
        </>} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Fully live', summary.live, 'text-brand-300', `of ${TEMPLATES.length} automations`],
          ['Partly live', summary.partial, 'text-amber-300', 'some apps not connected'],
          ['Not live', summary.off, 'text-slate-300', 'needs an app, or paused'],
          ['Delivered', summary.delivered, 'text-white', 'app actions, last 7 days'],
          ['Failed', summary.failed, summary.failed ? 'text-red-300' : 'text-white', 'last 7 days'],
        ].map(([k, v, c, sub]) => (
          <Card key={k as string} className="p-4">
            <div className="text-xs text-slate-400">{k}</div>
            <div className={cn('mt-1 text-2xl font-semibold', c as string)}>{v}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>
          </Card>
        ))}
      </div>

      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'automations', label: 'Automations', count: TEMPLATES.length }, { value: 'logs', label: 'Run log', count: logs.length }]} /></div>

      {tab === 'automations' ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {TEMPLATES.map((t, i) => {
            const Icon = ICONS[t.icon] ?? Zap
            const { state, live, total } = states[i]!
            const stats = perEvent[t.key]
            const flows = studio.filter((f) => f.events.includes(t.key))
            return (
              <Card key={t.key} className={cn('flex flex-col p-5 transition', state === 'live' && 'ring-1 ring-brand-400/25', (state === 'paused' || state === 'off') && 'opacity-80')}>
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-xl p-2.5 ring-1', state === 'live' ? 'bg-brand-400/10 ring-brand-400/25' : 'bg-white/[0.04] ring-white/10')}><Icon className={cn('h-5 w-5', state === 'live' ? 'text-brand-400' : 'text-slate-400')} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{t.name}</h3>
                      {state === 'live' && <Badge color="green"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-400" /> Live</Badge>}
                      {state === 'partial' && <Badge color="amber">{live}/{total} apps live</Badge>}
                      {state === 'off' && <Badge>Not live</Badge>}
                      {state === 'paused' && <Badge>Paused</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-400">{t.trigger}</p>
                  </div>
                  <Toggle checked={on[t.key] !== false} onChange={(v) => toggle(t.key, v)} label={`Toggle ${t.name}`} />
                </div>

                <ol className="mt-4 space-y-1.5">
                  {t.steps.map((s, j) => {
                    const isSystem = s.app === 'system'
                    const ok = isSystem || ready[s.app]
                    return (
                      <li key={j} className={cn('flex items-center gap-2.5 rounded-lg border px-2.5 py-2', ok ? 'border-white/[0.06] bg-white/[0.02]' : 'border-dashed border-white/[0.08]')}>
                        {isSystem ? <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-ink-900 ring-1 ring-white/10"><LogoMark className="h-3.5" /></span>
                          : <span className={cn('shrink-0', !ok && 'opacity-40 grayscale')}><AppIcon src={APPS[s.app as AppKey].icon} name={APPS[s.app as AppKey].name} size={22} /></span>}
                        <div className="min-w-0 flex-1">
                          <div className={cn('truncate text-[13px]', ok ? 'text-slate-200' : 'text-slate-500')} title={s.what}>{s.what}</div>
                          {s.when && <div className="text-[10px] text-slate-500">only if {s.when}</div>}
                        </div>
                        {isSystem ? <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">built-in</span>
                          : ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-400" />
                            : <Link href="/automations/settings" className="shrink-0 text-[11px] text-amber-300 hover:text-amber-200">{connected[s.app] ? 'Finish setup' : `Connect ${APPS[s.app as AppKey].name}`}</Link>}
                      </li>
                    )
                  })}
                  {flows.map((f) => (
                    <li key={f.title} className="flex items-center gap-2.5 rounded-lg border border-violet-400/20 bg-violet-400/[0.04] px-2.5 py-2">
                      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-violet-400/15"><Workflow className="h-3.5 w-3.5 text-violet-300" /></span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">Studio flow: {f.title}</span>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-300" />
                    </li>
                  ))}
                </ol>

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    {stats?.last ? <>
                      <span className={cn('h-1.5 w-1.5 rounded-full', stats.last.status === 'success' ? 'bg-brand-400' : 'bg-red-400')} />
                      Last run {timeAgo(stats.last.created_at)}{stats.week ? ` · ${stats.delivered} delivered${stats.failed ? `, ${stats.failed} failed` : ''} this week` : ''}
                    </> : stats ? <><CircleDashed className="h-3 w-3" /> Ran {timeAgo(stats.lastAny.created_at)} — every step skipped</> : <><CircleDashed className="h-3 w-3" /> Hasn’t run yet</>}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    {stats && <Button size="sm" variant="ghost" onClick={() => showRuns(t.key)}>Runs</Button>}
                    {t.tryIt.run ? <Button size="sm" variant="secondary" loading={running === t.tryIt.run} onClick={() => runNow(t.tryIt.run!, t.name)}><Play className="h-3 w-3" /> Run now</Button>
                      : t.tryIt.href ? <Link href={t.tryIt.href} target={t.tryIt.href === '/signup' ? '_blank' : undefined}><Button size="sm" variant="secondary">{t.tryIt.label} <ArrowRight className="h-3 w-3" /></Button></Link>
                        : <span className="text-[11px] text-slate-500">{t.tryIt.label}</span>}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-4">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select className="w-auto py-1.5 text-xs" value={event} onChange={(e) => setEvent(e.target.value)}><option value="all">All events</option>{Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            <Select className="w-auto py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="success">Delivered</option><option value="failed">Failed</option><option value="skipped">Skipped</option></Select>
            <Select className="w-auto py-1.5 text-xs" value={app} onChange={(e) => setApp(e.target.value)}><option value="all">All apps</option>{Object.values(APPS).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}<option value="custom">Studio flows</option><option value="system">System</option></Select>
            <Select className="w-auto py-1.5 text-xs" value={day} onChange={(e) => setDay(e.target.value)}><option value="all">Any time</option><option value="today">Today</option><option value="week">Last 7 days</option></Select>
            {(event !== 'all' || status !== 'all' || app !== 'all' || day !== 'all') && <button onClick={() => { setEvent('all'); setStatus('all'); setApp('all'); setDay('all') }} className="text-xs text-brand-400 hover:text-brand-300">Clear</button>}
            <span className="ml-auto text-xs text-slate-500">{filtered.length} entries</span>
          </div>
          {filtered.length === 0 ? <EmptyState icon={ScrollText} title="No runs match" body="Create a booking, sign up on the website or check a guest in — every step appears here." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2.5 font-medium">Time</th><th className="px-4 py-2.5 font-medium">Event</th><th className="px-4 py-2.5 font-medium">App</th><th className="px-4 py-2.5 font-medium">What happened</th><th className="px-4 py-2.5 font-medium">Status</th><th /></tr></thead>
                <tbody>
                  {filtered.map((l) => (
                    <Fragment key={l.id}>
                      <tr onClick={() => setOpen(open === l.id ? null : l.id)} className="cursor-pointer border-t border-white/[0.05] hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-200">{EVENT_LABELS[l.event_type] ?? l.event_type}{l.code && <span className="ml-1.5 text-xs text-slate-500">{l.code}</span>}</td>
                        <td className="px-4 py-3">{l.app in APPS ? <span className="flex items-center gap-2"><AppIcon src={APPS[l.app as AppKey].icon} name={l.app} size={20} /><span className="text-xs text-slate-400">{APPS[l.app as AppKey].name}</span></span> : <Badge color="violet">{l.app === 'custom' ? 'Studio' : l.app}</Badge>}</td>
                        <td className="max-w-md px-4 py-3 text-slate-300"><span className="line-clamp-1">{l.summary}</span></td>
                        <td className="px-4 py-3">{l.status === 'success' ? <Badge color="green">delivered</Badge> : <StatusBadge status={l.status} />}</td>
                        <td className="px-3 text-slate-500"><ChevronRight className={cn('h-4 w-4 transition', open === l.id && 'rotate-90')} /></td>
                      </tr>
                      {open === l.id && (
                        <tr className="bg-black/20"><td colSpan={6} className="px-4 py-3">
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink-950 p-3 text-[11px] leading-relaxed text-slate-300">{JSON.stringify(l.details ?? { summary: l.summary }, null, 2)}</pre>
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {!configured && <p className="mt-6 text-center text-xs text-slate-500">viaSocket secret not set — app steps are logged as “skipped” with the payload they would send. <Link href="/automations/settings" className="text-brand-400">Set it up →</Link></p>}
    </div>
  )
}
