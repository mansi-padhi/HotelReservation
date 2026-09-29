---
name: viasocket-google-calendar
description: >-
  Integrate Google Calendar into this product through the viaSocket Apps API: render a connect
  button, capture the user's connection, populate pickers with their real data, run
  Google Calendar actions from the backend, and subscribe to Google Calendar events. Use whenever the
  task involves connecting a third-party app for an end user, reading the choices a field
  accepts, running an action in that app, or receiving its events.
---

# Google Calendar via the viaSocket Apps API

> Source: https://flow.viasocket.com/documentation/rowkhibv5efp.md?format=http. Public, no sign-in. Fetch it again for the
> latest version of this file; it is generated from the live catalog.

viaSocket owns the integration with the app. Your code never talks to the app, never holds
its credentials and never refreshes its tokens — you make the five calls below and we do
that part. Your user authorises through the app’s own consent screen.

What that buys you, concretely:

- **Credentials you never see.** Each user’s Google Calendar tokens live encrypted in viaSocket’s vault and are
  refreshed there; a leak of your database leaks no third-party access.
- **One contract for Google Calendar and 2,300 other apps.** The same five calls, the same `{ label, value }` options,
  the same event handler shape, whichever app the user connects next.
- **Triggers done for you.** Polling where the app has no webhooks, de-duplication, renewal, delivery.
- **A runtime for your logic, not just a proxy.** An event handler is JavaScript we run in an isolated
  sandbox per event, with every app this user connected one `fetch` away and no secret in the code. So
  "when X, do Y" needs no server of yours, no deploy and nothing public, and `update-subscribed-event`
  swaps a live handler in place rather than shipping a release.
- **Real data for pickers.** `list-options` returns the user’s own channels, sheets and boards,
  searchable where the app’s list is large.
- **This file is generated from the live catalog.** Every id and field is current; refetch it rather than
  trusting a copy.

This file calls the HTTP API directly, through one small client you write yourself (below).
Any language works; the examples are JavaScript.

## What you are building

1. A **connect button** in your UI that opens Google Calendar's consent screen and gives you an `auth_id`.
2. **Pickers** in your UI filled with the user's real Google Calendar data, one call per field.
3. **Actions** — enable the app once for a `script_id`, then run them from your backend.
4. **Events** — when something happens in the app, a short handler of yours runs on our
   servers: it runs an action in another app, calls your API, or both. Your server is not in the path.

> Enabling is only for actions. A trigger subscription needs the `auth_id` and nothing
> else, so an integration that only listens for events never calls `/embed/enable`.

## Rules that are not negotiable

1. **The signing secret and the embed token are server-side only.** Sign the token on your
   backend; hand the frontend only what one popup needs.
2. **A `script_id` is a credential.** Anyone holding it can run that app as that user.
   Store it like a password and never ship it to the browser.
3. **Ids are fetched, never guessed.** Repository ids, channel ids, sheet ids — every one
   comes from `POST /embed/list-options`. A hardcoded id fails confusingly, not clearly.
4. **`existingFields` is not optional when a field depends on another.** Options are scoped
   by it; `{}` for a dependent field returns nothing useful.
5. **A nested key is addressed by its whole path.** `inputData` nests — `{ destination: {
   channel_id } }` — and the API addresses that field as `destination.channel_id`. So
   `fieldKey` is the **full dotted path**, never the leaf, and `existingFields` carries the
   value **nested exactly as inputData does**, never flattened:

   ```json
   { "fieldKey": "destination.thread_ts",
     "existingFields": { "destination": { "thread_channel_id": "C082WLRJLAA" } } }
   ```

   A leaf `fieldKey`, or a flat `"destination.thread_channel_id"` key in `existingFields`,
   matches no field: the call succeeds and returns nothing. Every field table below writes
   its keys in this full form, and the `inputData` sample beside each one shows the object
   those paths nest into. **Keys are case-sensitive and differ between actions of this app**
   (Google Sheets: `spreadsheet_Id` in one action, `spreadSheet_id` in another, `spreadsheet_id` in
   a third). A key from another action matches nothing, silently. Copy each key from the table
   of the action you are calling, character for character; never type one from memory. The
   parameter that carries it is `fieldKey` — not `blockKey`, not `field`.
