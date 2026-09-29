'use client'
import { CheckCircle2, Droplets, Fan, Plus, Sofa, Wrench, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { AppIcon, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, Tabs, Textarea, Toggle } from '@/components/ui'
import { api } from '@/lib/client-api'
import type { MaintenanceRequest, Room } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { APPS } from '@/lib/viasocket/apps'

type Req = MaintenanceRequest & { room_number?: string }
const CAT_ICON = { electrical: Zap, plumbing: Droplets, hvac: Fan, furniture: Sofa, other: Wrench }

export default function MaintenanceView({ requests, rooms, slackReady }: { requests: Req[]; rooms: Room[]; slackReady: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<'active' | 'resolved'>('active')
  const [adding, setAdding] = useState(false)
  const [resolving, setResolving] = useState<Req | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const list = requests.filter((r) => (tab === 'active' ? ['open', 'in_progress'].includes(r.status) : ['resolved', 'closed'].includes(r.status)))

  async function update(r: Req, body: Partial<MaintenanceRequest>) {
    setBusy(r.id)
    try {
      await api(`/api/maintenance/${r.id}`, { method: 'PATCH', body })
      toast.success(body.status === 'resolved' ? 'Resolved' : 'Updated')
      setResolving(null)
      setNotes('')
      router.refresh()
    } catch (e: any) {
      toast.error('Update failed', e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title="Maintenance" subtitle="Every new request pings the ops Slack channel. Guests can report issues by WhatsApp — “the AC isn’t working” lands here." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Report issue</Button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Active', count: requests.filter((r) => ['open', 'in_progress'].includes(r.status)).length }, { value: 'resolved', label: 'Resolved', count: requests.filter((r) => ['resolved', 'closed'].includes(r.status)).length }]} />
        <span className="flex items-center gap-2 text-xs text-slate-500"><AppIcon src={APPS.slack.icon} name="Slack" size={18} />{slackReady ? 'Slack alerts on' : 'Connect Slack to get alerts'}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><EmptyState icon={CheckCircle2} title={tab === 'active' ? 'All clear' : 'Nothing resolved yet'} /></Card>}
        {list.map((r) => {
          const Icon = CAT_ICON[r.category] ?? Wrench
          return (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/[0.05] p-2.5"><Icon className="h-5 w-5 text-slate-300" /></div>
                  <div><div className="text-sm font-medium text-white">Room {r.room_number ?? '—'}</div><div className="text-xs capitalize text-slate-500">{r.category} · {timeAgo(r.created_at)}</div></div>
                </div>
                <StatusBadge status={r.priority} />
              </div>
              <p className="mt-4 flex-1 text-sm text-slate-200">{r.issue}</p>
              <div className="mt-2 text-xs text-slate-500">Reported by {r.reported_by}</div>
              {r.resolution_notes && <div className="mt-2 rounded-lg bg-brand-400/[0.06] p-2 text-xs text-brand-200">✓ {r.resolution_notes}</div>}
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <StatusBadge status={r.status} />
                {tab === 'active' && (
                  <div className="flex gap-1.5">
                    {r.status === 'open' && <Button size="sm" variant="secondary" loading={busy === r.id} onClick={() => update(r, { status: 'in_progress' })}>Start</Button>}
                    <Button size="sm" onClick={() => setResolving(r)}>Resolve</Button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={!!resolving} onClose={() => setResolving(null)} title="Resolve request" subtitle={resolving?.issue}>
        <Field label="What was done?"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Replaced capacitor, AC cooling to 21°C" /></Field>
        <Button className="mt-4 w-full" loading={busy === resolving?.id} onClick={() => resolving && update(resolving, { status: 'resolved', resolution_notes: notes })}>Mark resolved</Button>
      </Modal>
      <NewRequest open={adding} onClose={() => setAdding(false)} rooms={rooms} onSaved={() => router.refresh()} />
    </div>
  )
}

function NewRequest({ open, onClose, rooms, onSaved }: { open: boolean; onClose: () => void; rooms: Room[]; onSaved: () => void }) {
  const toast = useToast()
  const blank = { room_id: '', issue: '', category: 'other', priority: 'normal', reported_by: 'Front desk', block_room: false }
  const [f, setF] = useState(blank)
  const [saving, setSaving] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="Report a maintenance issue" subtitle="Slack gets an alert with priority and room.">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          await api('/api/maintenance', { body: f })
          toast.success('Request logged', 'Ops channel alerted via Slack.')
          setF(blank)
          onSaved()
          onClose()
        } catch (err: any) {
          toast.error('Could not log request', err.message)
        } finally {
          setSaving(false)
        }
      }}>
        <Field label="Room"><Select value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}><option value="">Common area / none</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.type}</option>)}</Select></Field>
        <Field label="Issue"><Textarea required value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} placeholder="Shower has no hot water" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['electrical', 'plumbing', 'hvac', 'furniture', 'other'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['low', 'normal', 'high', 'urgent'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Reported by"><Input value={f.reported_by} onChange={(e) => setF({ ...f, reported_by: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-ink-900 p-3 text-sm"><span className="text-slate-300">Take room out of service</span><Toggle checked={f.block_room} onChange={(v) => setF({ ...f, block_room: v })} label="Block room" /></div>
        <Button type="submit" className="w-full" loading={saving}>Log request</Button>      </form>
    </Modal>
  )
}
