'use client'
import { Plus, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card, Drawer, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui'
import { api } from '@/lib/client-api'
import type { Room, RoomStatus, RoomType } from '@/lib/types'
import { cn, inr, prettyDate } from '@/lib/utils'

const AMENITIES = ['Wi-Fi', 'AC', 'Smart TV', 'Minibar', 'Balcony', 'Bathtub', 'Rain shower', 'Lounge', 'Sea view', 'Private pool', 'Kitchenette', 'Butler']
const STATUS: Record<RoomStatus, { label: string; dot: string; ring: string }> = {
  available: { label: 'Available', dot: 'bg-brand-400', ring: 'hover:ring-brand-400/30' },
  occupied: { label: 'Occupied', dot: 'bg-sky-400', ring: 'hover:ring-sky-400/30' },
  dirty: { label: 'Dirty', dot: 'bg-amber-400', ring: 'hover:ring-amber-400/30' },
  maintenance: { label: 'Maintenance', dot: 'bg-red-400', ring: 'hover:ring-red-400/30' },
}

export default function RoomsView({ rooms, guestIn }: { rooms: Room[]; guestIn: Record<string, { name: string; out: string }> }) {
  const router = useRouter()
  const toast = useToast()
  const [filter, setFilter] = useState<RoomStatus | 'all'>('all')
  const [editing, setEditing] = useState<Room | null>(null)
  const [adding, setAdding] = useState(false)
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort()

  async function setStatus(room: Room, status: RoomStatus) {
    try {
      await api(`/api/rooms/${room.id}`, { method: 'PATCH', body: { status } })
      toast.success(`Room ${room.number} → ${status}`)
      router.refresh()
    } catch (e: any) {
      toast.error('Could not update', e.message)
    }
  }

  return (
    <div>
      <PageHeader title="Rooms" subtitle="Live room status. Checkouts flip rooms to dirty automatically; completing the cleaning task makes them available again." actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add room</Button>} />
      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={cn('chip py-1', filter === 'all' && 'border-white/25 bg-white/10 text-white')}>All <b className="ml-1 text-white">{rooms.length}</b></button>
        {(Object.keys(STATUS) as RoomStatus[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn('chip py-1', filter === s && 'border-white/25 bg-white/10 text-white')}>
            <span className={cn('h-2 w-2 rounded-full', STATUS[s].dot)} /> {STATUS[s].label} <b className="ml-1 text-white">{rooms.filter((r) => r.status === s).length}</b>
          </button>
        ))}
      </div>
      <div className="space-y-8">
        {floors.map((floor) => {
          const list = rooms.filter((r) => r.floor === floor && (filter === 'all' || r.status === filter))
          if (!list.length) return null
          return (
            <section key={floor}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Floor {floor}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {list.map((r) => (
                  <Card key={r.id} className={cn('group cursor-pointer p-4 ring-1 ring-transparent transition', STATUS[r.status].ring)} onClick={() => setEditing(r)}>
                    <div className="flex items-start justify-between">
                      <div className="text-3xl font-semibold tracking-tight text-white">{r.number}</div>
                      <span className={cn('mt-2 h-2.5 w-2.5 rounded-full', STATUS[r.status].dot)} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400"><Badge>{r.type}</Badge><span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{r.max_occupancy}</span></div>
                    <div className="mt-3 text-sm text-slate-200">{inr(r.rate_per_night)}<span className="text-xs text-slate-500"> /night</span></div>
                    <div className="mt-1 h-4 truncate text-[11px] text-slate-500">{guestIn[r.id] ? `${guestIn[r.id]!.name} · out ${prettyDate(guestIn[r.id]!.out)}` : r.amenities.slice(0, 3).join(' · ')}</div>
                    <Select className="mt-3 py-1.5 text-xs" value={r.status} onClick={(e) => e.stopPropagation()} onChange={(e) => setStatus(r, e.target.value as RoomStatus)}>
                      {(Object.keys(STATUS) as RoomStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                    </Select>
                  </Card>
                ))}
              </div>
            </section>
          )
        })}
      </div>
      <RoomForm key={editing?.id ?? 'new'} room={editing} open={adding || !!editing} onClose={() => { setAdding(false); setEditing(null) }} onSaved={() => router.refresh()} />
    </div>
  )
}

function RoomForm({ room, open, onClose, onSaved }: { room: Room | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ number: room?.number ?? '', type: room?.type ?? ('Standard' as RoomType), floor: room?.floor ?? 1, max_occupancy: room?.max_occupancy ?? 2, rate_per_night: room?.rate_per_night ?? 3800, amenities: room?.amenities ?? ['Wi-Fi', 'AC'], description: room?.description ?? '' })
  const [saving, setSaving] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api(room ? `/api/rooms/${room.id}` : '/api/rooms', { method: room ? 'PATCH' : 'POST', body: f })
      toast.success(room ? `Room ${f.number} updated` : `Room ${f.number} added`)
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error('Could not save room', err.message)
    } finally {
      setSaving(false)
    }
  }
  const body = (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Room number"><Input required value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as RoomType })}>{['Standard', 'Deluxe', 'Suite', 'Villa'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Floor"><Input type="number" value={f.floor} onChange={(e) => setF({ ...f, floor: Number(e.target.value) })} /></Field>
        <Field label="Max occupancy"><Input type="number" min={1} value={f.max_occupancy} onChange={(e) => setF({ ...f, max_occupancy: Number(e.target.value) })} /></Field>
        <Field label="Rate per night (₹)" className="col-span-2"><Input type="number" min={1} value={f.rate_per_night} onChange={(e) => setF({ ...f, rate_per_night: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Amenities">
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map((a) => {
            const on = f.amenities.includes(a)
            return <button type="button" key={a} onClick={() => setF({ ...f, amenities: on ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })} className={cn('rounded-full px-3 py-1 text-xs ring-1 ring-inset transition', on ? 'bg-brand-400/15 text-brand-300 ring-brand-400/30' : 'text-slate-400 ring-white/10 hover:text-white')}>{a}</button>
          })}
        </div>
      </Field>
      <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Button type="submit" className="w-full" loading={saving}>{room ? 'Save changes' : 'Add room'}</Button>
    </form>
  )
  return room ? <Drawer open={open} onClose={onClose} title={`Room ${room.number}`} subtitle={`${room.type} · floor ${room.floor}`}>{body}</Drawer> : <Modal open={open} onClose={onClose} title="Add room">{body}</Modal>
}