6. **Normalise the list-options response.** Some fields wrap their list under `data.data`
   (with an `offset` you ignore); a plain field returns the array as `data`. Items are always
   `{ label, value }` — show the label, send the value. One helper, both shapes, no paging.
   A connection that cannot be read (revoked, or another user's `auth_id`) is answered with **200 and `success: true`**, the failure nested as `data.response.status` 400 and `data.response.data.message`. Treat that as the error it is; never render it as an empty list.
   A field marked **searchable** (`enableSearchApi` in the schema) takes what the user typed as
   `existingFields._searchText`, inside existingFields next to the dependency values. The field
   tables mark it.
7. **One `unique_identifier` per end user, forever.** Connections and subscriptions are
   isolated by it. Change it and the user appears to have lost their connection.
8. **A field of type `object` is not a single choice.** Fetch it like any other field —
   the response is the same `{ label, value }` list — then use *every* option’s `value` as a
   key, **verbatim**, and supply a value for each: `{ "<option value>": "<your value>" }`. The
   value is opaque: `name@longtext` is the whole key, however much it looks like a name plus a
   type. Never send the label, a lowercased label, or the value with a suffix removed.
9. **Enable only when you need actions, and never twice.** Subscribing to an event needs
   the connection and nothing more. Before enabling, look the flows up (see “Managing what
   a user already has”) — the `script_id` you want may already exist.
10. **A subscription needs a handler: `code`, a string of JavaScript we run on viaSocket’s
    servers each time the event fires.** It is what makes “when X happens in this app, do Y”
    work with no server of yours in the path. In scope there: `axios`, `fetch`, and `context`;
    the event is `context.req.body`. It stands alone: no `import`/`require`, nothing from this
    codebase; anything of yours it needs (a `script_id`, a picked id, an API key) is baked into
    the string when you subscribe. `webhook` is the edge case, not the default: pass it only
    when the product wants raw events pushed to a public endpoint of its own. Never both.

## Environment

```bash
# Your org signing secret, from the viaSocket Install Code page. Backend only.
VIASOCKET_EMBED_SECRET=...

# Fixed for this integration.
VIASOCKET_ORG_ID=4160
VIASOCKET_PROJECT_ID=projj1a8ky8Q
VIASOCKET_API_URL=https://flow-api.viasocket.com
VIASOCKET_RUN_URL=https://flow.sokt.io
VIASOCKET_SERVICE_ID=rowkhibv5efp   # Google Calendar
```

## Calling it

One server-side module, no dependency beyond a JWT library. Every call except the connect popup goes through it,
and every example further down uses these function names.

```js
import jwt from 'jsonwebtoken'

const API = process.env.VIASOCKET_API_URL
const RUN = process.env.VIASOCKET_RUN_URL

/**
 * uniqueIdentifier is YOUR stable id for the signed-in end user (a user id, an email hash).
 * It is not a token: it becomes the unique_identifier claim of the embed token this signs.
 * Sign on demand, per request, on the server; never cache it in the browser.
 */
export function embedToken(uniqueIdentifier) {
  return jwt.sign(
    {
      org_id: process.env.VIASOCKET_ORG_ID,
      project_id: process.env.VIASOCKET_PROJECT_ID,
      unique_identifier: uniqueIdentifier
    },
    process.env.VIASOCKET_EMBED_SECRET
  )
}

async function call(path, uniqueIdentifier, body, method = "POST") {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", authorization: embedToken(uniqueIdentifier) },
    body: body === undefined ? "" : JSON.stringify(body)
  })
  const payload = await response.json()
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `viaSocket ${path} failed with ${response.status}`)
  }
  return payload.data
}

/** Needed only to run actions. Once per (user, app) — store the script_id. */
export async function enableApp(uniqueIdentifier, authId, serviceId = process.env.VIASOCKET_SERVICE_ID) {
  const data = await call(`/embed/enable/${serviceId}/${authId}`, uniqueIdentifier)
  return data.script_id
}

/** Every flow this user has: one per enabled app, one per trigger subscription. */
export async function listUserFlows(uniqueIdentifier) {
  const response = await fetch(`${API}/projects/${process.env.VIASOCKET_PROJECT_ID}/integrations`, {
    headers: { authorization: embedToken(uniqueIdentifier) }
  })
  const payload = await response.json()
  return payload.data?.flows || []
}

/** The script_id of an app this user already enabled, or null. Saves enabling twice. */
export async function findEnabledApp(uniqueIdentifier, serviceId = process.env.VIASOCKET_SERVICE_ID) {
  const flows = await listUserFlows(uniqueIdentifier)
  return flows.find((flow) => flow.service_id === serviceId && flow.status === "active")?.id || null
}

/** Turns a flow off: disables an enabled app, or ends a subscription. status=1 turns it back on. */
export async function setFlowStatus(uniqueIdentifier, scriptId, status = 0) {
  return call(`/embed/updatestatus/${scriptId}?status=${status}`, uniqueIdentifier, undefined, "PUT")
}

/** Every app this user has connected — enough to render your own "connected accounts" screen. */
export async function listConnections(uniqueIdentifier) {
  return call("/embed/authentications", uniqueIdentifier, undefined, "GET")
}

/** Disconnects an app. Disable the flows built on it first, or they break. */
export async function revokeConnection(uniqueIdentifier, authId) {
  return call(`/embed/authentications/revoke/${authId}`, uniqueIdentifier, undefined, "DELETE")
}

/**
 * Step 3. The values one field accepts, scoped by what is already chosen.
 *
 * fieldKey is the field's full path ("destination.channel_id" for a nested one), and
 * existingFields is shaped like inputData — nested, never flattened to dotted keys.
 */
export async function listOptions(uniqueIdentifier, actionVersionId, fieldKey, existingFields = {}, authId, { searchText } = {}) {
  const data = await call(`/embed/list-options/${actionVersionId}`, uniqueIdentifier, {
    fieldKey,
    auth_id: authId,
    // Searchable fields take what the user typed inside existingFields, next to the dependency values.
    existingFields: searchText ? { ...existingFields, _searchText: searchText } : existingFields
  })
  // A connection that cannot be read (revoked, another user's auth_id) is answered with 200 and
  // success: true, the failure nested in data. Surface it; an empty picker hides the cause.
  if (data && !Array.isArray(data) && data.response && Number(data.response.status) >= 400) {
    throw new Error(data.response.data?.message || "list-options failed")
  }
  // Two shapes, one helper: some fields wrap the list under data.data. No paging: take the list.
  const options = Array.isArray(data) ? data : data.data
  return { options }
}

/** Step 4. No token — the script_id is the credential. */
export async function runAction(scriptId, actionVersionId, inputData) {
  const response = await fetch(`${RUN}/func/${scriptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action_version_id: actionVersionId, inputData })
  })
  const payload = await response.json()
  // The run URL answers in viaSocket's envelope { success, data } — or with the action's own body at the
  // top level, which may itself carry a `success` key (Slack's "Find Public channel" returns
  // { success, channels }). It is the envelope only when `data` is present.
  const isEnvelope = payload && typeof payload === "object" && typeof payload.success === "boolean" && "data" in payload
  if (isEnvelope ? !payload.success : payload?.success === false) throw new Error(payload.message || payload.error?.message || "Action failed")
  return isEnvelope ? payload.data : payload
}

/**
 * Step 5. `delivery` is { code: script } — a handler we run per event (rule 10, Triggers) — or,
 * as the edge case, { webhook: url } — we POST raw events to a public URL of yours. One or the other.
 */
