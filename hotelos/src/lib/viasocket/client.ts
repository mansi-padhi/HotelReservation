/**
 * Server-side viaSocket Apps API client — the "one small client" from the viaSocket skill.
 * The embed secret and every script_id stay here; nothing in this file runs in the browser.
 */
import jwt from 'jsonwebtoken'

const API = () => process.env.VIASOCKET_API_URL || 'https://flow-api.viasocket.com'
const RUN = () => process.env.VIASOCKET_RUN_URL || 'https://flow.sokt.io'

export const viasocketConfigured = () => Boolean(process.env.VIASOCKET_EMBED_SECRET)

export class ViasocketError extends Error {
  constructor(message: string, public status = 500, public body?: unknown) {
    super(message)
  }
}

/**
 * HS256, exactly three claims, no exp — valid until the secret rotates, by design.
 * uniqueIdentifier is this product's stable id for the account (the hotel id), forever.
 */
export function embedToken(uniqueIdentifier: string): string {
  const secret = process.env.VIASOCKET_EMBED_SECRET
  if (!secret) throw new ViasocketError('VIASOCKET_EMBED_SECRET is not set. Add it to .env.local (viaSocket dashboard → Integrations → embed → Install Code).', 503)
  return jwt.sign(
    {
      org_id: process.env.VIASOCKET_ORG_ID || '4160',
      project_id: process.env.VIASOCKET_PROJECT_ID || 'projj1a8ky8Q',
      unique_identifier: uniqueIdentifier,
    },
    secret,
    { algorithm: 'HS256' },
  )
}

async function call<T = any>(path: string, uniqueIdentifier: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`${API()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', authorization: embedToken(uniqueIdentifier) },
    body: method === 'GET' || method === 'DELETE' ? undefined : body === undefined ? '' : JSON.stringify(body),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    throw new ViasocketError(payload.message || `viaSocket ${path} failed with ${response.status}`, response.status, payload)
  }
  return payload.data as T
}

/** Needed only to run actions. Once per (user, app) — store the script_id. */
export async function enableApp(uniqueIdentifier: string, serviceId: string, authId: string): Promise<string> {
  const data = await call<{ script_id: string }>(`/embed/enable/${serviceId}/${authId}`, uniqueIdentifier)
  if (!data?.script_id) throw new ViasocketError('Enable returned no script_id', 502, data)
  return data.script_id
}

export interface ViasocketFlow {
  id: string
  title?: string
  status: string
  service_id: string
  auth_id?: string
  webhook?: string
}

export async function listUserFlows(uniqueIdentifier: string): Promise<ViasocketFlow[]> {
  const project = process.env.VIASOCKET_PROJECT_ID || 'projj1a8ky8Q'
  const response = await fetch(`${API()}/projects/${project}/integrations`, {
    headers: { authorization: embedToken(uniqueIdentifier) },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  return payload.data?.flows || []
}

/** The script_id of an app this user already enabled, or null. Saves enabling twice. */
export async function findEnabledApp(uniqueIdentifier: string, serviceId: string, authId?: string): Promise<string | null> {
  const flows = await listUserFlows(uniqueIdentifier)
  const match = flows.find(
    (f) => f.service_id === serviceId && f.status === 'active' && (!authId || !f.auth_id || f.auth_id === authId),
  )
  return match?.id || null
}

export async function setFlowStatus(uniqueIdentifier: string, scriptId: string, status: 0 | 1) {
  return call(`/embed/updatestatus/${scriptId}?status=${status}`, uniqueIdentifier, undefined, 'PUT')
}

export async function listConnections(uniqueIdentifier: string) {
  return call<unknown>('/embed/authentications', uniqueIdentifier, undefined, 'GET')
}

export async function revokeConnection(uniqueIdentifier: string, authId: string) {
  return call(`/embed/authentications/revoke/${authId}`, uniqueIdentifier, undefined, 'DELETE')
}

export interface Option {
  label: string
  value: unknown
}

/** fieldKey is the full dotted path; existingFields is nested exactly like inputData. */
export async function listOptions(
  uniqueIdentifier: string,
  actionVersionId: string,
  fieldKey: string,
  existingFields: Record<string, unknown>,
  authId: string,
  searchText?: string,
): Promise<Option[]> {
  const data = await call<any>(`/embed/list-options/${actionVersionId}`, uniqueIdentifier, {
    fieldKey,
    auth_id: authId,
    existingFields: searchText ? { ...existingFields, _searchText: searchText } : existingFields,
  })
  // An unreadable connection answers 200 + success:true with the failure nested. Surface it.
  if (data && !Array.isArray(data) && data.response && Number(data.response.status) >= 400) {
    throw new ViasocketError(data.response.data?.message || 'list-options failed — reconnect the app', 400, data)
  }
  const options = Array.isArray(data) ? data : data?.data
  return Array.isArray(options) ? options : []
}

/** No token — the script_id is the credential. */
export async function runAction(scriptId: string, actionVersionId: string, inputData: Record<string, unknown>) {
  const response = await fetch(`${RUN()}/func/${scriptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_version_id: actionVersionId, inputData }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({ success: false, message: `HTTP ${response.status}` }))
  // Envelope { success, data } — or the action's own body (which may carry its own success key).
  const isEnvelope = payload && typeof payload === 'object' && typeof payload.success === 'boolean' && 'data' in payload
  if (isEnvelope ? !payload.success : payload?.success === false) {
    throw new ViasocketError(errorMessage(payload), 502, payload)
  }
  const body = isEnvelope ? payload.data : payload
  // The run URL answers 200 even when the app's API rejected the call; the app's error is the body
  // ({ message, status: 400, code: "ERR_BAD_REQUEST", originalError }). That is a failure, not a result.
  if (looksLikeError(body)) throw new ViasocketError(errorMessage(body), 502, body)
  return body
}

