---
name: viasocket-embed
description: >-
  Mount viaSocket’s prebuilt integrations UI inside this product — a ready-made screen for every
  app in the catalog with the connect flow, the action list and a working form for each — as a
  component in any box, configured from this product’s own code. Use only when the developer wants
  the forms ready-made instead of built, or when end users design their own automations. A flow the
  developer has already defined ("when X, do Y") is the Apps API, not this.
---

# The prebuilt UI

> Source: https://flow.viasocket.com/documentation/embed.md?org=4160&project=projj1a8ky8Q. Public, no sign-in. Fetch it
> again for the latest version of this file.

Every app, every action, every form, already built: viaSocket renders the whole integration
experience inside your product. Your code mounts one script with a per-user token, tells it how to
look and behave, and listens for what the user publishes. There is no per-app code, and you never
hold a third-party credential.

**It is configured from your code.** Everything — which apps it offers, whether it runs in
agent-tools mode, whether your own product is the first app — is a `config`
object your page passes. What you save on the viaSocket dashboard is only the default for keys
your code does not set. Nothing has to be configured on the dashboard.

| At a glance |  |
| --- | --- |
| Runs on | The same embed, ids and token as the Apps API. Nothing extra is created. |
| Your users | Connect their own apps and build their own flows in our UI, inside your product |
| You write | A box in your own UI, one script tag, one `config` object, one message listener |
| You store | Depends on what they build — section 6 |

## When to use it, and when not

Use the prebuilt UI in exactly two situations:

1. The developer wants the forms without building them: "prebuilt", "ready-made", "a template",
   "every app’s every action, we don’t want to render it".
2. End users design their own automations across apps, and this product’s code has no say in
   what those are.

In every other case build with the Apps API and this product’s own screens. In particular:

| The request | Build it with |
| --- | --- |
| "When a new mail arrives, post it to Slack" — a defined flow | The Apps API: https://flow.viasocket.com/documentation/<service_id>.md |
| "Let users pick a spreadsheet in our settings" — a picker | The Apps API: connect + `list-options` |
| "Every app in our own UI" — a catalog page in the product’s design | The Apps API + the catalog API: https://flow.viasocket.com/documentation/catalog-api.md |
| "Give users a ready-made integrations screen" | This document |
| "Let users automate anything between their apps" | This document |

## Rules that are not negotiable

1. **The signing secret stays on your server.** Every embed token is signed there, per user, on
   demand. The browser gets one token for one page load and never the secret.
2. **One `unique_identifier` per end user, forever.** Every connection and flow is isolated by it;
   change it and the user appears to have lost everything.
3. **Check `event.origin` before trusting a message** from the embed. It is always
   `https://embedfrontend.viasocket.com`.
4. **Key everything you store by `flow.id`.** It is stable across every event for that flow.
5. **A flow URL runs the user’s apps.** Store it server-side like a credential; never ship it to the browser.
6. **Nothing is created on viaSocket for this.** The embed exists; you need its two ids and its secret,
   from the developer. There is no login token in this work.
7. **A mount always comes with a `flow` listener, and opens on the app the request names.** Decide
   what the product stores (section 6) before mounting; a mount alone is unfinished.

## 1. Your ids

This document was generated for embed `projj1a8ky8Q` in organisation `4160`. Put both in your server-side environment as `VIASOCKET_ORG_ID` and `VIASOCKET_PROJECT_ID`.

Ask for the signing secret the same way and have the developer put it in `.env` as `VIASOCKET_EMBED_SECRET`.
Never write it into a file in the repo.

## 2. The embed token (per end user)

A JWT your backend signs with the org secret. The three claims are the whole payload.

```text
algorithm: HS256
payload:   { "org_id": "4160", "project_id": "projj1a8ky8Q", "unique_identifier": "<your stable id for this user>" }
secret:    VIASOCKET_EMBED_SECRET
```

```js
// Node. Any language’s JWT library does the same three-claim HS256 sign.
import jwt from 'jsonwebtoken'
export function embedToken(uniqueIdentifier) {
  return jwt.sign(
    { org_id: process.env.VIASOCKET_ORG_ID, project_id: process.env.VIASOCKET_PROJECT_ID, unique_identifier: uniqueIdentifier },
    process.env.VIASOCKET_EMBED_SECRET
  )
}
```

Expose it as an endpoint on your backend that only the signed-in user can call, and have the page
fetch it right before mounting the UI.

## 3. Mount it — a component in a box of yours

