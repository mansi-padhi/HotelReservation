/**
 * The five apps Hotelator OS integrates through viaSocket.
 *
 * Every service_id, action_version_id and field key here is copied character-for-character
 * from the app documents saved in .claude/skills/viasocket-<app>/SKILL.md
 * (generated from https://flow.viasocket.com/documentation/<service_id>.md). Never type one
 * from memory — keys differ between actions of the same app. Refetch the doc when in doubt.
 *
 * This module holds no secret and is safe to import in the browser.
 */
import type { AppKey } from '../types'

export interface PickerDef {
  /** Where the choice is stored in the app's config. */
  key: string
  label: string
  help?: string
  /** The action whose list-options serves this field (from the doc's field index). */
  versionId: string
  /** Full dotted path, exactly as the doc's field table writes it. */
  fieldKey: string
  /** Config keys that must be chosen first; nested into existingFields by `existingPath`. */
  dependsOn?: string[]
  /** Fixed values the field's existingFields need (shaped like inputData). */
  existingBase?: Record<string, unknown>
  searchable?: boolean
  optional?: boolean
  multi?: boolean
}

export interface AppDef {
  key: AppKey
  name: string
  serviceId: string
  icon: string
  accent: string
  blurb: string
  uses: string[]
  actions: Record<string, string>
  triggers?: Record<string, string>
  pickers: PickerDef[]
  /** Static choices (not fetched). */
  staticFields?: Array<{ key: string; label: string; options: Array<string | { value: string; label: string }>; default: string }>
  note?: string
}

export const APPS: Record<AppKey, AppDef> = {
  whatsapp: {
    key: 'whatsapp',
    name: 'WhatsApp',
    serviceId: 'row3icnwu2su', // WhatsApp Business Cloud (Meta)
    icon: 'https://stuff.thingsofbrand.com/viasocket.com/images/imge_whatsapp.svg',
    accent: '#25D366',
    blurb: 'Confirmations, pre-arrival nudges, welcome notes and a request bot guests can message.',
    uses: ['Booking confirmation', 'Pre-arrival check-in link', 'Welcome + room number', 'In-stay request bot', 'Invoice & review'],
    actions: {
      sendText: 'rowxosuf86ra', // Send Text Message: phone_number_id, wa_id, message
    },
    triggers: {
      inbound: 'rowybkarcyoe', // Message Notification: wba_id, phone_id
    },
    pickers: [
      { key: 'wba_id', label: 'WhatsApp Business account', versionId: 'row7fwmnlt84', fieldKey: 'wba_id' },
      { key: 'phone_id', label: 'Sending phone number', versionId: 'rowj80xxlox1', fieldKey: 'phone_id', dependsOn: ['wba_id'] },
    ],
    note: 'Free-text WhatsApp messages reach a guest only inside the 24h window after they last messaged you (Meta rule). Guests who message the hotel number first always get replies.',
  },
  gmail: {
    key: 'gmail',
    name: 'Gmail',
    serviceId: 'rowo0bqrhj5g',
    icon: 'https://stuff.thingsofbrand.com/gmail.com/images/imge_idrA5FDGTH_1763454052978.svg',
    accent: '#EA4335',
    blurb: 'Branded confirmation and invoice emails, sent from the hotel’s own mailbox.',
    uses: ['Booking confirmation email', 'Invoice email at checkout'],
    actions: {
      sendEmail: 'rowwj0sfmhub', // Send Email: to, subject, messageBody, from, fromName …
    },
    pickers: [
      { key: 'from', label: 'Send from (alias)', versionId: 'rowwj0sfmhub', fieldKey: 'from', optional: true, help: 'Optional — defaults to the connected mailbox.' },
    ],
  },
  slack: {
    key: 'slack',
    name: 'Slack',
    serviceId: 'rowbu58rc',
    icon: 'https://stuff.thingsofbrand.com/slack.com/images/img668216333e_slack.jpg',
    accent: '#611f69',
    blurb: 'Your ops channel hears about check-ins, VIPs, dirty rooms, maintenance and payments.',
    uses: ['Check-in alerts', 'VIP prep checklist', 'Housekeeping + maintenance', 'Payment failures', 'Daily report'],
    actions: {
      sendMessage: 'rowj2u3wc8h5', // Send Message: destination.messageto, destination.channel_id[], markdown_content
    },
    pickers: [
      {
        key: 'channel_id',
        label: 'Ops channel',
        versionId: 'rowj2u3wc8h5',
        fieldKey: 'destination.channel_id',
        existingBase: { destination: { messageto: 'channel' } },
      },
    ],
  },
  sheets: {
    key: 'sheets',
    name: 'Google Sheets',
    serviceId: 'rowqm5xi2',
    icon: 'https://stuff.thingsofbrand.com/google.com/images/img4_googlesheet.png',
    accent: '#0F9D58',
    blurb: 'A live ledger: every booking, checkout and daily report lands as a row.',
    uses: ['Booking ledger', 'Checkout ledger', 'Daily occupancy row'],
    actions: {
      addRow: 'row5dxvkb0mr', // Add New Row to Sheet: spreadsheet_Id, grid_Id, column_key, column_selected[], column_name{}
    },
    pickers: [
      { key: 'spreadsheet_Id', label: 'Spreadsheet', versionId: 'row5dxvkb0mr', fieldKey: 'spreadsheet_Id', searchable: true },
      { key: 'grid_Id', label: 'Sheet (tab)', versionId: 'row5dxvkb0mr', fieldKey: 'grid_Id', dependsOn: ['spreadsheet_Id'] },
    ],
  },
  gcal: {
    key: 'gcal',
    name: 'Google Calendar',
    serviceId: 'rowkhibv5efp',
    icon: 'https://stuff.thingsofbrand.com/google.com/images/img7_Google-Calendar.png',
    accent: '#4285F4',
    blurb: 'Arrivals and VIP prep appear on the front-desk calendar automatically.',
    uses: ['Arrival events', 'VIP preparation reminder'],
    actions: {
      createEvent: 'rown3bkuc5jc', // Create Calendar Event: calendar_id, summary, startdate DD-MM-YYYY, starttime HH:MM, meeting_duration HH:MM …
    },
    pickers: [{ key: 'calendar_id', label: 'Calendar', versionId: 'rown3bkuc5jc', fieldKey: 'calendar_id' }],
    staticFields: [
      {
        key: 'timeZone',
        label: 'Time zone',
        default: 'Asia/Kolkata',
        // one of … — from the Create Calendar Event field table
        options: ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Moscow', 'Africa/Johannesburg', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo', 'Australia/Sydney'],
      },
      {
        key: 'colorId',
        label: 'Event colour',
        default: '2',
        // Google Calendar event colour ids (the action rejects anything outside 1–11).
        options: [
          { value: '1', label: 'Lavender' }, { value: '2', label: 'Sage' }, { value: '3', label: 'Grape' }, { value: '4', label: 'Flamingo' },
          { value: '5', label: 'Banana' }, { value: '6', label: 'Tangerine' }, { value: '7', label: 'Peacock' }, { value: '8', label: 'Graphite' },
          { value: '9', label: 'Blueberry' }, { value: '10', label: 'Basil' }, { value: '11', label: 'Tomato' },
        ],
      },
    ],
  },
}

