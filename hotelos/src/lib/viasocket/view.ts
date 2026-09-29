import type { AppKey, Hotel } from '../types'
import { APP_LIST } from './apps'
import { viasocketConfigured } from './client'
import { maskHandler } from './handlers'
import { sheetsMappingValid } from '../automations/inputs'

/** What the browser may know about a connection: no auth_id, no script_id, no webhook URLs. */
export interface PublicConnection {
  key: AppKey
  connected: boolean
  enabled: boolean
  connected_at?: string
  config: Record<string, unknown>
  ready: boolean
}

export interface PublicIntegrations {
  configured: boolean
  orgId: string
  projectId: string
  apps: Record<AppKey, PublicConnection>
  waInbound: null | { status: 'active' | 'paused'; created_at: string; inputData: Record<string, unknown>; handler: string }
  studioFlows: Array<{ id: string; title: string; status: string; events: string[]; serviceIcons?: string[]; updated_at: string; hasUrl: boolean }>
}

const READY_NEEDS: Record<AppKey, string[]> = {
  whatsapp: ['phone_id'],
  gmail: [],
  slack: ['channel_id'],
  sheets: ['spreadsheet_Id', 'grid_Id', 'columns'],
  gcal: ['calendar_id'],
}

export function publicIntegrations(hotel: Hotel): PublicIntegrations {
  const apps = Object.fromEntries(
    APP_LIST.map((a) => {
      const c = hotel.integrations[a.key]
      const config = c?.config ?? {}
      return [
        a.key,
        {
          key: a.key,
          connected: Boolean(c),
          enabled: Boolean(c?.script_id),
          connected_at: c?.connected_at,
          config,
          ready:
            Boolean(c?.script_id) &&
            READY_NEEDS[a.key].every((k) => config[k] && (!Array.isArray(config[k]) || (config[k] as unknown[]).length)) &&
            (a.key !== 'sheets' || sheetsMappingValid(config)),
        } satisfies PublicConnection,
      ]
    }),
  ) as Record<AppKey, PublicConnection>
  const sub = hotel.subscriptions.find((s) => s.key === 'wa_inbound')
  return {
    configured: viasocketConfigured(),
    orgId: process.env.VIASOCKET_ORG_ID || '4160',
    projectId: process.env.VIASOCKET_PROJECT_ID || 'projj1a8ky8Q',
    apps,
    waInbound: sub ? { status: sub.status, created_at: sub.created_at, inputData: sub.inputData, handler: maskHandler(sub.delivery.code) } : null,
    studioFlows: hotel.custom_flows
      .filter((f) => f.status !== 'deleted')
      .map((f) => ({ id: f.id, title: f.title, status: f.status, events: f.events, serviceIcons: f.serviceIcons, updated_at: f.updated_at, hasUrl: Boolean(f.webhookurl) })),
  }
}
