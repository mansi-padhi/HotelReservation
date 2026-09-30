/**
 * inputData builders, one per viaSocket action. Keys copied from each action's field table
 * in .claude/skills/viasocket-<app>/SKILL.md — do not rename them.
 */
import type { Hotel } from '../types'
import { waNumber } from '../utils'

type Cfg = Record<string, any>

/** WhatsApp Business Cloud → Send Text Message (rowxosuf86ra) */
export const waText = (cfg: Cfg, to: string, message: string) => ({
  phone_number_id: cfg.phone_id ?? '',
  wa_id: waNumber(to),
  message,
})

/** Gmail → Send Email (rowwj0sfmhub) */
export const gmailSend = (cfg: Cfg, hotel: Hotel, to: string, subject: string, html: string) => ({
  to,
  subject,
  messageBody: html,
  fromName: hotel.name,
  replyTo: hotel.email,
  ...(cfg.from ? { from: cfg.from } : {}),
})

/** Slack → Send Message (rowj2u3wc8h5) */
export const slackPost = (cfg: Cfg, markdown: string) => ({
  destination: { messageto: 'channel', channel_id: cfg.channel_id ? [cfg.channel_id] : [] },
  markdown_content: markdown,
  bot_details: { bot_name: 'Hotelator OS', icon_type: 'emoji', emoji: ':hotel:' },
})

/** Google Sheets → Add New Row to Sheet (row5dxvkb0mr). Column keys are list-options values, verbatim. */
export const sheetRow = (cfg: Cfg, row: Record<string, string | number>) => ({
  spreadsheet_Id: cfg.spreadsheet_Id ?? '',
  grid_Id: cfg.grid_Id ?? '',
  column_key: true,
  column_selected: cfg.column_selected ?? [],
  column_name: Object.fromEntries(
    ((cfg.columns ?? []) as Array<{ value: string; field: string }>)
      .filter((c) => c.value && c.value !== 'undefined')
      .map((c) => [c.value, c.field ? String(row[c.field] ?? '') : '']),
  ),
})

/** A mapping saved before the column_name fix has keys "undefined" and would write empty rows. */
export const sheetsMappingValid = (cfg: Cfg) =>
  Array.isArray(cfg.columns) && cfg.columns.length > 0 && cfg.columns.every((c: { value?: string }) => c.value && c.value !== 'undefined')

/**
 * Google Calendar → Create Calendar Event (rown3bkuc5jc). startdate DD-MM-YYYY, starttime/duration HH:MM.
 * Tested against a live calendar: the doc marks colorId, useDefault, visibility, transparency and
 * guestsCanModify optional, but Google answers 400 unless they are sent (and colorId must be "1"–"11").
 */
export const calendarEvent = (
  cfg: Cfg,
  hotel: Hotel,
  e: { summary: string; description: string; date: string; time: string; duration: string; attendees?: string },
) => {
  const [y, m, d] = e.date.split('-')
  // Invite the calendar's own mailbox rather than an address that may not exist.
  const calendarEmail = typeof cfg.calendar_id === 'string' && /^[^\s#]+@[^\s]+\.[a-z]+$/i.test(cfg.calendar_id) && !cfg.calendar_id.endsWith('calendar.google.com') ? cfg.calendar_id : ''
  return {
    calendar_id: cfg.calendar_id ?? '',
    summary: e.summary,
    description: e.description,
    attendees: e.attendees || calendarEmail || hotel.email,
    timeZone: cfg.timeZone || 'Asia/Kolkata',
    startdate: `${d}-${m}-${y}`,
    starttime: e.time,
    meeting_duration: e.duration,
    location: hotel.address,
    status: 'confirmed',
    colorId: String(cfg.colorId || '2'),
    useDefault: true,
    visibility: 'default',
    transparency: 'opaque',
    guestsCanModify: false,
  }
}

export const SHEETS_NEEDS = ['spreadsheet_Id', 'grid_Id', 'columns']

/** "YYYY-MM-DDTHH:MM:SS" in the hotel's local time — the format Keka's clock-in field documents. */
export function kekaTime(iso: string, timeZone = 'Asia/Kolkata'): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

/**
 * Keka → Log Employee Clock In and Out (rowvxoik3u26). Keys from its raw schema:
 * searchBy picks the identity field; attendance is an input group holding clockIn + clockOut (both required).
 */
export const kekaAttendance = (
  cfg: Cfg,
  emp: { email: string; keka_employee_id?: string },
  clockIn: string,
  clockOut: string,
) => ({
  ...(emp.keka_employee_id
    ? { searchBy: 'employeeId', employeeId: emp.keka_employee_id }
    : { searchBy: 'email', employeeEmail: emp.email }),
  attendance: { clockIn: kekaTime(clockIn), clockOut: kekaTime(clockOut) },
  ...(cfg.premiseName ? { premiseName: String(cfg.premiseName) } : {}),
})