export async function subscribeEvent(uniqueIdentifier, triggerVersionId, authId, inputData, delivery, meta = {}) {
  const data = await call(`/embed/subscribe-event/${triggerVersionId}`, uniqueIdentifier, {
    auth_id: authId,
    inputData,
    ...delivery,
    meta
  })
  // data.script_id is the subscription; data.inputData.hookUrl is the hook we created.
  return data.script_id
}

export async function updateSubscription(uniqueIdentifier, subscriptionScriptId, changes) {
  return call(`/embed/update-subscribed-event/${subscriptionScriptId}`, uniqueIdentifier, changes, "PUT")
}
```

## Step 1 — the connect button (frontend)

The only browser-side piece. Use Google Calendar's own icon so the button is recognisable.

```html
<button id="connect-app" class="your-button">
  <img src="https://stuff.thingsofbrand.com/google.com/images/img7_Google-Calendar.png" alt="" width="20" height="20" />
  Connect Google Calendar
</button>

<script>
  // Your backend signs this for the signed-in user.
  const embedToken = await fetch("/api/viasocket/token").then((r) => r.text())

  document.getElementById("connect-app").onclick = () =>
    openViasocketConnection(embedToken, "rowkhibv5efp")

  window.addEventListener("message", async (event) => {
    if (event.data?.type === "viasocket_connection_success") {
      // The connection id IS the auth_id every later call takes. Hand it to your
      // backend, which enables the app and stores the script_id it gets back.
      const authId = event.data.data.id
      await fetch("/api/viasocket/connected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: event.data.serviceId, authId })
      })
      showConnected()
    } else if (event.data?.type === "viasocket_connection_error") {
      showError(event.data.error?.message)
    } else if (event.data?.type === "viasocket_connection_closed") {
      // Popup closed early. Nothing was created; leave the button as it was.
    }
  })
</script>

<script id="viasocket-connect-script" src="https://embed.viasocket.com/prod-connectcomponent.js"></script>
```

Then, on your backend, for that user:

```js
// Only if you are going to run actions — subscribing to events needs just the authId.
let scriptId = await findEnabledApp(uniqueIdentifier, 'rowkhibv5efp')
if (!scriptId) scriptId = await enableApp(uniqueIdentifier, authId)
// store scriptId against (uniqueIdentifier, "rowkhibv5efp")
```

## Google Calendar

- `service_id`: `rowkhibv5efp`
- icon: https://stuff.thingsofbrand.com/google.com/images/img7_Google-Calendar.png
- auth: Auth2.0
- 16 actions, 3 triggers

## How to render a picker for any field

This is the part that is not obvious. To show the user a dropdown of Google Calendar values —
repositories, channels, boards, spreadsheets — you do **not** need the action you intend to
run. You need *any* action or trigger that exposes that field, and you call list-options on
that one's `action_version_id`. The field key is the same wherever it appears.

This table gives the cheapest source for every fetchable field of this app: the action with
the fewest prerequisites. Use it to build pickers before you have decided which action the
user is ultimately running.

Every key below is the **full path**, which is exactly what `fieldKey` takes. Where one has a
dot in it the field lives inside an object, so its value is nested under that path in both
`existingFields` and `inputData`.

| field key | label | needs first | search | call list-options on | (that action) |
| --- | --- | --- | --- | --- | --- |
| `calendarId` | Calendar | — | — | `rowpg3h8guxl` | List Calendar Access Rules |
| `calendar_id` | Calendar | — | — | `row0ce18xwwk` | Get Free/Busy Information |
| `colorId` | Event Color | — | — | `rown3bkuc5jc` | Create Calendar Event |
| `ruleId` | Access Control Rule  | — | — | `row2q2u5ldkk` | Remove Calendar Access Rule |
| `eventId` | Event | `calendarId` | searchable | `rowuao7ble9y` | Get Events by ID |
| `event_id` | Event | `calendar_id` | searchable | `rowsefrzzuqw` | Update Event Attendees |

"searchable": the field has `enableSearchApi`; send what the user typed, debounced, as `existingFields._searchText` — inside existingFields, next to the dependency values. A new text starts a new list.

Worked example — a picker for `calendarId`:

```js
// List Calendar Access Rules is just the cheapest place this field appears.
const { options } = await listOptions(uniqueIdentifier, 'rowpg3h8guxl', 'calendarId', {}, authId)

// options is [{ label, value }] — render label, submit value.
renderSelect(options)
```

## Rendering a form for any action

Only when the end user configures an action themselves. A fixed feature needs one picker from
the field index above, not a form. Every action and trigger below is described by the same
field schema, so one renderer serves all of them: give it an `action_version_id`, it draws the
form and produces `inputData`.

| column in the tables below | render as | behaviour |
| --- | --- | --- |
| type `string`, `number`, `date`, `html`, `markdown` | text input (number/date typed) | free text from your user |
| type `boolean` | yes / no | send `true` / `false` |
| type `dropdown` | single select | options from the `value comes from` column |
| type `multiselect` | multi select | send an array of values |
| type `object` | a card containing its child fields (the keys with a dot prefix) | nest the children under the parent key in `inputData` |
| type `dictionary` | key / value rows | send an object |
| type `aifield` | free text | a description the platform turns into structured input; send a string |
| `value comes from: one of …` | static options | those literal values |
| `value comes from: list-options` | select that fetches on open | await listOptions(uniqueIdentifier, versionId, fieldKey, existingFields, authId); show `label`, send `value` |
| `list-options (searchable)` | the same, with a search box | debounce typing and send it as `existingFields._searchText`; a new text starts a new list |
| `needs first` / `list-options after X` | disabled until X has a value | put X's current value in `existingFields`, nested exactly as `inputData`; clear this field when X changes |
| `only applies when …` | hidden unless the condition holds | leave hidden fields out of `inputData` entirely |
| `required: yes` | validation | block submit while empty and visible |

`fieldKey` for a fetch is always the full dotted path in the table. The result is the same
`inputData` shape as the sample under each action; submit it unchanged.

The complete recipe — the raw schema and where to get it, the eight rules, a framework-free
form engine and a React skin with paging and search — is its own document. Fetch it when you
build the form:

```http
GET https://flow.viasocket.com/documentation/form-renderer.md
```

This app's raw schema: `POST https://flow.sokt.io/func/scriolZue69X` with `{"service_id":"rowkhibv5efp"}`.

