'use client'
import { CalendarPlus, Check, Copy, Crown, ExternalLink, LogIn, LogOut, Plus, Receipt, Search, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useToast } from '@/components/Toast'
import { AppIcon, Badge, Button, Card, Drawer, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Tabs, Textarea, Toggle } from '@/components/ui'
import { EVENT_LABELS } from '@/lib/automations/catalog'
import { api } from '@/lib/client-api'
import type { AutomationLog, Folio, FolioItem, ReservationView, Room } from '@/lib/types'
import { addDays, cn, inr, nightsBetween, prettyDate, timeAgo, today } from '@/lib/utils'
import { APPS } from '@/lib/viasocket/apps'

type R = ReservationView & { checkin_url: string }
type TabKey = 'all' | 'arrivals' | 'departures' | 'inhouse' | 'upcoming'

export default function ReservationsView({ reservations, rooms, folios, items, logs, taxRate, openNew }: { reservations: R[]; rooms: Room[]; folios: Folio[]; items: FolioItem[]; logs: AutomationLog[]; taxRate: number; openNew: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const t = today()
  const [tab, setTab] = useState<TabKey>('all')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(openNew)
  const [viewId, setViewId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const groups: Record<TabKey, (r: R) => boolean> = {
    all: () => true,
    arrivals: (r) => r.check_in === t && r.status !== 'cancelled',
    departures: (r) => r.check_out === t && ['checked_in', 'checked_out'].includes(r.status),
    inhouse: (r) => r.status === 'checked_in',
    upcoming: (r) => r.status === 'confirmed' && r.check_in > t,
  }
  const list = reservations.filter(groups[tab]).filter((r) => !q || `${r.guest.name} ${r.guest.phone} ${r.code} ${r.room.number}`.toLowerCase().includes(q.toLowerCase()))
  const viewing = reservations.find((r) => r.id === viewId)

  async function act(r: R, action: 'checkin' | 'checkout' | 'cancel') {
    setBusy(`${r.id}:${action}`)
    try {
      await api(`/api/reservations/${r.id}/${action}`, { method: 'POST' })
      toast.success(
        action === 'checkin' ? `${r.guest.name} checked in` : action === 'checkout' ? `${r.guest.name} checked out` : 'Reservation cancelled',
        action === 'checkin' ? 'Slack alert + WhatsApp welcome fired.' : action === 'checkout' ? 'Invoice sent, room marked dirty, cleaning task created.' : undefined,
      )
      router.refresh()
    } catch (e: any) {
      toast.error('Action failed', e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title="Reservations" subtitle="Every booking fires the confirmation automation — WhatsApp, Gmail, Calendar and Sheets — the moment it’s saved." actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New reservation</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: 'All', count: reservations.length },
          { value: 'arrivals', label: "Today's check-ins", count: reservations.filter(groups.arrivals).length },
          { value: 'departures', label: "Today's check-outs", count: reservations.filter(groups.departures).length },
          { value: 'inhouse', label: 'In-house', count: reservations.filter(groups.inhouse).length },
          { value: 'upcoming', label: 'Upcoming', count: reservations.filter(groups.upcoming).length },
        ]} />
        <div className="relative lg:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, phone, code, room…" className="pl-9" /></div>
      </div>

      <Card className="overflow-hidden p-0">
        {list.length === 0 ? <EmptyState icon={CalendarPlus} title="No reservations here" body="Try another tab, or create a booking." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Total', 'Status', ''].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-white/[0.05] hover:bg-white/[0.015]">
                    <td className="px-4 py-3">
                      <button onClick={() => setViewId(r.id)} className="text-left">
                        <div className="flex items-center gap-1.5 font-medium text-slate-100 hover:text-brand-300">{r.guest.name}{r.is_vip && <Crown className="h-3.5 w-3.5 text-amber-300" />}</div>
                        <div className="text-xs text-slate-500">{r.guest.phone} · {r.code}</div>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3"><div className="text-slate-200">{r.room.number}</div><div className="text-xs text-slate-500">{r.room.type}</div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{prettyDate(r.check_in)}{r.check_in === t && <Badge color="green" className="ml-1.5">today</Badge>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{prettyDate(r.check_out)}</td>
                    <td className="px-4 py-3 text-slate-400">{r.total_nights}</td>
                    <td className="whitespace-nowrap px-4 py-3"><div className="text-slate-200">{inr(r.grand_total)}</div>{r.balance_due > 0 && r.status !== 'cancelled' && <div className="text-xs text-amber-300/80">{inr(r.balance_due)} due</div>}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} />{r.status === 'confirmed' && r.digital_checkin_completed && <div className="mt-1 text-[10px] text-brand-400">✓ checked in online</div>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {r.status === 'confirmed' && r.check_in <= t && <Button size="sm" loading={busy === `${r.id}:checkin`} onClick={() => act(r, 'checkin')}><LogIn className="h-3.5 w-3.5" /> Check in</Button>}
                        {r.status === 'checked_in' && <Button size="sm" variant="secondary" loading={busy === `${r.id}:checkout`} onClick={() => act(r, 'checkout')}><LogOut className="h-3.5 w-3.5" /> Check out</Button>}
                        <Button size="sm" variant="ghost" onClick={() => setViewId(r.id)}>View</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewReservation open={creating} onClose={() => setCreating(false)} rooms={rooms} reservations={reservations} taxRate={taxRate} onCreated={() => router.refresh()} />
      {viewing && <ReservationDetail r={viewing} folio={folios.find((f) => f.reservation_id === viewing.id)} items={items} logs={logs.filter((l) => l.reservation_id === viewing.id)} onClose={() => setViewId(null)} onAct={act} busy={busy} />}
    </div>
  )
}

function NewReservation({ open, onClose, rooms, reservations, taxRate, onCreated }: { open: boolean; onClose: () => void; rooms: Room[]; reservations: R[]; taxRate: number; onCreated: () => void }) {
  const toast = useToast()
  const blank = { guest_name: '', guest_phone: '', guest_email: '', room_id: '', check_in: today(), check_out: addDays(today(), 2), adults: 2, children: 0, booking_source: 'direct', special_requests: '', is_vip: false }
  const [f, setF] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ code: string; url: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const set = (k: keyof typeof blank, v: unknown) => setF((s) => ({ ...s, [k]: v }))

  const free = useMemo(() => rooms.filter((room) => room.status !== 'maintenance' && !reservations.some((r) => r.room_id === room.id && ['confirmed', 'checked_in'].includes(r.status) && f.check_in < r.check_out && r.check_in < f.check_out)), [rooms, reservations, f.check_in, f.check_out])
  const room = rooms.find((r) => r.id === f.room_id)
  const nights = nightsBetween(f.check_in, f.check_out)
  const subtotal = room ? nights * room.rate_per_night : 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api<{ reservation: ReservationView; checkin_url: string }>('/api/reservations', { body: f })
      setDone({ code: r.reservation.code, url: r.checkin_url, name: r.reservation.guest.name })
      toast.success(`Booking ${r.reservation.code} created`, 'Confirmation automation fired — see Automations → Logs.')
      onCreated()
    } catch (err: any) {
      toast.error('Could not create booking', err.message)
    } finally {
      setSaving(false)
    }
  }

  function close() {
    setDone(null)
    setF(blank)
    onClose()
  }

  return (
    <Drawer open={open} onClose={close} title={done ? 'Booking confirmed' : 'New reservation'} subtitle={done ? undefined : 'Guest gets WhatsApp + email instantly, with an online check-in link.'}>
      {done ? (
        <div className="text-center">
          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-400/15 ring-8 ring-brand-400/5"><Check className="h-8 w-8 text-brand-400" /></div>
          <h3 className="mt-5 text-xl font-semibold text-white">{done.code}</h3>
          <p className="mt-1 text-sm text-slate-400">{done.name}’s confirmation is on its way.</p>
          <div className="mt-6 rounded-xl border border-white/10 bg-ink-900 p-3 text-left">
            <div className="label">Digital check-in link</div>
            <div className="break-all text-sm text-slate-300">{done.url}</div>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(done.url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy check-in link'}</Button>
            <a href={done.url} target="_blank" rel="noreferrer"><Button variant="outline"><ExternalLink className="h-4 w-4" /> Open</Button></a>
          </div>
          <Button variant="ghost" className="mt-8" onClick={() => { setDone(null); setF(blank) }}>Create another</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guest name" className="sm:col-span-2"><Input required value={f.guest_name} onChange={(e) => set('guest_name', e.target.value)} placeholder="Ananya Sharma" /></Field>
            <Field label="Phone (WhatsApp)"><Input required value={f.guest_phone} onChange={(e) => set('guest_phone', e.target.value)} placeholder="+91 98xxx xxxxx" /></Field>
            <Field label="Email"><Input type="email" value={f.guest_email} onChange={(e) => set('guest_email', e.target.value)} placeholder="guest@email.com" /></Field>
            <Field label="Check-in"><Input type="date" min={today()} value={f.check_in} onChange={(e) => { set('check_in', e.target.value); if (e.target.value >= f.check_out) set('check_out', addDays(e.target.value, 1)); set('room_id', '') }} /></Field>
            <Field label="Check-out"><Input type="date" min={addDays(f.check_in, 1)} value={f.check_out} onChange={(e) => { set('check_out', e.target.value); set('room_id', '') }} /></Field>
          </div>
          <Field label={`Room · ${free.length} free for these dates`}>
            <Select required value={f.room_id} onChange={(e) => set('room_id', e.target.value)}>
              <option value="">Choose a room…</option>
              {(['Standard', 'Deluxe', 'Suite', 'Villa'] as const).map((type) => {
                const opts = free.filter((r) => r.type === type)
                return opts.length ? <optgroup key={type} label={`${type} · ${inr(opts[0]!.rate_per_night)}/night`}>{opts.map((r) => <option key={r.id} value={r.id}>Room {r.number} · floor {r.floor} · up to {r.max_occupancy}</option>)}</optgroup> : null
              })}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Adults"><Input type="number" min={1} max={room?.max_occupancy ?? 6} value={f.adults} onChange={(e) => set('adults', Number(e.target.value))} /></Field>
            <Field label="Children"><Input type="number" min={0} value={f.children} onChange={(e) => set('children', Number(e.target.value))} /></Field>
            <Field label="Source"><Select value={f.booking_source} onChange={(e) => set('booking_source', e.target.value)}>{['direct', 'phone', 'walkin', 'ota', 'online'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </div>
          <Field label="Special requests"><Textarea value={f.special_requests} onChange={(e) => set('special_requests', e.target.value)} placeholder="Airport pickup, late arrival, anniversary…" /></Field>
          <div className="flex items-center justify-between rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3.5">
            <div className="flex items-center gap-2.5"><Crown className="h-4 w-4 text-amber-300" /><div><div className="text-sm text-white">VIP guest</div><div className="text-xs text-slate-400">Also alerts Slack with a prep checklist + adds a Calendar reminder</div></div></div>
            <Toggle checked={f.is_vip} onChange={(v) => set('is_vip', v)} label="VIP" />
          </div>
          <div className="rounded-xl bg-ink-900 p-4 text-sm">
            <div className="flex justify-between text-slate-400"><span>{nights} night{nights !== 1 ? 's' : ''} × {room ? inr(room.rate_per_night) : '—'}</span><span>{inr(subtotal)}</span></div>
            <div className="mt-1 flex justify-between text-slate-400"><span>GST {Math.round(taxRate * 100)}%</span><span>{inr(subtotal * taxRate)}</span></div>
            <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2 font-semibold text-white"><span>Grand total</span><span>{inr(subtotal * (1 + taxRate))}</span></div>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={saving} disabled={!room || nights < 1}>Confirm booking & notify guest</Button>
        </form>
      )}
    </Drawer>
  )
}

function ReservationDetail({ r, folio, items, logs, onClose, onAct, busy }: { r: R; folio?: Folio; items: FolioItem[]; logs: AutomationLog[]; onClose: () => void; onAct: (r: R, a: 'checkin' | 'checkout' | 'cancel') => void; busy: string | null }) {
  const router = useRouter()
  const toast = useToast()
  const [charge, setCharge] = useState({ description: '', category: 'restaurant', quantity: 1, unit_price: '' })
  const [adding, setAdding] = useState(false)
  const lines = folio ? items.filter((i) => i.folio_id === folio.id) : []

  async function addCharge(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      await api(`/api/reservations/${r.id}/charge`, { body: charge })
      setCharge({ description: '', category: 'restaurant', quantity: 1, unit_price: '' })
      toast.success('Charge posted to folio')
      router.refresh()
    } catch (err: any) {
      toast.error('Could not add charge', err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Drawer open onClose={onClose} title={`${r.guest.name}`} subtitle={`${r.code} · ${r.room.type} ${r.room.number} · ${prettyDate(r.check_in)} → ${prettyDate(r.check_out)}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status} />{r.is_vip && <Badge color="amber">VIP</Badge>}<Badge>{r.booking_source}</Badge>
          {r.digital_checkin_completed && <Badge color="green">online check-in ✓</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['Phone', r.guest.phone], ['Email', r.guest.email ?? '—'], ['Guests', `${r.adults} adults${r.children ? `, ${r.children} children` : ''}`], ['Balance due', inr(r.balance_due)]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink-900 p-3"><div className="text-[11px] uppercase tracking-wider text-slate-500">{k}</div><div className="mt-0.5 truncate text-slate-200">{v}</div></div>
          ))}
        </div>
        {r.special_requests && <div className="rounded-xl border border-white/[0.06] p-3 text-sm text-slate-300">📝 {r.special_requests}</div>}

        <div className="flex flex-wrap gap-2">
          {r.status === 'confirmed' && r.check_in <= today() && <Button loading={busy === `${r.id}:checkin`} onClick={() => onAct(r, 'checkin')}><LogIn className="h-4 w-4" /> Check in</Button>}
          {r.status === 'checked_in' && <Button loading={busy === `${r.id}:checkout`} onClick={() => onAct(r, 'checkout')}><LogOut className="h-4 w-4" /> Check out & send invoice</Button>}
          {r.status === 'confirmed' && <a href={r.checkin_url} target="_blank" rel="noreferrer"><Button variant="secondary"><ExternalLink className="h-4 w-4" /> Guest check-in page</Button></a>}
          {r.status === 'confirmed' && <Button variant="danger" loading={busy === `${r.id}:cancel`} onClick={() => onAct(r, 'cancel')}><XCircle className="h-4 w-4" /> Cancel</Button>}
          {folio && <a href={`/invoice/${folio.id}`} target="_blank" rel="noreferrer"><Button variant="ghost"><Receipt className="h-4 w-4" /> Invoice</Button></a>}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-medium text-white">Folio</h3>
          {!folio ? <p className="text-sm text-slate-500">Opens at check-in.</p> : (
            <div className="rounded-xl border border-white/[0.07]">
              {lines.map((i) => <div key={i.id} className="flex justify-between border-b border-white/[0.05] px-3.5 py-2.5 text-sm"><span className="text-slate-300">{i.description}<span className="ml-2 text-[11px] text-slate-500">{i.category}</span></span><span className="text-slate-200">{inr(i.total_price)}</span></div>)}
              <div className="flex justify-between px-3.5 py-2 text-sm text-slate-400"><span>Tax</span><span>{inr(folio.tax_total)}</span></div>
              <div className="flex justify-between px-3.5 py-2 font-medium text-white"><span>Total · paid {inr(folio.paid_amount)}</span><span>{inr(folio.grand_total)}</span></div>
            </div>
          )}
          {r.status === 'checked_in' && (
            <form onSubmit={addCharge} className="mt-3 grid grid-cols-[1fr_110px_80px_auto] gap-2">
              <Input required placeholder="Minibar, spa, dinner…" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} />
              <Select value={charge.category} onChange={(e) => setCharge({ ...charge, category: e.target.value })}>{['restaurant', 'minibar', 'laundry', 'spa', 'service'].map((c) => <option key={c}>{c}</option>)}</Select>
              <Input required type="number" min={1} placeholder="₹" value={charge.unit_price} onChange={(e) => setCharge({ ...charge, unit_price: e.target.value })} />
              <Button type="submit" variant="secondary" loading={adding}><Plus className="h-4 w-4" /></Button>
            </form>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium text-white">Automation history</h3>
          {logs.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-2.5 text-sm">
                  {l.app in APPS ? <AppIcon src={APPS[l.app as keyof typeof APPS].icon} name={l.app} size={22} /> : <Badge color="violet">{l.app}</Badge>}
                  <span className="flex-1 truncate text-slate-300">{l.summary}</span>
                  <span className={cn('text-[11px]', l.status === 'success' ? 'text-brand-400' : l.status === 'failed' ? 'text-red-400' : 'text-amber-300')}>{l.status}</span>
                  <span className="w-14 text-right text-[11px] text-slate-500">{timeAgo(l.created_at)}</span>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-slate-500">Events: {Array.from(new Set(logs.map((l) => EVENT_LABELS[l.event_type]))).join(' · ')}</p>
            </div>
          )}
        </section>
      </div>
    </Drawer>
  )
}
