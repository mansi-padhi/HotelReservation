import { mutate } from '../db'
import type { AppKey, AutomationLog, Hotel, HotelEvent } from '../types'
import { uid } from '../utils'
import { APPS } from '../viasocket/apps'
import { runAction, viasocketConfigured } from '../viasocket/client'
import { sheetsMappingValid } from './inputs'

export function log(entry: Omit<AutomationLog, 'id' | 'created_at'>) {
  mutate((d) => {
    d.automation_logs.unshift({ ...entry, id: uid('log'), created_at: new Date().toISOString() })
    if (d.automation_logs.length > 500) d.automation_logs.length = 500
  })
}

export const isEnabled = (hotel: Hotel, event: HotelEvent) => hotel.automation_toggles[event] !== false

/** Why an app can't run right now, or null when it can. */
export function notReady(hotel: Hotel, app: AppKey, needs: string[] = []): string | null {
  if (!viasocketConfigured()) return 'viaSocket secret not set'
  const conn = hotel.integrations[app]
  if (!conn) return `${APPS[app].name} not connected`
  if (!conn.script_id) return `${APPS[app].name} not enabled`
  const missing = needs.filter((k) => !conn.config[k])
  if (missing.length) return `${APPS[app].name} setup incomplete (${missing.join(', ')})`
  if (app === 'sheets' && !sheetsMappingValid(conn.config)) return 'Sheets column mapping is outdated — click Load columns and save'
  return null
}

/**
 * The plan's safeRun(): runs one viaSocket action for one app, never throws, always logs.
 * When the app isn't ready, the would-be inputData is still logged so the demo shows it.
 */
export async function safeRun(opts: {
  hotel: Hotel
  reservationId?: string
  event: HotelEvent | 'test'
  app: AppKey
  action: string
  summary: string
  needs?: string[]
  build: (config: Record<string, any>) => Record<string, unknown>
}): Promise<{ ok: boolean; status: AutomationLog['status']; result?: unknown; error?: string }> {
  const { hotel, event, app, summary } = opts
  if (event !== 'test' && !isEnabled(hotel, event)) {
    log({ hotel_id: hotel.id, reservation_id: opts.reservationId, event_type: event, app, status: 'skipped', summary: `${summary} — automation paused` })
    return { ok: false, status: 'skipped' }
  }
  const conn = hotel.integrations[app]
  const inputData = opts.build(conn?.config ?? {})
  const reason = notReady(hotel, app, opts.needs)
  if (reason) {
    log({ hotel_id: hotel.id, reservation_id: opts.reservationId, event_type: event, app, status: 'skipped', summary: `${summary} — ${reason}`, details: { would_send: inputData, action_version_id: opts.action } })
    return { ok: false, status: 'skipped', error: reason }
  }
  try {
    const result = await runAction(conn!.script_id!, opts.action, inputData)
    log({ hotel_id: hotel.id, reservation_id: opts.reservationId, event_type: event, app, status: 'success', summary, details: { inputData, response: result, action_version_id: opts.action } })
    return { ok: true, status: 'success', result }
  } catch (e: any) {
    console.error(`[automation] ${event}/${app}:`, e)
    log({ hotel_id: hotel.id, reservation_id: opts.reservationId, event_type: event, app, status: 'failed', summary: `${summary} — ${e.message}`, details: { inputData, error: e.message, response: e.body, action_version_id: opts.action } })
    return { ok: false, status: 'failed', error: e.message }
  }
}