## Actions

Run any of these with `runAction(scriptId, action_version_id, inputData)`.


### Add Calendar Access Rule

- `action_version_id`: `rowjr2pnwhaf`
- Add calendar access rule
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `role` | dropdown | yes | one of "reader", "writer", "owner", "freeBusyReader" |  |
| `scopeType` | dropdown | yes | one of "user", "group", "domain", "default" |  |
| `scopeValue` | string | yes | your user | applies when scopeType !== 'default' |
| `sendNotifications` | boolean | no | one of true, false |  |

```js
const result = await runAction(scriptId, 'rowjr2pnwhaf', {
  "calendarId": "<id from list-options>",
  "role": "reader",
  "scopeType": "user",
  "scopeValue": "<scopeValue>",
  "sendNotifications": true
})
```

A real sample of what this call returns:

```json
{
  "id": "default",
  "kind": "calendar#aclRule",
  "role": "reader"
}
```

### Clear Calendar

- `action_version_id`: `rowekrxnjyxe`
- Clears a primary calendar. This operation deletes all events associated with the primary calendar of an account

_No input: send `inputData: {}`._

```js
const result = await runAction(scriptId, 'rowekrxnjyxe', {})
```

### Create Calendar Event

- `action_version_id`: `rown3bkuc5jc`
- Add an event to a calendar, including time, duration, attendees, and meeting details.
- fetch first: `calendar_id`, `colorId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendar_id` | dropdown | yes | list-options |  |
| `summary` | string | yes | your user |  |
| `description` | string | yes | your user |  |
| `attendees` | string | yes | your user |  |
| `timeZone` | dropdown | yes | one of "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney", "Asia/Dubai", "Europe/Moscow", "America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "Africa/Johannesburg", "Asia/Singapore", "Europe/Madrid", "Asia/Hong_Kong" |  |
| `starttime` | string | yes | your user |  |
| `startdate` | string | yes | your user |  |
| `meeting_duration` | string | yes | your user |  |
| `location` | string | yes | your user |  |
| `status` | dropdown | no | one of "confirmed", "tentative", "cancelled" |  |
| `colorId` | dropdown | no | list-options |  |
| `recurrence` | dropdown | no | one of "RRULE:FREQ=DAILY", "RRULE:FREQ=WEEKLY", "RRULE:FREQ=MONTHLY", "RRULE:FREQ=YEARLY" |  |
| `useDefault` | boolean | no | one of true, false |  |
| `visibility` | dropdown | no | one of "default", "public", "private" |  |
| `transparency` | dropdown | no | one of "opaque", "transparent" |  |
| `guestsCanModify` | boolean | no | one of true, false |  |

```js
const result = await runAction(scriptId, 'rown3bkuc5jc', {
  "calendar_id": "<id from list-options>",
  "summary": "<summary>",
  "description": "<description>",
  "attendees": "<attendees>",
  "timeZone": "America/New_York",
  "starttime": "<starttime>",
  "startdate": "<startdate>",
  "meeting_duration": "<meeting_duration>",
  "location": "<location>",
  "status": "confirmed",
  "colorId": "4",
  "recurrence": "RRULE:FREQ=DAILY",
  "useDefault": true,
  "visibility": "default",
  "transparency": "transparent",
  "guestsCanModify": false
})
```

A real sample of what this call returns:

```json
{
  "message": "Invalid start_date format"
}
```

### Create New Calendar

- `action_version_id`: `rowkn13ci9g9`
- Create a new Google Calendar

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `summary` | string | yes | your user |  |
| `description` | string | no | your user |  |

```js
const result = await runAction(scriptId, 'rowkn13ci9g9', {
  "summary": "<summary>",
  "description": "<description>"
})
```

A real sample of what this call returns:

```json
{
  "id": "id_example",
  "etag": "etag_example",
  "kind": "calendar#calendar",
  "summary": "sample_summary",
  "timeZone": "UTC"
}
```

### Delete Calendar

- `action_version_id`: `row27r4pm3fs`
- Delete a calendar by ID
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |

```js
const result = await runAction(scriptId, 'row27r4pm3fs', {
  "calendarId": "<id from list-options>"
})
```

A real sample of what this call returns:

```json
{
  "message": "Calendar deleted.",
  "success": true
}
```

### Delete Event

- `action_version_id`: `rowkkin7320i`
- Remove event from calendar
- fetch first: `calendarId`, `eventId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `eventId` | dropdown | yes | list-options (searchable) after calendarId |  |
| `sendUpdates` | dropdown | no | one of "all", "externalOnly", "none" |  |

```js
const result = await runAction(scriptId, 'rowkkin7320i', {
  "calendarId": "<id from list-options>",
  "eventId": "<id from list-options>",
  "sendUpdates": "all"
})
```

A real sample of what this call returns:

```json
{
  "message": "Success"
}
```

### Get an Access Control Rule

- `action_version_id`: `rowhas694lys`
- gets an access control rule by rule Id.
- fetch first: `calendarId`, `ruleId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `ruleId` | dropdown | yes | list-options after calendarId |  |

```js
const result = await runAction(scriptId, 'rowhas694lys', {
  "calendarId": "<id from list-options>",
  "ruleId": "<id from list-options>"
})
```