function looksLikeError(b: any): boolean {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return false
  if (typeof b.status === 'number' && b.status >= 400) return true
  if (typeof b.code === 'string' && /^ERR_/.test(b.code)) return true
  if ('originalError' in b) return true
  if (b.error && typeof b.error === 'object' && (b.error.code >= 400 || b.error.message) && Object.keys(b).length <= 3) return true
  // viaSocket's own run-infrastructure errors (the enabled script itself was deleted, paused, or
  // not found — distinct from the third-party app rejecting the call) answer 200 with nothing but
  // a bare { message }. No action of ours legitimately returns only a message on success.
  const keys = Object.keys(b)
  if (keys.length === 1 && keys[0] === 'message' && typeof b.message === 'string') return true
  return false
}

function errorMessage(b: any): string {
  const inner = b?.originalError?.error?.message || b?.error?.message
  const outer = b?.message
  if (inner && outer && inner !== outer) return `${outer}: ${inner}`
  return inner || outer || (typeof b?.error === 'string' ? b.error : '') || 'Action failed'
}

export async function subscribeEvent(
  uniqueIdentifier: string,
  triggerVersionId: string,
  authId: string,
  inputData: Record<string, unknown>,
  delivery: { code: string },
  meta: Record<string, unknown> = {},
): Promise<string> {
  const data = await call<{ script_id: string }>(`/embed/subscribe-event/${triggerVersionId}`, uniqueIdentifier, {
    auth_id: authId,
    inputData,
    ...delivery,
    meta,
  })
  if (!data?.script_id) throw new ViasocketError('Subscribe returned no script_id', 502, data)
  return data.script_id
}

export async function updateSubscription(uniqueIdentifier: string, scriptId: string, changes: { code: string }) {
  return call(`/embed/update-subscribed-event/${scriptId}`, uniqueIdentifier, changes, 'PUT')
}

/** Runs a flow a hotel built in the prebuilt UI. Its URL is a credential; server-side only. */
export async function runCustomFlow(webhookurl: string, body: unknown) {
  const response = await fetch(webhookurl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await response.text()
  if (!response.ok) throw new ViasocketError(`Flow returned ${response.status}: ${text.slice(0, 200)}`, response.status)
  let out: unknown = text
  try {
    out = JSON.parse(text)
  } catch {
    return text
  }
  if (looksLikeError(out)) throw new ViasocketError(errorMessage(out), 502, out)
  return out
}
