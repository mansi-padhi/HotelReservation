'use client'
import { ArrowRight, CheckCircle2, Clock, MessageCircle, Plus, SprayCan, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card, Field, Modal, PageHeader, Select, StatusBadge, Textarea } from '@/components/ui'
import { api } from '@/lib/client-api'
import type { HousekeepingTask, Priority, Room } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

type Task = HousekeepingTask & { room?: Room }
const COLS: Array<{ key: HousekeepingTask['status']; label: string; next?: HousekeepingTask['status']; nextLabel?: string }> = [
  { key: 'pending', label: 'Pending', next: 'in_progress', nextLabel: 'Start' },
  { key: 'in_progress', label: 'In progress', next: 'completed', nextLabel: 'Mark done' },
  { key: 'completed', label: 'Completed' },
]
const PRI: Record<Priority, string> = { urgent: 'text-red-300 bg-red-400/10 ring-red-400/25', high: 'text-orange-300 bg-orange-400/10 ring-orange-400/25', normal: 'text-sky-300 bg-sky-400/10 ring-sky-400/25', low: 'text-slate-300 bg-white/5 ring-white/10' }
const STAFF = ['Rekha', 'Sunil', 'Maria', 'Imran']

export default function HousekeepingBoard({ tasks, rooms }: { tasks: Task[]; rooms: Room[] }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState<Task | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const isToday = (iso?: string) => iso && new Date(iso).toDateString() === new Date().toDateString()
  const visible = tasks.filter((t) => t.status !== 'completed' || isToday(t.completed_at) || isToday(t.created_at))

  async function move(t: Task, status: HousekeepingTask['status'], assigned_to?: string) {
    setBusy(t.id)
    try {
      const r = await api<{ roomFreed: boolean }>(`/api/housekeeping/${t.id}`, { method: 'PATCH', body: { status, ...(assigned_to !== undefined ? { assigned_to } : {}) } })
      if (r.roomFreed) toast.success(`Room ${t.room?.number} marked available`, 'Ready to sell again.')
      else toast.success(`Task ${status.replace('_', ' ')}`)
      setOpen(null)
      router.refresh()
    } catch (e: any) {
      toast.error('Update failed', e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title="Housekeeping" subtitle="Checkouts create cleaning tasks automatically. WhatsApp requests like “extra towels” land here too." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add task</Button>} />
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {COLS.map((c) => <span key={c.key} className="chip py-1"><b className="text-white">{visible.filter((t) => t.status === c.key).length}</b> {c.label.toLowerCase()}{c.key === 'completed' ? ' today' : ''}</span>)}
        <span className="chip py-1"><b className="text-white">{rooms.filter((r) => r.status === 'dirty').length}</b> dirty rooms</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map((col) => (
          <div key={col.key} className="rounded-2xl border border-white/[0.06] bg-ink-950/40 p-3">
            <div className="mb-3 flex items-center justify-between px-1.5">
              <h2 className="text-sm font-medium text-slate-200">{col.label}</h2>
              <span className="text-xs text-slate-500">{visible.filter((t) => t.status === col.key).length}</span>
            </div>
            <div className="space-y-2.5">
              {visible.filter((t) => t.status === col.key).map((t) => (
                <Card key={t.id} className="cursor-pointer p-4 transition hover:border-white/15" onClick={() => setOpen(t)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn('rounded-lg px-2.5 py-1 text-xl font-semibold ring-1 ring-inset', PRI[t.priority])}>{t.room?.number ?? '—'}</div>
                    <div className="text-right"><Badge>{t.type}</Badge><div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-500"><Clock className="h-3 w-3" />{timeAgo(t.created_at)}</div></div>
                  </div>
                  {t.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-300">{t.notes.startsWith('WhatsApp') && <MessageCircle className="mr-1 inline h-3.5 w-3.5 text-brand-400" />}{t.notes}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-500"><UserRound className="h-3.5 w-3.5" />{t.assigned_to ?? 'unassigned'}</span>
                    {col.next && <Button size="sm" variant={col.key === 'in_progress' ? 'primary' : 'secondary'} loading={busy === t.id} onClick={(e) => { e.stopPropagation(); move(t, col.next!) }}>{col.key === 'in_progress' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}{col.nextLabel}</Button>}
                  </div>
                </Card>
              ))}
              {visible.filter((t) => t.status === col.key).length === 0 && <div className="flex flex-col items-center py-8 text-xs text-slate-600"><SprayCan className="mb-2 h-5 w-5" />Nothing here</div>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} title={`Room ${open?.room?.number} · ${open?.type}`} subtitle={open ? `Created ${timeAgo(open.created_at)} · ${open.priority} priority` : ''}>
        {open && (
          <div className="space-y-4">
            {open.notes && <p className="rounded-xl bg-ink-900 p-3 text-sm text-slate-300">{open.notes}</p>}
            <div className="flex items-center gap-2"><span className="text-sm text-slate-400">Status</span><StatusBadge status={open.status} /></div>
            <Field label="Assigned to"><Select value={open.assigned_to ?? ''} onChange={(e) => move(open, open.status, e.target.value)}><option value="">Unassigned</option>{STAFF.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <div className="grid grid-cols-3 gap-2">
              {(['pending', 'in_progress', 'completed'] as const).map((s) => <Button key={s} variant={open.status === s ? 'primary' : 'secondary'} size="sm" loading={busy === open.id} onClick={() => move(open, s)}>{s.replace('_', ' ')}</Button>)}
            </div>
          </div>
        )}
      </Modal>
      <AddTask open={adding} onClose={() => setAdding(false)} rooms={rooms} onSaved={() => router.refresh()} />
    </div>
  )
}

function AddTask({ open, onClose, rooms, onSaved }: { open: boolean; onClose: () => void; rooms: Room[]; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ room_id: '', type: 'cleaning', priority: 'normal', assigned_to: '', notes: '' })
  const [saving, setSaving] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="New housekeeping task">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
          await api('/api/housekeeping', { body: f })
          toast.success('Task added')
          onSaved()
          onClose()
          setF({ room_id: '', type: 'cleaning', priority: 'normal', assigned_to: '', notes: '' })
        } catch (err: any) {
          toast.error('Could not add', err.message)
        } finally {
          setSaving(false)
        }
      }}>
        <Field label="Room"><Select required value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}><option value="">Choose…</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.type} · {r.status}</option>)}</Select></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['cleaning', 'turndown', 'inspection', 'special'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{['low', 'normal', 'high', 'urgent'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Assign"><Select value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })}><option value="">—</option>{STAFF.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        </div>
        <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <Button type="submit" className="w-full" loading={saving}>Add task</Button>
      </form>
    </Modal>
  )
}