A real sample of what this call returns:

```json
{
  "id": "user:example@gmail.com",
  "kind": "calendar#aclRule",
  "role": "reader"
}
```

### Get Events by ID

- `action_version_id`: `rowuao7ble9y`
- Retrieves an existing events by Id.
- fetch first: `calendarId`, `eventId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `eventId` | dropdown | yes | list-options (searchable) after calendarId |  |

```js
const result = await runAction(scriptId, 'rowuao7ble9y', {
  "calendarId": "<id from list-options>",
  "eventId": "<id from list-options>"
})
```

### Get Free/Busy Information

- `action_version_id`: `row0ce18xwwk`
- List user availabilities schedules.
- fetch first: `calendar_id`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendar_id` | dropdown | yes | list-options |  |
| `date` | string | yes | your user |  |
| `timeZone` | dropdown | no | one of "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney", "Asia/Dubai", "Europe/Moscow", "America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "Africa/Johannesburg", "Asia/Singapore", "Europe/Madrid", "Asia/Hong_Kong" |  |

```js
const result = await runAction(scriptId, 'row0ce18xwwk', {
  "calendar_id": "<id from list-options>",
  "date": "<date>",
  "timeZone": "America/New_York"
})
```

A real sample of what this call returns:

```json
{
  "kind": "calendar#freeBusy",
  "timeMax": "2025-01-01T23:59:59.000Z",
  "timeMin": "2025-01-01T00:00:00.000Z",
  "calendars": {
    "<email_address>": {
      "busy": []
    }
  }
}
```

### List all Events

- `action_version_id`: `rowed1aqvhml`
- Retrieve events from a specific calendar using date range, search, visibility, and result limits.
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `date_mode` | dropdown | yes | one of "all", "relative", "fixed" |  |
| `relative_days` | number | yes | your user | only when date_mode = "relative" |
| `timeMin` | string | no | your user | only when date_mode = "fixed" |
| `timeMax` | string | no | your user | only when date_mode = "fixed" |
| `search_query` | string | no | your user |  |
| `event_types` | multiselect | no | one of "default", "birthday", "focusTime", "fromGmail", "outOfOffice", "workingLocation" |  |
| `timeZone` | dropdown | no | one of "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney", "Asia/Dubai", "Europe/Moscow", "America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "Africa/Johannesburg", "Asia/Singapore", "Europe/Madrid", "Asia/Hong_Kong" |  |
| `show_deleted` | boolean | no | one of true, false |  |
| `show_hidden_invitations` | boolean | no | one of true, false |  |
| `maxResults` | number | no | your user |  |

```js
const result = await runAction(scriptId, 'rowed1aqvhml', {
  "calendarId": "<id from list-options>",
  "date_mode": "all",
  "search_query": "<search_query>",
  "event_types": [
    "default"
  ],
  "timeZone": "America/New_York",
  "show_deleted": false,
  "show_hidden_invitations": false,
  "maxResults": 0
})
```

A real sample of what this call returns:

```json
{
  "events": {
    "id": "event_id",
    "end": {
      "dateTime": "2025-12-15T11:00:00Z",
      "timeZone": "Asia/Kolkata"
    },
    "etag": "etag",
    "kind": "calendar#event",
    "start": {
      "dateTime": "2025-12-15T10:00:00Z",
      "timeZone": "Asia/Kolkata"
    },
    "status": "confirmed",
    "creator": {
      "email": "email@example.com"
    },
    "iCalUID": "icaluid@example.com",
    "summary": "event_title",
    "sequence": 0,
    "eventType": "default",
    "organizer": {
      "email": "email@example.com"
    }
  }
}
```

### List Calendar Access Rules

- `action_version_id`: `rowpg3h8guxl`
- Show all calendar permissions
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |

```js
const result = await runAction(scriptId, 'rowpg3h8guxl', {
  "calendarId": "<id from list-options>"
})
```

A real sample of what this call returns:

```json
{
  "id": "user:sampleId",
  "etag": "etagValue",
  "kind": "calendar#aclRule",
  "role": "reader",
  "scope": {
    "type": "user",
    "value": "sampleEmail"
  }
}
```

### List Calendars

- `action_version_id`: `rowpcwuf3ry4`
- List all calendars

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `maxResults` | number | no | your user |  |
| `pageToken` | string | no | your user |  |
| `syncToken` | string | no | your user |  |
| `minAccessRole` | dropdown | no | one of "freeBusyReader", "reader", "writer", "owner" | applies when !syncToken |
| `showDeleted` | boolean | no | one of true, false |  |
| `showHidden` | boolean | no | one of true, false |  |

```js
const result = await runAction(scriptId, 'rowpcwuf3ry4', {
  "maxResults": 0,
  "pageToken": "<pageToken>",
  "syncToken": "<syncToken>",
  "minAccessRole": "freeBusyReader",
  "showDeleted": true,
  "showHidden": true
})
```

A real sample of what this call returns:

```json
{
  "id": "calendarId",
  "etag": "etagValue",
  "kind": "calendar#entry",
  "colorId": "1",
  "primary": true,
  "summary": "calendarSummary",
  "timeZone": "UTC",
  "accessRole": "owner"
}
```

### Remove Calendar Access Rule

