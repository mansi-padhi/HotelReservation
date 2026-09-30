import type { AppKey, HotelEvent } from '../types'

/**
 * The built-in automations, described step by step exactly as src/lib/automations/index.ts runs them.
 * Client-safe metadata; keep it in sync when a step is added or removed there.
 */
export interface AutomationStep {
  /** A viaSocket app, or 'system' for work Hotelator does itself (no connection needed). */
  app: AppKey | 'system'
  what: string
  /** Only runs when this holds (shown as a note). */
  when?: string
}

export interface AutomationTemplate {
  key: HotelEvent
  name: string
  trigger: string
  steps: AutomationStep[]
  icon: string
  /** How to set it off from the product, for testing. */
  tryIt: { label: string; href?: string; run?: 'pre-arrival' | 'daily-report' }
}

export const TEMPLATES: AutomationTemplate[] = [
  {
    key: 'new_booking', name: 'Booking confirmation', icon: 'CalendarPlus',
    trigger: 'A reservation is created — by staff or on the website',
    steps: [
      { app: 'gmail', what: 'Confirmation email with the online check-in link', when: 'guest has an email' },
      { app: 'gcal', what: 'Arrival event on the check-in day at 14:00' },
      { app: 'sheets', what: 'Booking row in the ledger' },
      { app: 'whatsapp', what: 'Confirmation message with the check-in link' },
    ],
    tryIt: { label: 'New reservation', href: '/reservations?new=1' },
  },
  {
    key: 'vip_arrival', name: 'VIP preparation', icon: 'Crown',
    trigger: 'A reservation is created with VIP on',
    steps: [
      { app: 'gcal', what: 'VIP prep reminder on the arrival day at 12:00' },
      { app: 'slack', what: 'VIP alert with a preparation checklist' },
    ],
    tryIt: { label: 'New VIP reservation', href: '/reservations?new=1' },
  },
  {
    key: 'guest_signup', name: 'Welcome new member', icon: 'UserPlus',
    trigger: 'A guest creates an account on the website',
    steps: [
      { app: 'gmail', what: 'Welcome email with member perks' },
      { app: 'sheets', what: 'Member row in the ledger' },
      { app: 'whatsapp', what: 'Welcome message' },
      { app: 'slack', what: 'New-member alert for the team' },
    ],
    tryIt: { label: 'Open signup page', href: '/signup' },
  },
  {
    key: 'checkin', name: 'Check-in confirmation', icon: 'DoorOpen',
    trigger: 'Guest finishes online check-in on arrival day, or staff click Check in',
    steps: [
      { app: 'system', what: 'Room → occupied, folio opened' },
      { app: 'gmail', what: 'Check-in email with room number, dates, Wi-Fi and balance', when: 'guest has an email' },
      { app: 'whatsapp', what: 'Welcome message with room number' },
      { app: 'slack', what: 'Staff alert: guest checked in' },
    ],
    tryIt: { label: 'Check in a guest', href: '/reservations' },
  },
  {
    key: 'checkout', name: 'Invoice & review request', icon: 'Receipt',
    trigger: 'Staff check a guest out',
    steps: [
      { app: 'system', what: 'Folio settled and closed, invoice page created' },
      { app: 'gmail', what: 'Invoice email with a review link', when: 'guest has an email' },
      { app: 'sheets', what: 'Checkout row in the ledger' },
      { app: 'whatsapp', what: 'Thank-you with invoice and review link' },
    ],
    tryIt: { label: 'Check out a guest', href: '/reservations' },
  },
  {
    key: 'housekeeping_created', name: 'Turnover cleaning', icon: 'SprayCan',
    trigger: 'Staff check a guest out',
    steps: [
      { app: 'system', what: 'Room → dirty, cleaning task on the housekeeping board' },
      { app: 'slack', what: 'Alert: room needs cleaning' },
    ],
    tryIt: { label: 'Check out a guest', href: '/reservations' },
  },
  {
    key: 'guest_message', name: 'WhatsApp request bot', icon: 'MessageCircle',
    trigger: 'An in-house guest sends a WhatsApp message',
    steps: [
      { app: 'system', what: 'Sorted: towels → housekeeping task, “AC broken” → maintenance ticket' },
      { app: 'whatsapp', what: 'Auto-reply to the guest' },
      { app: 'slack', what: 'Request relayed to the team' },
    ],
    tryIt: { label: 'Simulate a message', href: '/inbox' },
  },
  {
    key: 'maintenance', name: 'Maintenance alert', icon: 'Wrench',
    trigger: 'A maintenance issue is reported (by staff or by WhatsApp)',
    steps: [{ app: 'slack', what: 'Alert with room, issue and priority' }],
    tryIt: { label: 'Report an issue', href: '/maintenance' },
  },
  {
    key: 'payment_failed', name: 'Payment recovery', icon: 'CreditCard',
    trigger: 'A guest payment is declined during online check-in',
    steps: [
      { app: 'whatsapp', what: 'Retry link sent to the guest' },
      { app: 'slack', what: 'Finance alert' },
    ],
    tryIt: { label: 'Use “Simulate decline” on a check-in page' },
  },
  {
    key: 'employee_checkin', name: 'Staff attendance → Keka', icon: 'BadgeCheck',
    trigger: 'An employee clocks in on the Staff page',
    steps: [
      { app: 'system', what: 'Shift started, employee shown as on duty' },
      { app: 'keka', what: 'Attendance entry: clock-in now, clock-out at planned shift end' },
    ],
    tryIt: { label: 'Clock someone in', href: '/staff' },
  },
  {
    key: 'employee_checkout', name: 'Staff clock-out → Keka', icon: 'LogOut',
    trigger: 'An employee clocks out on the Staff page',
    steps: [
      { app: 'system', what: 'Shift closed with the real hours worked' },
      { app: 'keka', what: 'Same day’s entry updated with the actual clock-out' },
    ],
    tryIt: { label: 'Clock someone out', href: '/staff' },
  },
  {
    key: 'pre_arrival', name: 'Pre-arrival check-in nudge', icon: 'Clock',
    trigger: 'Every day at 09:00 — arrivals in 3 days who haven’t checked in online',
    steps: [{ app: 'whatsapp', what: 'Reminder with the online check-in link' }],
    tryIt: { label: 'Run now', run: 'pre-arrival' },
  },
  {
    key: 'daily_report', name: 'Daily occupancy report', icon: 'BarChart3',
    trigger: 'Every night at 00:00',
    steps: [
      { app: 'sheets', what: 'Row with occupancy, arrivals, departures and revenue' },
      { app: 'slack', what: 'Report posted to the team' },
    ],
    tryIt: { label: 'Run now', run: 'daily-report' },
  },
]

export const EVENT_LABELS: Record<HotelEvent | 'test', string> = {
  new_booking: 'New booking',
  pre_arrival: 'Pre-arrival',
  checkin: 'Check-in',
  checkout: 'Checkout',
  housekeeping_created: 'Housekeeping',
  maintenance: 'Maintenance',
  guest_message: 'Guest message',
  payment_failed: 'Payment failed',
  payment_success: 'Payment received',
  vip_arrival: 'VIP arrival',
  daily_report: 'Daily report',
  guest_signup: 'Guest signup',
  employee_checkin: 'Staff clock-in',
  employee_checkout: 'Staff clock-out',
  test: 'Test',
}

/** Events a hotel's own Automation Studio flows can listen to. */
export const STUDIO_EVENTS: HotelEvent[] = ['new_booking', 'guest_signup', 'checkin', 'employee_checkin', 'employee_checkout', 'checkout', 'payment_success', 'payment_failed', 'maintenance', 'guest_message', 'daily_report']
