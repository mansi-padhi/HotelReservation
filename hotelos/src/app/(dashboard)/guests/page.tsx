import { Crown, ShieldCheck, Users } from 'lucide-react'
import Link from 'next/link'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import { inr, initials, prettyDate } from '@/lib/utils'

export const metadata = { title: 'Guests' }

export default function GuestsPage({ searchParams }: { searchParams: { q?: string } }) {
  const hotel = currentHotel()!
  const d = db()
  const q = (searchParams.q ?? '').toLowerCase()
  const guests = d.guests
    .filter((g) => g.hotel_id === hotel.id)
    .filter((g) => !q || `${g.name} ${g.phone} ${g.email}`.toLowerCase().includes(q))
    .map((g) => {
      const res = d.reservations.filter((r) => r.guest_id === g.id).sort((a, b) => (a.check_in < b.check_in ? 1 : -1))
      return { ...g, last: res[0], inHouse: res.some((r) => r.status === 'checked_in') }
    })
    .sort((a, b) => Number(b.inHouse) - Number(a.inHouse) || (b.last?.check_in ?? '').localeCompare(a.last?.check_in ?? ''))

  return (
    <div>
      <PageHeader title="Guests" subtitle="Profiles build themselves from bookings and the digital check-in (ID, photo, signature)." />
      <form className="mb-4"><input name="q" defaultValue={searchParams.q} placeholder="Search name, phone, email…" className="input max-w-sm" /></form>
      <Card className="overflow-hidden p-0">
        {guests.length === 0 ? <EmptyState icon={Users} title="No guests found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Guest', 'Contact', 'Stays', 'Lifetime spend', 'Last stay', 'ID', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-t border-white/[0.05] hover:bg-white/[0.015]">
                    <td className="px-4 py-3">
                      <Link href={`/guests/${g.id}`} className="flex items-center gap-3">
                        {g.photo_url ? <img src={g.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400/30 to-sky-400/20 text-xs font-semibold text-white">{initials(g.name)}</span>}
                        <div><div className="flex items-center gap-1.5 font-medium text-slate-100">{g.name}{g.tags.includes('vip') && <Crown className="h-3.5 w-3.5 text-amber-300" />}</div><div className="text-xs text-slate-500">{g.nationality ?? '—'}</div></div>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><div className="text-slate-300">{g.phone}</div><div className="text-xs text-slate-500">{g.email ?? '—'}</div></td>
                    <td className="px-4 py-3 text-slate-300">{g.total_stays}</td>
                    <td className="px-4 py-3 text-slate-300">{inr(g.total_spend)}</td>
                    <td className="px-4 py-3 text-slate-400">{g.inHouse ? <Badge color="green">in-house</Badge> : g.last ? prettyDate(g.last.check_in) : '—'}</td>
                    <td className="px-4 py-3">{g.id_verified ? <ShieldCheck className="h-4 w-4 text-brand-400" /> : g.id_document_url ? <Badge color="amber">review</Badge> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-3"><div className="flex gap-1">{g.tags.filter((t) => t !== 'vip').map((t) => <Badge key={t} color="violet">{t}</Badge>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