export const APP_LIST = Object.values(APPS)

/** Sheets "Add New Row" column steps (need spreadsheet_Id + grid_Id first). */
export const SHEETS_COLUMNS = {
  versionId: 'row5dxvkb0mr',
  selectedKey: 'column_selected',
  namesKey: 'column_name',
}

/** Values a sheet column can be filled with. Mapped per column in App Connections. */
export const SHEET_FIELDS = [
  { value: 'event', label: 'Event' },
  { value: 'reservation_code', label: 'Booking code' },
  { value: 'guest_name', label: 'Guest name' },
  { value: 'guest_phone', label: 'Guest phone' },
  { value: 'guest_email', label: 'Guest email' },
  { value: 'room', label: 'Room' },
  { value: 'room_type', label: 'Room type' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'check_out', label: 'Check-out' },
  { value: 'nights', label: 'Nights' },
  { value: 'amount', label: 'Amount (₹)' },
  { value: 'paid', label: 'Paid (₹)' },
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
  { value: 'timestamp', label: 'Timestamp' },
  { value: '', label: '— leave empty —' },
] as const

/** Every viaSocket picker call must match one of these (the server refuses anything else). */
export function isAllowedPicker(app: AppKey, versionId: string, fieldKey: string): boolean {
  const def = APPS[app]
  if (!def) return false
  if (def.pickers.some((p) => p.versionId === versionId && p.fieldKey === fieldKey)) return true
  return app === 'sheets' && versionId === SHEETS_COLUMNS.versionId && [SHEETS_COLUMNS.selectedKey, SHEETS_COLUMNS.namesKey].includes(fieldKey)
}