- `action_version_id`: `row2q2u5ldkk`
- Remove a calendar access rule.
- fetch first: `calendarId`, `ruleId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `ruleId` | dropdown | yes | list-options |  |

```js
const result = await runAction(scriptId, 'row2q2u5ldkk', {
  "calendarId": "<id from list-options>",
  "ruleId": "<id from list-options>"
})
```

### Update Calendar

- `action_version_id`: `row5aa0n56o8`
- Edit calendar title & details
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | dropdown | yes | list-options |  |
| `summary` | string | yes | your user |  |
| `description` | string | no | your user |  |

```js
const result = await runAction(scriptId, 'row5aa0n56o8', {
  "calendarId": "<id from list-options>",
  "summary": "<summary>",
  "description": "<description>"
})
```

A real sample of what this call returns:

```json
{
  "id": "exampleId",
  "etag": "exampleEtag",
  "kind": "exampleKind",
  "summary": "exampleSummary",
  "timeZone": "UTC"
}
```

### Update Event

- `action_version_id`: `rowlp84wktjh`
- Edit an existing calendar event's date/time, attendees, location, and other settings.
- fetch first: `calendar_id`, `eventId`, `colorId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendar_id` | dropdown | yes | list-options |  |
| `eventId` | dropdown | yes | list-options (searchable) after calendar_id |  |
| `summary` | string | no | your user |  |
| `description` | string | no | your user |  |
| `attendees` | string | no | your user |  |
| `timeZone` | dropdown | no | one of "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney", "Asia/Dubai", "Europe/Moscow", "America/Toronto", "America/Mexico_City", "America/Sao_Paulo", "Africa/Johannesburg", "Asia/Singapore", "Europe/Madrid", "Asia/Hong_Kong" |  |
| `starttime` | string | no | your user |  |
| `startdate` | string | no | your user |  |
| `meeting_duration` | string | no | your user |  |
| `location` | string | no | your user |  |
| `status` | dropdown | no | one of "confirmed", "tentative", "cancelled" |  |
| `colorId` | dropdown | no | list-options |  |
| `recurrence` | dropdown | no | one of "RRULE:FREQ=DAILY", "RRULE:FREQ=WEEKLY", "RRULE:FREQ=MONTHLY", "RRULE:FREQ=YEARLY" |  |
| `useDefault` | boolean | no | one of true, false |  |
| `visibility` | dropdown | no | one of "default", "public", "private" |  |
| `transparency` | dropdown | no | one of "opaque", "transparent" |  |
| `guestsCanModify` | boolean | no | one of true, false |  |

```js
const result = await runAction(scriptId, 'rowlp84wktjh', {
  "calendar_id": "<id from list-options>",
  "eventId": "<id from list-options>",
  "summary": "<summary>",
  "description": "<description>",
  "attendees": "<attendees>",
  "timeZone": "America/New_York",
  "starttime": "<starttime>",
  "startdate": "<startdate>",
  "meeting_duration": "<meeting_duration>",
  "location": "<location>",
  "status": "confirmed",
  "colorId": "<id from list-options>",
  "recurrence": "RRULE:FREQ=DAILY",
  "useDefault": true,
  "visibility": "default",
  "transparency": "opaque",
  "guestsCanModify": true
})
```

A real sample of what this call returns:

```json
{
  "id": "uniqueId",
  "end": {
    "dateTime": "2025-12-15T12:45:00Z"
  },
  "etag": "123456",
  "kind": "event",
  "start": {
    "dateTime": "2025-12-15T12:30:00Z"
  },
  "status": "confirmed",
  "created": "2025-11-07T05:56:09Z",
  "creator": {
    "email": "example@gmail.com"
  },
  "iCalUID": "uniqueId@google.com",
  "summary": "Event Title",
  "updated": "2025-12-15T09:50:58Z",
  "htmlLink": "https://link.com",
  "sequence": 1,
  "organizer": {
    "email": "example@gmail.com"
  }
}
```

### Update Event Attendees

- `action_version_id`: `rowsefrzzuqw`
- Update attendees for an existing Google Calendar event. You can add or modify attendees and control whether they should be notified about the changes.
- fetch first: `calendar_id`, `event_id`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendar_id` | dropdown | yes | list-options |  |
| `event_id` | dropdown | yes | list-options (searchable) after calendar_id |  |
| `attendees` | string | yes | your user |  |
| `notify_attendees` | boolean | no | one of true, false |  |

```js
const result = await runAction(scriptId, 'rowsefrzzuqw', {
  "calendar_id": "<id from list-options>",
  "event_id": "<id from list-options>",
  "attendees": "<attendees>",
  "notify_attendees": true
})
```

A real sample of what this call returns:

```json
{
  "id": "eventId123",
  "end": {
    "dateTime": "2025-11-21T18:00:00+05:30",
    "timeZone": "Asia/Kolkata"
  },
  "etag": "\"etagValue\"",
  "kind": "event",
  "start": {
    "dateTime": "2025-11-21T16:30:00+05:30",
    "timeZone": "Asia/Kolkata"
  },
  "status": "confirmed",
  "created": "2025-11-19T12:18:34.000Z",
  "creator": {
    "email": "creator@example.com"
  },
  "iCalUID": "sampleUID@google.com",
  "summary": "Sample Meeting",
  "updated": "2025-11-20T11:57:55.586Z",
  "htmlLink": "https://www.google.com/calendar/event?eid=sampleEventId",
  "attendees": [
    {
      "email": "attendee1@example.com",
      "responseStatus": "needsAction"
    }
  ],
  "eventType": "default",
  "organizer": {
    "self": true,
    "email": "organizer@example.com",
    "displayName": "Organizer"
  }
}
```

## Triggers

Subscribing to an event means telling us **what to do when it fires**. That is a `code` handler:
a short script we run on our servers per event, with the event in `context.req.body`. Your server
is not in the path; the handler does the work itself. Decide from what the product wants:

| When the event fires, the product wants… | Handler |
| --- | --- |
| something to happen in another app the user connected (“new mail → post to Slack”) | **Template A**: run that app’s action |
| its own backend to know (“new mail → save it in our database”) | **Template B**: call your own API, with your own auth header baked in |
| both | one handler doing A, then B |
| raw events pushed to a public, unauthenticated endpoint of yours | `webhook: url` instead of `code` — the edge case; confirm with the developer before choosing it |

