import type { AutomationLog, DB, Folio, FolioItem, Guest, Hotel, Reservation, Room, RoomType } from './types'
import { addDays, nightsBetween, today, uid } from './utils'

export const DEMO_HOTEL_ID = 'htl_hotelator_goa'

// Deterministic PRNG so every fresh demo looks the same.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const ROOM_TYPES: Record<RoomType, { rate: number; occ: number; amenities: string[]; description: string }> = {
  Standard: { rate: 3800, occ: 2, amenities: ['Wi-Fi', 'AC', 'Smart TV', 'Rain shower'], description: 'Calm, bright room with a garden view and queen bed.' },
  Deluxe: { rate: 5900, occ: 3, amenities: ['Wi-Fi', 'AC', 'Smart TV', 'Minibar', 'Balcony'], description: 'Larger room with a private balcony facing the pool.' },
  Suite: { rate: 9800, occ: 4, amenities: ['Wi-Fi', 'AC', 'Smart TV', 'Minibar', 'Bathtub', 'Lounge'], description: 'Separate living area, soaking tub and sea glimpses.' },
  Villa: { rate: 18500, occ: 6, amenities: ['Wi-Fi', 'AC', 'Private pool', 'Kitchenette', 'Butler', 'Sea view'], description: 'Standalone villa with a plunge pool and butler service.' },
}

const GUESTS: Array<[string, string, string, string, string[]]> = [
  ['Aarav Mehta', '+91 98200 11234', 'aarav.mehta@example.com', 'Indian', ['loyalty']],
  ['Priya Nair', '+91 98450 22871', 'priya.nair@example.com', 'Indian', ['corporate']],
  ['Rohan Kapoor', '+91 99300 45120', 'rohan.k@example.com', 'Indian', ['vip']],
  ['Sofia Martínez', '+34 612 345 678', 'sofia.m@example.com', 'Spanish', []],
  ['Daniel Okafor', '+234 803 555 0192', 'd.okafor@example.com', 'Nigerian', ['corporate']],
  ['Ananya Iyer', '+91 97400 66310', 'ananya.iyer@example.com', 'Indian', []],
  ['Liam Chen', '+65 9123 4567', 'liam.chen@example.com', 'Singaporean', ['loyalty']],
  ['Meera Joshi', '+91 98110 78455', 'meera.joshi@example.com', 'Indian', ['vip', 'loyalty']],
  ['Kabir Singh', '+91 99100 34567', 'kabir.singh@example.com', 'Indian', []],
  ['Emma Laurent', '+33 6 12 34 56 78', 'emma.laurent@example.com', 'French', []],
  ['Tadesse Bekele', '+251 91 123 4567', 'tadesse.b@example.com', 'Ethiopian', []],
  ['Isha Reddy', '+91 90000 81234', 'isha.reddy@example.com', 'Indian', ['corporate']],
  ['Arjun Das', '+91 98300 55112', 'arjun.das@example.com', 'Indian', []],
  ['Hannah Schmidt', '+49 151 2345 6789', 'hannah.s@example.com', 'German', ['loyalty']],
  ['Vikram Rao', '+91 98860 99001', 'vikram.rao@example.com', 'Indian', ['vip']],
  ['Zara Khan', '+91 98190 44556', 'zara.khan@example.com', 'Indian', []],
  ['Noah Williams', '+1 415 555 0134', 'noah.w@example.com', 'American', []],
  ['Kavya Menon', '+91 94470 12093', 'kavya.menon@example.com', 'Indian', []],
]

const SOURCES: Reservation['booking_source'][] = ['direct', 'ota', 'online', 'phone', 'walkin']