The prebuilt UI is one thing: a component that fills whatever element it is given. Your page decides
the box — a settings page, a tab, a drawer, a modal — and your own UI opens and closes that box. The
runtime draws nothing outside it: no header, no button, nothing floating over your page.

**A mount is two things, always: the component and a `flow` listener.** Without the listener
the user can build, pause and delete flows and your product never learns of it — nothing to
store, show or act on. And when the request names an app, open on it: the user should not have
to find Slack in a catalog of 2,300 to do the Slack thing they came for.

```html
<!-- Wherever your product wants it: a page, a tab, your own drawer or modal. Give it a height. -->
<div id="integrations" style="height: 640px"></div>

<script src="https://embed.viasocket.com/prod-embedcomponent.js"></script>
<script>
  const embedToken = await fetch("/api/viasocket/token").then((r) => r.text()) // per user, from your backend
  const embed = viaSocket.mount({
    embedToken,
    parent: "#integrations",
    config: {}
    // The request names an app? Start the user on it (its service_id from the catalog search):
    // open: { serviceId: "<service_id>" }
  })

  // Not optional: what the user builds reaches your product only through this.
  embed.on("flow", (flow) => {
    // flow.action: initiated | published | updated | paused | deleted
    // Every field is in section 5; what to store for your configuration is section 6.
  })
</script>
```

Decide the mount from the request:

| The request | Mount with |
| --- | --- |
| names one app — "let users automate their Slack" | `open: { serviceId }` and, unless they want the whole catalog, `config.filteredServices` with only that app |
| names nothing — "an integrations screen" | the defaults: the catalog |
| "tools for our AI agent" | `config: { chatbot: true }` |
| "our product as the first app" | `config: { serviceId: "<your connector>", serviceType: "both" }` |
| one flow, or a template | `open: { flowId }` · `open: { templateId }` |

Or declaratively — the script tag with attributes. `parentId` names the box and `config` is the same object as
JSON, with `"type": "all_space"` said explicitly: the attribute form predates the component and does not imply it.

```html
<div id="integrations" style="height: 640px"></div>
<script
  id="viasocket-embed-main-script"
  src="https://embed.viasocket.com/prod-embedcomponent.js"
  embedToken="<token from your backend for this user>"
  parentId="integrations"
  config='{"type":"all_space"}'>
</script>
```

The runtime API, on `window.viaSocket`:

| call | what it does |
| --- | --- |
| `viaSocket.mount({ embedToken, parent, config, open? })` | Mounts the component in `parent` (an element or a selector) and returns it. Several boxes on one page: call it once per box. `open` takes the options of `embed.open` below, for a component that should start on one flow, a template or one app. |
| `embed.update(config)` | Changes config at runtime; the UI picks it up without a reload. |
| `embed.on("flow", fn)` | A typed listener for the events in section 5. `"ready"` and `"error"` also fire. |
| `embed.open(flowId, options?)` | Jump to one flow, or open with the options below (a template, a prefilled connection, sample data). |
| `embed.send(data)` | Arbitrary data to the UI. |
| `embed.destroy()` | Remove it from the page — when your drawer or modal is torn down. |

Options of `embed.open(flowId?, options?)` — also accepted as `open: { flowId, ... }` on `mount`. All optional,
and the same ones a page written against the previous runtime passes to `openViasocket(flowId, options)`:

| option | type | what it does |
| --- | --- | --- |
| `flowId` | string | Open a specific flow directly instead of the flow list. |
| `flowHitId` | string | Open the embed on a particular flow execution log. |
| `dummy_payload` | object | Sample JSON payload so your users get auto-suggestions while mapping fields. |
| `meta` | string | Extra metadata to store with the flow — user plan, source, internal tags. |
| `create_default_flow_with_api` | boolean | Create and open a default API-type flow straight away. |
| `create_default_flow_with_function` | boolean | Create and open a default Function-type flow straight away. |
| `templateId` | string | Create a flow from an existing template instantly. |
| `serviceId` | string | Open a specific integration/service inside the embed. |
| `configurationJson` | object | Prefill the connection and input fields for your integration. |
| `configurationJsonEncrypted` | string | Same as configurationJson but encrypted — use this in production. |
| `embed_in_llm` | boolean | Controls whether "Fill with AI" is available to the user inside the embed. |
| `config` | object | Any key from section 4, applied first. |

The token is per user and per page load. Never sign it in the browser. Give the box a height: the
component fills its parent, and a parent with no height is an empty strip.

