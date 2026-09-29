import { currentHotel } from '@/lib/auth'
import { publicIntegrations } from '@/lib/viasocket/view'
import ConnectionsBoard from './ConnectionsBoard'

export const metadata = { title: 'App connections' }

export default function SettingsPage() {
  const hotel = currentHotel()!
  return <ConnectionsBoard initial={publicIntegrations(hotel)} />
}
