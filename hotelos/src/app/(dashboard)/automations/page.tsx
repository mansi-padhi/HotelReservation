import { currentHotel } from '@/lib/auth'
import { db } from '@/lib/db'
import { publicIntegrations } from '@/lib/viasocket/view'
import AutomationsView from './AutomationsView'

export const metadata = { title: 'Automations' }

export default function AutomationsPage() {
  const hotel = currentHotel()!
  // Seeded "sample" entries are demo filler, not runs — the page shows only what really happened.
  const logs = db().automation_logs.filter((l) => l.hotel_id === hotel.id && !l.sample).slice(0, 400)
  const codes = Object.fromEntries(db().reservations.filter((r) => r.hotel_id === hotel.id).map((r) => [r.id, r.code]))
  const view = publicIntegrations(hotel)
  const ready = Object.fromEntries(Object.entries(view.apps).map(([k, v]) => [k, v.ready]))
  const connected = Object.fromEntries(Object.entries(view.apps).map(([k, v]) => [k, v.connected]))
  const studio = view.studioFlows.filter((f) => f.status === 'active').map((f) => ({ title: f.title, events: f.events }))
  return (
    <AutomationsView
      logs={logs.map((l) => ({ ...l, code: l.reservation_id ? codes[l.reservation_id] : undefined }))}
      toggles={hotel.automation_toggles}
      ready={ready}
      connected={connected}
      configured={view.configured}
      studio={studio}
    />
  )
}