## 4. Configure it from your code

Precedence, lowest to highest: the runtime’s defaults, what the dashboard saved for the embed, then
what your code passes. So the dashboard is a place to set defaults for every page, and your code is
the source of truth wherever it says something. Keys your code does not mention keep their saved
value.

| key | type | default | what it does |
| --- | --- | --- | --- |
| `pageheading` | string | `"Integration"` | **The noun the UI uses for one thing a user builds — singular.** It is written into every title: "Add New {pageheading}", "Enabled {pageheading}s", "Customized {pageheading}s", "Add Custom {pageheading}". `"Automation"` reads "Add New Automation / Enabled Automations". A sentence here breaks every title; a sentence goes in `pagesubheading`. |
| `pagesubheading` | string | `"Enhance your experience with a diverse range of powerful integrations."` | The line under the title on the catalog screen, and in the empty state when the user has nothing yet. |
| `showSubHeading` | boolean | `true` | `false` drops that line. |
| `helpdoclink`, `helpdoctitle` | string, string | none | A link at the top right, opened in a new tab. Both are needed or nothing shows. |
| `showEnabled` | boolean | `true` | Land on the user’s own list — "Enabled {pageheading}s" (one row per app they enabled) and "Customized {pageheading}s" (flows they built) — with a way into the catalog. `false` lands on the catalog. **The list shows every flow of this user in this embed, including the ones the Apps API created** (`enable`, `subscribe-event`; they are titled by service id). Mounting this UI on an embed the product also uses through the API for the same users means `showEnabled: false`, or a second embed for the UI. |
| `showServices` | boolean | `true` | Show the app catalog. Off means only what `filteredServices` allows. |
| `filteredServices` | object | `{}` (everything) | Restrict the catalog: `{ "<service_id>": { "<event rowid>": true } }` — an app is offered once it has at least one action or trigger listed. Ids come from the catalog API (each row’s `rowid`, not its version id). |
| `categories` | string[] | `[]` | Restrict the catalog to these app categories. |
| `hideApps` | boolean | `false` | Hide the whole catalog (search and grid). What remains is whatever the other keys turn on: templates, featured combinations, the webhook / API / function cards. |
| `hideWebhook` | boolean | `false` | Hide the "Webhook" **and** the "Repeater/Scheduler" cards — one flag for both. |
| `hideApi` | boolean | `false` | Hide the "HTTP/API Request" card. |
| `hideFunction` | boolean | `false` | Hide the "Custom Logic (JS)" card **and** the dashed "Add Custom {pageheading}" card. |
| `showAskAItoFlow` | boolean | `false` | An "Ask AI" button beside the search box: the user describes what they want and a flow is drafted for them. |
| `showTemplates`, `templatesHeading` | boolean, string | `false`, none | A row of ready-made templates under the catalog, with its own heading. |
| `showFeautedCombinations`, `featuredCombinationType`, `featuredCombinations` | boolean, `"default"` \| `"custom"`, object | `false`, `"default"`, `{}` | App pairs pinned at the top. **The first key is spelled exactly like that (`Feauted`)** and gates the other two — without it `featuredCombinationType` does nothing. `"default"` pins viaSocket’s picks; `"custom"` shows `featuredCombinations` in the shape the dashboard’s Configuration page saves. |
| `chatbot` | boolean | `false` | **Agent-tools mode.** Every published flow also carries `mcpToolJson` and `openaiToolJson`, and the user gets "Fill with AI" while building. Set it when the flows are tools for your AI agent. |
| `llm_referring_text` | string | `"Fill with AI"` | With `chatbot`: the label of that checkbox, so it can name your assistant ("Let Acme fill this in"). |
| `serviceId`, `serviceName`, `serviceType` | string, string, `"trigger"` \| `"both"` | `"webhook"`, `"webhook"`, `"trigger"` | **Your own product as the first app.** Set `serviceId` to your connector’s service id (from Plug Builder) and `serviceType` to `"both"`: flows then start from an event in your product, or in any app the user connects. |
| `directFlow` | boolean | `false` | Skip the list and open a new flow at once. Pair it with `serviceId` or a single `permittedEvents` entry. |
| `permittedEvents` | `"all"` \| string[] | `"all"` | With your own connector: which of its events the user may start from. |
| `hideadvancedflowbutton` | boolean | `false` | Inside a flow: hide the switch from the simple form to the advanced multi-step editor. |
| `themeJson` | object | none | CSS variables applied to the UI, e.g. `{ "--primary-color": "#1B3FA0", "--font-family": "Inter" }`. Only variables the UI defines take effect. |