**Template A — run an action in another app.** The other app has its own document: fetch it for the
action’s `action_version_id` and fields, and enable that app once for this user at setup (its Step 1)
to get its `script_id`. Values the action needs picked (a channel, a sheet) are fetched with
`list-options` at setup too. Bake all of them into the string. The run URL takes no token: the
`script_id` is the credential, so the handler needs no secret. Map event keys from the sample
under each trigger below.

```js
// A string, not a function: it is sent to viaSocket and executed there.
// ${…} below are YOUR variables, baked in per user at subscribe time.
const handler = `
  const event = context.req.body
  const response = await fetch("https://flow.sokt.io/func/${otherAppScriptId}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action_version_id: "${otherAppActionVersionId}", // from the other app’s document
      inputData: {
        // that action’s fields, mapped from this event (keys as in the sample below)
        channel_id: "${channelIdPickedAtSetup}",
        text: "New mail from " + event.from + ": " + event.subject
      }
    })
  })
  const result = await response.json()
  // Envelope { success, data }, or the action's own body (which may carry its own success key).
  if ("data" in result ? !result.success : result.success === false) throw new Error(result.message || "action failed")
  return "data" in result ? result.data : result
`
```

**Template B — tell your own product.** Call your API from the handler with your own auth header
baked in. Your endpoint stays protected; nothing has to be public.

```js
const handler = `
  const event = context.req.body
  await axios.post("https://your-app.com/api/viasocket-events", { event, user_id: "${uniqueIdentifier}" }, {
    headers: { authorization: "Bearer ${apiKeyForThisUser}" }
  })
  return { delivered: true }
`
```

Then subscribe with it. Each trigger below shows this call with its own `inputData`:

```js
await subscribeEvent(uniqueIdentifier, '<trigger_version_id>', authId, inputData, { code: handler }, { user_id: uniqueIdentifier })
```

The edge case, only when the developer wants raw events on a public endpoint of theirs: pass
`webhook: 'https://your-app.com/webhooks/viasocket'` instead of `code`. We POST every event there
with `meta` attached, unauthenticated, so use `meta` to identify the user and treat the body as untrusted.

**Record every subscription you create.** The response gives you only the `script_id`, and
`listFlows` later returns id, title and status — not the `inputData` or the handler. So the only
way to know later *what* a user is subscribed to, with which settings and doing what, is your own
record, keyed by your user and the trigger. Save it in the same transaction as the subscribe call:

```json
{
  "unique_identifier": "<your user id>",
  "service_id": "rowkhibv5efp",
  "trigger_version_id": "<the trigger subscribed to>",
  "script_id": "<from the subscribe response>",
  "auth_id": "<the connection used>",
  "inputData": { "...": "exactly what was sent" },
  "delivery": { "code": "<the handler string>" },
  "created_at": "<timestamp>"
}
```

Check this record before subscribing again (same user, same trigger, same `inputData` means it
already exists), use its `script_id` to pause, resume, update or remove the subscription, and show
it to the user as “what is connected”. For a `webhook` subscription store `{ "webhook": "<url>" }`
as the delivery instead.

**How often we check.** Some triggers are polled rather than pushed. For those, `inputData` may
carry `scheduledTime`, the minutes between checks, as a string: `"5"` or `"15"`. Leave it out for
the default. It sits beside the event’s own fields:

```json
{ "channel_id": ["<id from list-options>"], "scheduledTime": "5" }
```


### New Event

- `action_version_id`: `rowzp3bk6y4u`
- Trigger when an new event is created.
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | multiselect | yes | list-options |  |

```js
// Subscribe once per user. Save the record described under Triggers: script_id, inputData, handler.
const subscriptionId = await subscribeEvent(
  uniqueIdentifier,
  'rowzp3bk6y4u',
  authId,
  {
    "calendarId": [
      "<id from list-options>"
    ]
  },
  { code: handler }, // what to do when it fires — a handler from the templates above
  { user_id: uniqueIdentifier }
)
```

A real sample of the event, as your handler receives it in `context.req.body`:

```json
{
  "id": "eventid",
  "end": {
    "dateTime": "2025-08-07T11:00:00",
    "timeZone": "UTC"
  },
  "etag": "eventetag",
  "kind": "calendar#event",
  "start": {
    "dateTime": "2025-08-07T10:00:00",
    "timeZone": "UTC"
  },
  "status": "confirmed",
  "creator": {
    "email": "creator@example.com"
  },
  "iCalUID": "icaluid@google.com",
  "summary": "Meeting",
  "organizer": {
    "email": "organizer@example.com"
  },
  "guestsCanModify": false
}
```

### New or Updated Event

- `action_version_id`: `rowekv04tj2b`
- Trigger when an event is created or updated.
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | multiselect | yes | list-options |  |

```js
// Subscribe once per user. Save the record described under Triggers: script_id, inputData, handler.
const subscriptionId = await subscribeEvent(
  uniqueIdentifier,
  'rowekv04tj2b',
  authId,
  {
    "calendarId": [
      "<id from list-options>"
    ]
  },
  { code: handler }, // what to do when it fires — a handler from the templates above
  { user_id: uniqueIdentifier }
)
```

A real sample of the event, as your handler receives it in `context.req.body`:

```json
{
  "id": "evt_12345",
  "end": {
    "dateTime": "2026-09-10T10:30:00Z",
    "timeZone": "UTC"
  },
  "start": {
    "dateTime": "2026-09-10T10:00:00Z",
    "timeZone": "UTC"
  },
  "status": "confirmed",
  "created": "2026-09-04T09:00:00Z",
  "creator": {
    "email": "creator@example.com"
  },
  "iCalUID": "evt_12345@google.com",
  "summary": "Demo Meeting",
  "updated": "2026-09-04T09:05:00Z",
  "htmlLink": "https://calendar.google.com/event?eid=evt_12345",
  "location": "Online",
  "sequence": 1,
  "attendees": [
    {
      "self": true,
      "email": "attendee@example.com",
      "responseStatus": "accepted"
    }
  ],
  "eventType": "default",
  "organizer": {
    "email": "organizer@example.com"
  },
  "reminders": {
    "useDefault": true
  },
  "calendarId": "primary",
  "description": "Short description",
  "conferenceData": {
    "conferenceId": "abc123"
  }
}
```

