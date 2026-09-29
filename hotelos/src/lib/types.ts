export type AppKey = 'whatsapp' | 'gmail' | 'slack' | 'sheets' | 'gcal'

export type RoomStatus = 'available' | 'occupied' | 'dirty' | 'maintenance'
export type RoomType = 'Standard' | 'Deluxe' | 'Suite' | 'Villa'
export type ReservationStatus = 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

/** One connected app, server-side only. auth_id / script_id never leave the server. */
export interface AppConnection {
  auth_id: string
  script_id?: string
  config: Record<string, unknown>
  connected_at: string
}

/** The record the viaSocket doc asks us to keep for every trigger subscription. */
export interface TriggerSubscription {
  key: 'wa_inbound'
  unique_identifier: string
  service_id: string
  trigger_version_id: string
  script_id: string
  auth_id: string
  inputData: Record<string, unknown>
  delivery: { code: string }
  status: 'active' | 'paused'
  created_at: string
}

/** A flow the hotel built in the prebuilt UI (Automation Studio). webhookurl is a credential. */
export interface CustomFlow {
  id: string
  title: string
  description?: string
  status: 'drafted' | 'active' | 'paused' | 'deleted'
  webhookurl?: string
  payload?: unknown
  serviceIcons?: string[]
  events: HotelEvent[]
  updated_at: string
}

export type HotelEvent =
  | 'new_booking'
  | 'pre_arrival'
  | 'checkin'
  | 'checkout'
  | 'housekeeping_created'
  | 'maintenance'
  | 'guest_message'
  | 'payment_failed'
  | 'payment_success'
  | 'vip_arrival'
  | 'daily_report'
  | 'guest_signup'

export interface Hotel {
  id: string
  name: string
  tagline: string
  address: string
  city: string
  phone: string
  email: string
  google_review_url: string
  tax_rate: number
  integrations: Partial<Record<AppKey, AppConnection>>
  subscriptions: TriggerSubscription[]
  custom_flows: CustomFlow[]
  automation_toggles: Record<string, boolean>
  created_at: string
}

export interface Room {
  id: string
  hotel_id: string
  number: string
  type: RoomType
  floor: number
  max_occupancy: number
  rate_per_night: number
  status: RoomStatus
  amenities: string[]
  description: string
  created_at: string
}

export interface Guest {
  id: string
  hotel_id: string
  name: string
  email?: string
  phone: string
  nationality?: string
  date_of_birth?: string
  address?: string
  id_type?: 'aadhaar' | 'passport' | 'driving_licence'
  id_number?: string
  id_verified: boolean
  id_document_url?: string
  photo_url?: string
  signature_url?: string
  tags: string[]
  total_stays: number
  total_spend: number
  notes?: string
  /** Website account (guest signup). scrypt "salt:hash"; never sent to the browser. */
  password_hash?: string
  signed_up_at?: string
  marketing_opt_in?: boolean
  created_at: string
}

export interface Reservation {
  id: string
  code: string
  hotel_id: string
  guest_id: string
  room_id: string
  check_in: string
  check_out: string
  adults: number
  children: number
  status: ReservationStatus
  is_vip: boolean
  booking_source: 'direct' | 'ota' | 'walkin' | 'phone' | 'online'
  special_requests?: string
  rate_per_night: number
  total_nights: number
  room_total: number
  extras_total: number
  tax_amount: number
  grand_total: number
  deposit_paid: number
  balance_due: number
  checkin_link_token: string
  digital_checkin_completed: boolean
  digital_checkin_at?: string
  checked_in_at?: string
  checked_out_at?: string
  created_at: string
}

export interface Folio {
  id: string
  reservation_id: string
  guest_id: string
  hotel_id: string
  status: 'open' | 'closed' | 'paid'
  subtotal: number
  tax_total: number
  grand_total: number
  paid_amount: number
  balance: number
  created_at: string
}

export interface FolioItem {
  id: string
  folio_id: string
  description: string
  category: 'room' | 'restaurant' | 'laundry' | 'minibar' | 'spa' | 'service' | 'tax' | 'discount'
  quantity: number
  unit_price: number
  total_price: number
  date: string
  created_by: 'system' | 'staff' | 'guest'
  created_at: string
}

export interface HousekeepingTask {
  id: string
  hotel_id: string
  room_id: string
  reservation_id?: string
  type: 'cleaning' | 'turndown' | 'inspection' | 'special'
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  priority: Priority
  notes?: string
  assigned_to?: string
  completed_at?: string
  created_at: string
}

export interface MaintenanceRequest {
  id: string
  hotel_id: string
  room_id?: string
  reservation_id?: string
  reported_by: string
  issue: string
  category: 'electrical' | 'plumbing' | 'hvac' | 'furniture' | 'other'
  priority: Priority
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  resolution_notes?: string
  resolved_at?: string
  created_at: string
}

export interface GuestRequest {
  id: string
  reservation_id?: string
  hotel_id: string
  from: string
  guest_name?: string
  via: 'whatsapp'
  message: string
  category: 'room_service' | 'housekeeping' | 'maintenance' | 'info' | 'other' | 'unknown_guest'
  status: 'pending' | 'acknowledged' | 'resolved'
  response?: string
  simulated?: boolean
  created_at: string
}

export interface AutomationLog {
  id: string
  hotel_id: string
  reservation_id?: string
  event_type: HotelEvent | 'test'
  app: AppKey | 'custom' | 'system'
  status: 'success' | 'failed' | 'skipped'
  summary: string
  details?: unknown
  sample?: boolean
  created_at: string
}

export interface DB {
  version: number
  hotels: Hotel[]
  rooms: Room[]
  guests: Guest[]
  reservations: Reservation[]
  folios: Folio[]
  folio_items: FolioItem[]
  housekeeping_tasks: HousekeepingTask[]
  maintenance_requests: MaintenanceRequest[]
  guest_requests: GuestRequest[]
  automation_logs: AutomationLog[]
}

/** A reservation joined with what every screen and automation needs. */
export interface ReservationView extends Reservation {
  guest: Guest
  room: Room
}
