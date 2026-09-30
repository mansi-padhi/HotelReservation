'use client'
import { CheckCircle2, CircleDashed, Clock, Link2, LogIn, LogOut, Plus, UserRound, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/Toast'
import { AppIcon, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '@/components/ui'
import { OptionPicker } from '@/components/viasocket/OptionPicker'
import { api } from '@/lib/client-api'
import type { AttendanceShift, Employee } from '@/lib/types'
import { cn, initials } from '@/lib/utils'
import { APPS, KEKA_EMPLOYEE_PICKER } from '@/lib/viasocket/apps'

type KekaState = { connected: boolean; ready: boolean; shiftHours: number }
const ROLES = ['Front desk', 'Housekeeping', 'Maintenance', 'Kitchen', 'Management', 'Staff']

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
function duration(from: string, to?: string) {
  const mins = Math.max(0, Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 60000))
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
}

function KekaMark({ status }: { status?: AttendanceShift['keka_checkin'] }) {
  if (status === 'success') return <span title="Logged in Keka" className="inline-flex items-center gap-1 text-[11px] text-brand-300"><CheckCircle2 className="h-3.5 w-3.5" /> Keka</span>
  if (status === 'failed') return <span title="Keka rejected it — see Automations → Run log" className="inline-flex items-center gap-1 text-[11px] text-red-300"><XCircle className="h-3.5 w-3.5" /> failed</span>
  if (status === 'skipped') return <span title="Keka not connected or paused" className="inline-flex items-center gap-1 text-[11px] text-amber-300"><CircleDashed className="h-3.5 w-3.5" /> skipped</span>
  return <span className="text-[11px] text-slate-600">—</span>
}

export default function StaffView({ employees, shifts, keka, configured }: { employees: Employee[]; shifts: AttendanceShift[]; keka: KekaState; configured: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t) }, [])

  const open = (id: string) => shifts.find((s) => s.employee_id === id && !s.clock_out)
  const onDuty = employees.filter((e) => open(e.id)).length
  const todays = shifts.filter((s) => new Date(s.clock_in).toDateString() === new Date().toDateString())

  async function clock(e: Employee, dir: 'in' | 'out') {
    setBusy(e.id)
    try {
      const { shift } = await api<{ shift: AttendanceShift }>(`/api/staff/${e.id}/clock-${dir}`, { method: 'POST' })
      const status = dir === 'in' ? shift.keka_checkin : shift.keka_checkout
      const title = dir === 'in' ? `${e.name} clocked in` : `${e.name} clocked out · ${duration(shift.clock_in, shift.clock_out)}`
      if (status === 'success') toast.success(title, dir === 'in' ? 'Attendance entry created in Keka.' : 'Keka entry updated with the real clock-out.')
      else if (status === 'failed') toast.error(title, 'Keka rejected the entry — the reason is in Automations → Run log.')
      else toast.info(title, keka.connected ? 'Keka step was skipped (automation paused?).' : 'Recorded here. Connect Keka to send it there too.')
      router.refresh()
    } catch (err: any) {
      toast.error('Could not clock ' + dir, err.message)
    } finally {
      setBusy(null)
    }
  }

  async function link(e: Employee, value: unknown, label: string) {
    try {
      await api(`/api/staff/${e.id}`, { method: 'PATCH', body: { keka_employee_id: value ? String(value) : '', keka_employee_label: label } })
      toast.success(value ? `${e.name} linked to ${label}` : 'Keka link removed', value ? 'Keka will find them by employee ID from now on.' : 'Matching by work email again.')
      router.refresh()
    } catch (err: any) {
      toast.error('Could not link', err.message)
    }
  }

  return (
    <div>
      <PageHeader title="Staff" subtitle="Staff clock in and out here. Each clock-in is logged as an attendance entry in Keka, through viaSocket." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add employee</Button>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-slate-400">On duty now</div><div className="mt-1 text-2xl font-semibold text-brand-300">{onDuty}<span className="text-base text-slate-500"> / {employees.filter((e) => e.active).length}</span></div></Card>
        <Card className="p-4"><div className="text-xs text-slate-400">Clock-ins today</div><div className="mt-1 text-2xl font-semibold text-white">{todays.length}</div></Card>
        <Card className={cn('flex items-center gap-3 p-4', !keka.ready && 'border-amber-400/20')}>
          <AppIcon src={APPS.keka.icon} name="Keka" size={36} className="rounded-xl p-1.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white">Keka {keka.ready ? <Badge color="green">connected</Badge> : <Badge color="amber">not connected</Badge>}</div>
            <div className="mt-0.5 text-xs text-slate-400">{keka.ready ? `Planned shift ${keka.shiftHours}h · matched by work email` : 'Clock-ins are recorded here only.'}</div>
          </div>
          {!keka.ready && <Link href="/automations/settings"><Button size="sm" variant="secondary">Connect</Button></Link>}
        </Card>
      </div>

      {!configured && <p className="mb-4 text-xs text-amber-300/80">viaSocket secret not set — Keka steps will log as skipped.</p>}

      <Card className="overflow-hidden p-0">
        {employees.length === 0 ? <EmptyState icon={UserRound} title="No staff yet" body="Add employees with their Keka work email." action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add employee</Button>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Employee', 'Keka match', 'Status', 'Last Keka sync', ''].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {employees.map((e) => {
                  const s = open(e.id)
                  const last = shifts.find((x) => x.employee_id === e.id)
                  return (
                    <tr key={e.id} className={cn('border-t border-white/[0.05]', !e.active && 'opacity-50')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold', s ? 'bg-brand-400/20 text-brand-300 ring-2 ring-brand-400/40' : 'bg-white/[0.06] text-slate-300')}>{initials(e.name)}</span>
                          <div><div className="font-medium text-slate-100">{e.name}</div><div className="text-xs text-slate-500">{e.role} · {e.email}</div></div>
                        </div>
                      </td>
                      <td className="min-w-[220px] px-4 py-3">
                        {keka.connected ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <OptionPicker app="keka" versionId={KEKA_EMPLOYEE_PICKER.versionId} fieldKey={KEKA_EMPLOYEE_PICKER.fieldKey} existingFields={{}} value={e.keka_employee_id} valueLabel={e.keka_employee_label}
                                placeholder="By work email" searchable onChange={(v, l) => link(e, v, l)} />
                            </div>
                            {e.keka_employee_id && <button onClick={() => link(e, '', '')} className="text-xs text-slate-500 hover:text-white" title="Match by email instead">×</button>}
                          </div>
                        ) : <span className="text-xs text-slate-500">{e.keka_employee_label ? <><Link2 className="mr-1 inline h-3 w-3" />{e.keka_employee_label}</> : 'Work email'}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {s ? <span className="inline-flex items-center gap-1.5 text-brand-300"><span className="h-2 w-2 animate-pulse-dot rounded-full bg-brand-400" /> On duty since {hhmm(s.clock_in)} <span className="text-xs text-slate-500">· {duration(s.clock_in)}</span></span>
                          : <span className="text-slate-500">Off duty</span>}
                      </td>
                      <td className="px-4 py-3">{last ? <KekaMark status={last.clock_out ? last.keka_checkout : last.keka_checkin} /> : <span className="text-[11px] text-slate-600">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {s ? <Button size="sm" variant="secondary" loading={busy === e.id} onClick={() => clock(e, 'out')}><LogOut className="h-3.5 w-3.5" /> Clock out</Button>
                          : <Button size="sm" disabled={!e.active} loading={busy === e.id} onClick={() => clock(e, 'in')}><LogIn className="h-3.5 w-3.5" /> Clock in</Button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-medium text-slate-300"><Clock className="h-4 w-4 text-slate-500" /> Attendance — last 7 days</h2>
      <Card className="overflow-hidden p-0">
        {shifts.length === 0 ? <EmptyState icon={Clock} title="No shifts yet" body="Clock someone in above — the entry appears here and in Keka." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Employee', 'Date', 'Clock-in', 'Clock-out', 'Hours', 'Keka (in)', 'Keka (out)'].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {shifts.map((s) => {
                  const e = employees.find((x) => x.id === s.employee_id)
                  return (
                    <tr key={s.id} className="border-t border-white/[0.05]">
                      <td className="px-4 py-2.5 text-slate-200">{e?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{new Date(s.clock_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-2.5 text-slate-300">{hhmm(s.clock_in)}</td>
                      <td className="px-4 py-2.5 text-slate-300">{s.clock_out ? hhmm(s.clock_out) : <Badge color="green">on duty</Badge>}</td>
                      <td className="px-4 py-2.5 text-slate-400">{duration(s.clock_in, s.clock_out)}</td>
                      <td className="px-4 py-2.5"><KekaMark status={s.keka_checkin} /></td>
                      <td className="px-4 py-2.5">{s.clock_out ? <KekaMark status={s.keka_checkout} /> : <span className="text-[11px] text-slate-600">pending</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddEmployee open={adding} onClose={() => setAdding(false)} onSaved={() => router.refresh()} />
    </div>
  )
}

function AddEmployee({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', role: 'Front desk' })
  const [saving, setSaving] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="Add employee" subtitle="Use the email they have in Keka — that’s how their clock-ins are matched.">
      <form className="space-y-4" onSubmit={async (ev) => {
        ev.preventDefault()
        setSaving(true)
        try {
          await api('/api/staff', { body: f })
          toast.success(`${f.name} added`)
          setF({ name: '', email: '', role: 'Front desk' })
          onSaved()
          onClose()
        } catch (err: any) {
          toast.error('Could not add employee', err.message)
        } finally {
          setSaving(false)
        }
      }}>
        <Field label="Full name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Priya Desai" /></Field>
        <Field label="Work email (as in Keka)"><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="priya@yourhotel.com" /></Field>
        <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Button type="submit" className="w-full" loading={saving}>Add employee</Button>
      </form>
    </Modal>
  )
}