### New Upcoming Event

- `action_version_id`: `rowptlfifc2d`
- Runs the workflow automatically whenever any event on the selected calendar(s) is scheduled to start within the configured upcoming time window.
- fetch first: `calendarId`

| key | type | required | value comes from | only applies when |
| --- | --- | --- | --- | --- |
| `calendarId` | multiselect | yes | list-options |  |
| `minutesBefore` | number | no | your user |  |

```js
// Subscribe once per user. Save the record described under Triggers: script_id, inputData, handler.
const subscriptionId = await subscribeEvent(
  uniqueIdentifier,
  'rowptlfifc2d',
  authId,
  {
    "calendarId": [
      "<id from list-options>"
    ],
    "minutesBefore": 0
  },
  { code: handler }, // what to do when it fires — a handler from the templates above
  { user_id: uniqueIdentifier }
)
```

A real sample of the event, as your handler receives it in `context.req.body`:

```json
{
  "id": "evt_1",
  "end": {
    "dateTime": "2026-09-01T11:00:00+00:00",
    "timeZone": "UTC"
  },
  "start": {
    "dateTime": "2026-09-01T10:00:00+00:00",
    "timeZone": "UTC"
  },
  "status": "confirmed",
  "created": "2026-09-01T09:00:00.000Z",
  "summary": "Meeting",
  "updated": "2026-09-01T09:00:00.000Z",
  "htmlLink": "https://calendar.google.com/event?eid=evt_1",
  "attendees": [
    {
      "email": "user@example.com",
      "responseStatus": "needsAction"
    }
  ],
  "calendarId": "user@example.com",
  "hangoutLink": "https://meet.example/abc",
  "conferenceData": {
    "conferenceId": "abc-123"
  }
}
```

## Managing what a user already has

All four are scoped to the `unique_identifier` in the token, so they answer for one end user.

| call | what it is for |
| --- | --- |
| `GET https://flow-api.viasocket.com/projects/projj1a8ky8Q/integrations` | Every flow this user has. Match `service_id` to find an app they already enabled, and to recover a `script_id`. |
| `PUT https://flow-api.viasocket.com/embed/updatestatus/<script_id>?status=0` | Disable an enabled app, or end a trigger subscription. `status=1` re-enables. |
| `GET https://flow-api.viasocket.com/embed/authentications` | Every app this user has connected. |
| `DELETE https://flow-api.viasocket.com/embed/authentications/revoke/<auth_id>` | Disconnect an app. Disable its flows first. |

The flows list:

```json
{ "success": true, "data": { "flows": [
  {
    "title": "rowqm5xi2",
    "status": "active",
    "webhook": "https://flow.sokt.io/func/scriRx0PKDEG",
    "auth_id": "auth2c38gFVg_rowqm5xi2",
    "service_id": "rowqm5xi2",
    "id": "scriRx0PKDEG"
  }
] } }
```

`id` is the `script_id`. The list carries no `inputData` and no handler, so a subscription is not
identifiable from it alone: match `id` against the subscription records you saved (Triggers section).

The other two responses:

- `updatestatus` returns the **entire flow record** — its generated script, its whole
  `json_script`, its metadata. Ignore all of it and check `data.status`: `"0"` disabled,
  `"1"` active.
- `revoke` returns `{ "success": true, "message": "Successfully deleted authentication data",
  "data": [] }`. The empty array is normal; success is the signal.

## When it goes wrong

| symptom | cause |
| --- | --- |
| 401 / invalid token | Signed with the wrong secret, or the payload is missing `org_id` / `project_id` / `unique_identifier`. |
| Empty option list | `existingFields` is missing something this field depends on, or the `auth_id` belongs to a different `unique_identifier`. |
| Empty option list on a nested field | `fieldKey` was the leaf instead of the full path, or `existingFields` was flattened to dotted keys instead of nested. Both match nothing, and neither errors. |
| A field is ignored, or the record is created empty | An option’s `value` was altered before being used as a key (`name` sent for `name@longtext`), or a key was typed from a label. Keys are each option’s `value`, verbatim. |
| Empty option list, key looks right | Its casing is from another action of this app (`spreadsheet_id` vs `spreadsheet_Id`), or the request said `blockKey` instead of `fieldKey`. Compare with this action’s table, character for character. |
| `options.map is not a function` | The wrapped shape (`data.data`) was not normalised. |
| Picker empty, response is 200 with `data.response.status` 400 | The connection cannot be read: revoked, or the `auth_id` belongs to another `unique_identifier`. The message is in `data.response.data.message`; reconnect the app. |
| App rejects the action | An id was hardcoded instead of fetched, or two mutually exclusive keys were both sent — see the "only applies when" column. |
| Handler never runs | The subscription was created against a different `auth_id`, or `inputData` did not match the event (wrong label, wrong sheet). |
| Handler runs, the action inside it fails | The `script_id` baked into the handler belongs to another user, or that app was never enabled for this user; or the `inputData` keys do not match the other app’s document. Read the response `message`. |
| Someone asks for a webhook URL | Nobody needs one for “when X, do Y”: the handler does Y itself. A webhook is only for pushing raw events to a public endpoint the product chose to expose. |
| The same event fires twice | Subscribed twice for one user. Check the saved subscription record before subscribing; remove the duplicate with its `script_id`. |
| Connection appears lost | A different `unique_identifier` was used for the same end user. |
| Two script_ids for one app | `enableApp` ran without checking `findEnabledApp` first. |