### What the user sees first

With `showEnabled: true` (the default): their own list — "Enabled {pageheading}s", one row per app
they enabled, and "Customized {pageheading}s", the flows they built — and, when it is empty, one
card with the subheading and a "Browse integrations" button. From there, the catalog.

With `showEnabled: false`: the catalog straight away — "Add New {pageheading}", the subheading, a
search box, the app grid, and the Webhook / Repeater / HTTP request / Custom logic cards, each of
which has a `hide…` key above.

Under the list screen there is a footer strip — "2,300+ Available Apps · 100% Secure · 24/7 Support".
The first cell goes away when `filteredServices` narrows the catalog; the strip itself has no key.

Three configurations cover what used to be three separate kinds of embed:

| you want | config |
| --- | --- |
| Your users build flows that your code runs (webhook trigger, one URL per flow) | `{}` — the default |
| Your users set up tools for your AI agent | `{ "chatbot": true }` |
| Your own product as the first app, flows between it and the user’s apps | `{ "serviceId": "<your connector>", "serviceName": "<its slug>", "serviceType": "both" }` |

Change it at runtime — a settings toggle, a different page, a different plan:

```js
embed.update({ chatbot: true, filteredServices: { "<service_id>": { "<event_id>": true } } })
```

## 5. Listen for what the user publishes

The embed posts a message to the parent window on every change to a flow.

```html
<script>
  window.addEventListener('message', (event) => {
    if (event.origin !== "https://embedfrontend.viasocket.com") return;
    const flow = event.data;
    if (!flow?.id) return;
    // flow.action -> initiated | published | updated | paused | deleted
    // flow.webhookurl, flow.payload, flow.mcpToolJson, flow.openaiToolJson, flow.title, flow.serviceIcons
    // What to do with each is section 6.
  });
</script>

<!-- Or the typed listener, same events, bound to one component: -->
<script>
  embed.on('flow', (flow) => { /* same object */ })
</script>
```

| `action` | `status` | What happened |
| --- | --- | --- |
| `initiated` | `drafted` | A user started building a flow. No webhook URL is live yet. |
| `published` | `active` | A user published the flow. This is the event where you store the URL. |
| `updated` | `active` | A published flow was edited. Only fires for already-active flows. |
| `paused` | `paused` | A user paused the flow. Stop calling the URL until it is active again. |
| `deleted` | `deleted` | A user deleted the flow. Drop the stored URL. |

Every field on the message:

| field | meaning |
| --- | --- |
| `webhookurl` | The URL to call to run this flow. This is the value you need to store. |
| `action` | Which event this is: initiated \| published \| updated \| paused \| deleted. |
| `status` | Flow state after the event: drafted \| active \| paused \| deleted. |
| `id` | The flow id. Use it as your storage key — it is stable across events. |
| `title` | Flow title your user typed. |
| `description` | Flow description your user typed. |
| `payload` | The request body this flow expects, derived from what the user mapped. |
| `sampleDataFromTriggerInBody` | Sample trigger data, useful for showing your users an example. |
| `mcpToolJson` | MCP tool definition (name, description, inputSchema) for this flow. |
| `openaiToolJson` | The same schema shaped as an OpenAI function tool. |
| `staticVariables` | Static variables saved on the published flow. |
| `detailedUsedVariables` | Detailed breakdown of the variables the flow consumes. |
| `serviceIcons` | Icon URLs of the apps used in the flow, for rendering it in your own UI. |
| `metadata` | Whatever you passed as `meta` when opening the embed. |

## 6. Use what they built

What a published flow is for follows from the configuration you mounted with. One of these three:

### Your code runs the flow (the default configuration)

On `published` and `updated`, store `flow.webhookurl` and `flow.payload` against the user, keyed by
`flow.id`. When the event happens in your product, POST to that URL with a body in the shape
`payload` described. The response body is the flow’s output.

```js
// Run a flow your user published.
// Use the exact URL you received in flow.webhookurl. It always looks like this,
// where <flow_id> is the flow.id from the same event:

await fetch('https://flow.sokt.io/func/<flow_id>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // Use the shape you received in flow.payload for this specific flow.
    order_id: '12345',
    customer_email: 'jane@example.com'
  })
});
```

Every flow URL looks like `https://flow.sokt.io/func/<flow_id>`. Stop calling it on `paused`; delete your record on `deleted`.
The listener for exactly this:

```html
<script>
  window.addEventListener('message', (event) => {
    // Always check the origin before trusting the message.
    if (event.origin !== "https://embedfrontend.viasocket.com") return;

    const flow = event.data;
    if (!flow?.id) return;

    // What you get:
    //   flow.id         -> stable id, use it as your storage key
    //   flow.webhookurl -> https://flow.sokt.io/func/<flow_id>  (POST here to run the flow)
    //   flow.status     -> drafted | active | paused | deleted
    //   flow.payload    -> the request body this flow expects
    //   flow.title      -> the name your user gave it

    switch (flow.action) {
      case 'published':
      case 'updated':
        // YOUR CODE: save flow.webhookurl against this user, keyed by flow.id.
        // This URL is the only way to run the flow — if you don't store it, nothing works.
        break;

      case 'paused':
        // YOUR CODE: keep the record, but stop calling the URL.
        break;

      case 'deleted':
        // YOUR CODE: delete your stored record for flow.id.
        break;

      case 'initiated':
        // User has only started building — no live URL yet. Usually ignore.
        break;
    }
  });
</script>
```

### The flows are tools for your agent (`chatbot: true`)

On `published` and `updated`, store `flow.openaiToolJson` (or `flow.mcpToolJson` for an MCP server)
and `flow.webhookurl`, keyed by `flow.id`, for that user. Register the stored tools with your agent
for that user. When the model calls one, POST the arguments it produced to the flow’s URL and
return the response body as the tool result.

```js
// 1. Give your model the tool definitions you captured.
//    Pass the flow.openaiToolJson values you stored as the model's "tools" array
//    (or flow.mcpToolJson if you're exposing them through an MCP server).

// 2. When the model calls one, POST the arguments it produced to that flow's URL.
//    Look up the URL you stored for that tool — it always looks like this:

const response = await fetch('https://flow.sokt.io/func/<flow_id>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(argumentsFromTheModel)
});

// 3. The response body is the flow's output — return it to the model as the tool result.
const result = await response.json();
```

Remove the tool on `paused` and `deleted`. `openaiToolJson` is `{ type: "function", function: { name,
description, parameters } }`; `mcpToolJson` is `{ name, description, inputSchema }`. Both are generated
from what the user mapped, so the schema is exactly the body the flow expects. The listener for this:

```html
<script>
  window.addEventListener('message', (event) => {
    // Always check the origin before trusting the message.
    if (event.origin !== "https://embedfrontend.viasocket.com") return;

    const flow = event.data;
    if (!flow?.id) return;

    // What you get, already built for you:
    //   flow.mcpToolJson    -> { name, description, inputSchema }
    //   flow.openaiToolJson -> { type: 'function', function: { name, description, parameters } }
    //   flow.webhookurl     -> https://flow.sokt.io/func/<flow_id>  (POST the tool arguments here)

    switch (flow.action) {
      case 'published':
      case 'updated':
        // YOUR CODE: store the tool definition + flow.webhookurl, keyed by flow.id,
        // then expose it to your agent as an available tool.
        break;

      case 'paused':
      case 'deleted':
        // YOUR CODE: remove this tool so your agent stops offering it.
        break;

      case 'initiated':
        // Still being built — no schema worth registering yet.
        break;
    }
  });
</script>
```

### Your product is the first app (`serviceId` set to your connector)

Nothing has to be stored: viaSocket runs these flows, from the event in your product or in the
user’s app. Use the events to show state in your own UI (a badge, a list of the user’s automations).
Your product has to be published as a connector in Plug Builder first; the `serviceId` is its service
id there. Do not use a public app’s id.

When your product already knows the connection or the values a flow should start with, pass them
when opening so the user does not type them again:

```js
viaSocket.open(undefined, {
  serviceId: "<the app to open>",
  configurationJson: {
    ...
  }
})
```

The shape of `configurationJson`:

```json
{
  "authValues": { },    // Credentials
  "stepId": {
    "key": "action_name",
    "inputValues": { }  // Pre-filled data for this step
  }
}
```

```json
"authValues": {
  "api_key": "your_api_key_here",
  "workspace_id": "workspace_123"
}
```

In production send `configurationJsonEncrypted` instead: the same JSON, AES-encrypted with your org
secret so credentials never travel in clear text through the browser. The Node version:

```js
const crypto = require('crypto');

function encryptMessage(message, secret_key) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);

  const keyBytes = crypto.pbkdf2Sync(secret_key, salt, 100000, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-cfb', keyBytes, iv);
  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return Buffer.concat([salt, iv, Buffer.from(encrypted, 'base64')]).toString('base64');
}

const configurationJson = {
  authValues: { "field1": "field value" },
  inputValues: { "field1": "field value" }
};

// pass the secret key that you got while jwt token generation
const secret_key = "your-secret-key";

const encrypted = encryptMessage(JSON.stringify(configurationJson), secret_key);

console.log('Encrypted:', encrypted);
```

The dashboard’s Developer Guide has the same routine in Python, Java, PHP and Ruby.


## 7. Manage what a user built

All of these take the user’s embed token as the `authorization` header, so they answer for that user only.

| call | what it is for |
| --- | --- |
| `GET https://flow-api.viasocket.com/projects/projj1a8ky8Q/integrations` | Every flow this user has in this project, with status and URL. |
| `PUT https://flow-api.viasocket.com/projects/updateflowembed/<flow_id>` | Rename a flow or change its `meta`: body `{ title, description, meta }`. |
| `PUT https://flow-api.viasocket.com/embed/updatestatus/<flow_id>?status=0` | Pause a flow. `status=1` resumes it. |
| `GET https://flow-api.viasocket.com/embed/authentications` | Every app this user has connected. |
| `DELETE https://flow-api.viasocket.com/embed/authentications/revoke/<auth_id>` | Disconnect an app. Pause the flows built on it first. |

## Verify before you say it works

1. Sign a token for a test user (section 2) and load the page: the UI renders inside your box and shows the app list.
2. Change one config key from code (`embed.update({ chatbot: true })`): the UI picks it up without a reload.
3. Build and publish one flow as the test user: your listener receives `published` with a `webhookurl`.
4. Do the thing section 6 says for your configuration — POST to the URL, call the tool, or trigger the flow — and see the response.
5. Pause it in the UI: your listener receives `paused`.

Report what actually came back; do not describe a step as working that you did not run.

## When it goes wrong

| symptom | cause |
| --- | --- |
| The UI shows "Could not load" or a blank box | The token was signed with the wrong secret, or a claim is missing or misspelt (`org_id`, `project_id`, `unique_identifier`). |
| Nothing shows | The box has no height — the component fills its parent. Give the box a height. Or `config` on the script tag is not valid JSON in single quotes. |
| It floats over the page instead of filling the box | No `parent` was given and a saved dashboard setting chose a floating `type`. Pass `parent` (or `parentId`); with a parent the component form wins. |
| A config key seems ignored | It is a saved default and your code did not set it — check the object you pass, not the dashboard. `serviceId` needs `serviceType: "both"` with it. |
| No message arrives | The listener checks the wrong origin, or is attached after the user published. Attach it before mounting. |
| A user cannot see their flows | A different `unique_identifier` was used for the same person. |
| POST to the flow URL fails | The body does not match `payload`, or the flow is `paused` / `deleted`. |
| Your connector does not appear | It is not published in Plug Builder, or `serviceId` is a public app’s id rather than yours. |

## Appendix — the runtime’s own floating overlays (legacy)

Pages written against the previous runtime let it float the UI over the page — a slider from the
right or left, a popup — hidden until `openViasocket()` and closed with `handleclose()`. That still
works, unchanged. A new integration does not need it: mount the component in your own drawer or
modal and let your UI open and close that. Documented here so an existing page can be read.

| key | type | default | what it does |
| --- | --- | --- | --- |
| `type` | `"all_space"` \| `"right_slider"` \| `"left_slider"` \| `"popup"` | `"all_space"` when a `parent` is given | `all_space` is the component. The others make the runtime float the UI over the page itself and hide it until `viaSocket.open()`. |
| `height`, `heightUnit`, `width`, `widthUnit` | number, `"px"` \| `"%"` | `100 %`, `40 %` | Size of a floating UI. A component takes its box’s size. |
| `buttonType`, `buttonName` | `"custom"` \| `"default"`, string | `"custom"`, `"Integrations"` | `default` adds a floating open button with that label. |
| `backdrop` | boolean | `false` | Dim the page behind a floating UI and close it on a click outside. |

```html
<button onclick="viaSocket.open()">Integrations</button>
<script src="https://embed.viasocket.com/prod-embedcomponent.js"></script>
<script>
  viaSocket.init({ embedToken, config: { type: "right_slider", width: 480, widthUnit: "px" } })
  // viaSocket.close() hides it again; the old globals openViasocket / handleclose do the same.
</script>
```