export function seed(): DB {
  const r = rng(42)
  const now = new Date().toISOString()
  const t = today()
  const hotelId = DEMO_HOTEL_ID

  const hotel: Hotel = {
    id: hotelId,
    name: 'Hotelator Grand Goa',
    tagline: 'A boutique beach hotel, run on autopilot.',
    address: 'Candolim Beach Road, Bardez, Goa 403515',
    city: 'Goa',
    phone: '+91 832 555 0100',
    email: 'frontdesk@hotelator.com',
    google_review_url: 'https://g.page/r/hotelator-grand-goa/review',
    tax_rate: 0.12,
    integrations: {},
    subscriptions: [],
    custom_flows: [],
    automation_toggles: {},
    created_at: now,
  }

  // 24 rooms over 4 floors
  const rooms: Room[] = []
  const layout: Array<[number, RoomType[]]> = [
    [1, ['Standard', 'Standard', 'Standard', 'Standard', 'Deluxe', 'Deluxe', 'Deluxe']],
    [2, ['Standard', 'Standard', 'Standard', 'Deluxe', 'Deluxe', 'Deluxe', 'Suite']],
    [3, ['Deluxe', 'Deluxe', 'Deluxe', 'Suite', 'Suite', 'Suite']],
    [4, ['Villa', 'Villa', 'Villa', 'Villa']],
  ]
  for (const [floor, types] of layout) {
    types.forEach((type, i) => {
      const spec = ROOM_TYPES[type]
      rooms.push({
        id: uid('room'),
        hotel_id: hotelId,
        number: `${floor}${String(i + 1).padStart(2, '0')}`,
        type,
        floor,
        max_occupancy: spec.occ,
        rate_per_night: spec.rate,
        status: 'available',
        amenities: spec.amenities,
        description: spec.description,
        created_at: now,
      })
    })
  }

  const guests: Guest[] = GUESTS.map(([name, phone, email, nationality, tags], i) => ({
    id: uid('gst'),
    hotel_id: hotelId,
    name,
    phone,
    email,
    nationality,
    tags,
    id_verified: i % 3 === 0,
    id_type: i % 3 === 0 ? (nationality === 'Indian' ? 'aadhaar' : 'passport') : undefined,
    total_stays: 0,
    total_spend: 0,
    created_at: now,
  }))

  const reservations: Reservation[] = []
  const folios: Folio[] = []
  const folioItems: FolioItem[] = []
  const busy = new Map<string, Array<[string, string]>>()
  const free = (roomId: string, a: string, b: string) =>
    !(busy.get(roomId) ?? []).some(([x, y]) => a < y && x < b)

  const makeRes = (offsetIn: number, nights: number, gi: number, preferred?: RoomType) => {
    const checkIn = addDays(t, offsetIn)
    const checkOut = addDays(checkIn, nights)
    const pool = rooms.filter((rm) => (!preferred || rm.type === preferred) && free(rm.id, checkIn, checkOut))
    const room = pool[Math.floor(r() * pool.length)] ?? rooms.find((rm) => free(rm.id, checkIn, checkOut))
    if (!room) return
    busy.set(room.id, [...(busy.get(room.id) ?? []), [checkIn, checkOut]])
    const guest = guests[gi % guests.length]!
    const n = nightsBetween(checkIn, checkOut)
    const roomTotal = n * room.rate_per_night
    const tax = Math.round(roomTotal * hotel.tax_rate)
    const grand = roomTotal + tax
    let status: Reservation['status'] = 'confirmed'
    if (checkOut < t || (checkOut === t && r() < 0.5)) status = 'checked_out'
    else if (checkIn <= t) status = 'checked_in'
    if (status === 'confirmed' && r() < 0.06) status = 'cancelled'
    const deposit = status === 'checked_out' ? grand : status === 'checked_in' ? Math.round(grand * 0.5) : r() < 0.4 ? Math.round(grand * 0.3) : 0
    const res: Reservation = {
      id: uid('res'),
      code: `HT${String(1040 + reservations.length)}`,
      hotel_id: hotelId,
      guest_id: guest.id,
      room_id: room.id,
      check_in: checkIn,
      check_out: checkOut,
      adults: 1 + Math.floor(r() * Math.min(2, room.max_occupancy)),
      children: r() < 0.25 ? 1 : 0,
      status,
      is_vip: guest.tags.includes('vip'),
      booking_source: SOURCES[Math.floor(r() * SOURCES.length)]!,
      special_requests: r() < 0.3 ? ['Late check-in around 11pm', 'Extra pillows please', 'Airport pickup needed', 'Anniversary — flowers if possible'][Math.floor(r() * 4)] : undefined,
      rate_per_night: room.rate_per_night,
      total_nights: n,
      room_total: roomTotal,
      extras_total: 0,
      tax_amount: tax,
      grand_total: grand,
      deposit_paid: deposit,
      balance_due: grand - deposit,
      checkin_link_token: uid().replace(/-/g, ''),
      digital_checkin_completed: status === 'checked_in' || status === 'checked_out',
      digital_checkin_at: status === 'checked_in' || status === 'checked_out' ? `${checkIn}T10:30:00.000Z` : undefined,
      checked_in_at: status === 'checked_in' || status === 'checked_out' ? `${checkIn}T09:00:00.000Z` : undefined,
      checked_out_at: status === 'checked_out' ? `${checkOut}T06:00:00.000Z` : undefined,
      created_at: `${addDays(checkIn, -7 - Math.floor(r() * 14))}T08:00:00.000Z`,
    }
    reservations.push(res)

    if (status === 'checked_in' || status === 'checked_out') {
      const folioId = uid('fol')
      const items: FolioItem[] = [
        { id: uid('fit'), folio_id: folioId, description: `Room ${room.number} × ${n} night${n > 1 ? 's' : ''}`, category: 'room', quantity: n, unit_price: room.rate_per_night, total_price: roomTotal, date: checkIn, created_by: 'system', created_at: now },
      ]
      if (r() < 0.6) items.push({ id: uid('fit'), folio_id: folioId, description: 'In-room dining — dinner', category: 'restaurant', quantity: 1, unit_price: 1450, total_price: 1450, date: checkIn, created_by: 'staff', created_at: now })
      if (r() < 0.35) items.push({ id: uid('fit'), folio_id: folioId, description: 'Laundry — express', category: 'laundry', quantity: 1, unit_price: 600, total_price: 600, date: checkIn, created_by: 'staff', created_at: now })
      const subtotal = items.reduce((s, it) => s + it.total_price, 0)
      const taxTotal = Math.round(subtotal * hotel.tax_rate)
      res.extras_total = subtotal - roomTotal
      res.tax_amount = taxTotal
      res.grand_total = subtotal + taxTotal
      res.deposit_paid = status === 'checked_out' ? res.grand_total : Math.round(res.grand_total * 0.5)
      res.balance_due = res.grand_total - res.deposit_paid
      folios.push({ id: folioId, reservation_id: res.id, guest_id: guest.id, hotel_id: hotelId, status: status === 'checked_out' ? 'paid' : 'open', subtotal, tax_total: taxTotal, grand_total: res.grand_total, paid_amount: res.deposit_paid, balance: res.balance_due, created_at: now })
      folioItems.push(...items)
    }
    if (status === 'checked_out') {
      guest.total_stays += 1
      guest.total_spend += res.grand_total
    }
  }

  // Past stays, in-house guests, today's arrivals/departures, upcoming bookings
  let gi = 0
  for (let d = -12; d <= -3; d++) makeRes(d, 2 + Math.floor(r() * 3), gi++)
  for (let k = 0; k < 9; k++) makeRes(-1 - Math.floor(r() * 3), 3 + Math.floor(r() * 3), gi++)
  makeRes(-2, 2, 7, 'Suite') // departs today
  makeRes(-3, 3, 4)
  for (let k = 0; k < 4; k++) makeRes(0, 2 + Math.floor(r() * 3), gi++) // arrivals today
  makeRes(0, 3, 2, 'Villa') // VIP arriving today
  makeRes(3, 4, 14, 'Villa') // VIP in 3 days → pre-arrival
  makeRes(3, 2, 5)
  for (let d = 1; d <= 16; d++) if (r() < 0.75) makeRes(d, 2 + Math.floor(r() * 4), gi++)

  // Room statuses follow the reservations
  for (const res of reservations) {
    const room = rooms.find((rm) => rm.id === res.room_id)!
    if (res.status === 'checked_in') room.status = 'occupied'
    if (res.status === 'checked_out' && res.check_out >= addDays(t, -1) && room.status === 'available') room.status = 'dirty'
  }
  const spare = rooms.filter((rm) => rm.status === 'available')
  if (spare[2]) spare[2].status = 'maintenance'

  const roomByNo = (i: number) => rooms[i % rooms.length]!
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

  const dirtyRooms = rooms.filter((rm) => rm.status === 'dirty')
  const housekeeping = [
    ...dirtyRooms.map((rm, i) => ({
      id: uid('hk'), hotel_id: hotelId, room_id: rm.id, type: 'cleaning' as const, status: (i === 0 ? 'in_progress' : 'pending') as 'in_progress' | 'pending',
      priority: (i === 0 ? 'high' : 'normal') as 'high' | 'normal', notes: 'Post-checkout clean', assigned_to: i === 0 ? 'Rekha' : undefined, created_at: hoursAgo(2 + i),
    })),
    { id: uid('hk'), hotel_id: hotelId, room_id: roomByNo(3).id, type: 'turndown' as const, status: 'pending' as const, priority: 'normal' as const, notes: 'Evening turndown + chocolates', assigned_to: 'Sunil', created_at: hoursAgo(1) },
    { id: uid('hk'), hotel_id: hotelId, room_id: roomByNo(9).id, type: 'inspection' as const, status: 'completed' as const, priority: 'low' as const, notes: 'Weekly inspection', assigned_to: 'Rekha', completed_at: hoursAgo(3), created_at: hoursAgo(6) },
    { id: uid('hk'), hotel_id: hotelId, room_id: roomByNo(12).id, type: 'special' as const, status: 'completed' as const, priority: 'normal' as const, notes: 'Two extra towels (WhatsApp)', assigned_to: 'Sunil', completed_at: hoursAgo(4), created_at: hoursAgo(5) },
  ]

  const maintRoom = rooms.find((rm) => rm.status === 'maintenance')
  const maintenance = [
    { id: uid('mnt'), hotel_id: hotelId, room_id: maintRoom?.id, reported_by: 'staff', issue: 'Bathroom drain blocked, water pooling', category: 'plumbing' as const, priority: 'high' as const, status: 'in_progress' as const, created_at: hoursAgo(20) },
    { id: uid('mnt'), hotel_id: hotelId, room_id: roomByNo(5).id, reported_by: 'guest', issue: 'AC is not cooling below 26°C', category: 'hvac' as const, priority: 'normal' as const, status: 'open' as const, created_at: hoursAgo(3) },
    { id: uid('mnt'), hotel_id: hotelId, room_id: roomByNo(15).id, reported_by: 'staff', issue: 'Bedside lamp flickering', category: 'electrical' as const, priority: 'low' as const, status: 'resolved' as const, resolution_notes: 'Bulb replaced', resolved_at: hoursAgo(26), created_at: hoursAgo(30) },
  ]

  const inHouse = reservations.filter((x) => x.status === 'checked_in')
  const g = (res: Reservation) => guests.find((x) => x.id === res.guest_id)!
  const guestRequests = inHouse.slice(0, 3).map((res, i) => ({
    id: uid('greq'), hotel_id: hotelId, reservation_id: res.id, from: g(res).phone, guest_name: g(res).name, via: 'whatsapp' as const,
    message: ['Can I get two extra towels please?', 'The wifi is not working in my room', 'What time is breakfast served?'][i]!,
    category: (['housekeeping', 'maintenance', 'info'] as const)[i]!,
    status: 'acknowledged' as const,
    response: ['Got it! 🧹 Housekeeping is on the way.', "We've logged it 🔧 — our team will be there shortly.", 'Breakfast is served 7:00–10:30 at the Palm Café. ☕'][i],
    simulated: true,
    created_at: hoursAgo(5 - i),
  }))

  const sampleLogs: AutomationLog[] = [
    ['new_booking', 'whatsapp', 'Booking confirmation sent to guest'],
    ['new_booking', 'gmail', 'Confirmation email with check-in link'],
    ['new_booking', 'gcal', 'Arrival added to front-desk calendar'],
    ['new_booking', 'sheets', 'Booking row appended'],
    ['checkin', 'slack', 'Staff alert: guest checked in'],
    ['checkin', 'whatsapp', 'Welcome message with room number'],
    ['guest_message', 'whatsapp', 'Housekeeping request auto-routed'],
    ['checkout', 'whatsapp', 'Invoice + review request sent'],
    ['housekeeping_created', 'slack', 'Room needs cleaning alert'],
    ['daily_report', 'slack', 'Daily occupancy report posted'],
  ].map(([event, app, summary], i) => ({
    id: uid('log'), hotel_id: hotelId, event_type: event as AutomationLog['event_type'], app: app as AutomationLog['app'],
    status: 'success' as const, summary, sample: true, details: { note: 'Sample entry from seed data — connect the app to see real runs.' },
    created_at: hoursAgo(30 - i * 2.5),
  }))

  return {
    version: 1,
    hotels: [hotel],
    rooms,
    guests,
    reservations,
    folios,
    folio_items: folioItems,
    housekeeping_tasks: housekeeping,
    maintenance_requests: maintenance,
    guest_requests: guestRequests,
    automation_logs: sampleLogs,
  }
}
