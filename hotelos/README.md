# Hotelator OS

Hotel management (reservations, guests, rooms, housekeeping, maintenance, digital check-in, invoices) with **WhatsApp, Gmail, Slack, Google Sheets and Google Calendar automations built in through viaSocket Embed**.

This is the next version of the Hotelator booking frontend in the parent folder. It keeps the brand and adds a full property-management back office.

## Run it

```bash
cd hotelos
npm install
cp .env.example .env.local      # then add VIASOCKET_EMBED_SECRET
npm run dev                     # http://localhost:3000
```

- Hotel website: `/`. A booking made there fires the same automations as one made by the front desk.
- Admin: `/login` with `admin@hotelator.com` / `hotelator`.
- Demo data is seeded on first run into `.data/db.json`. `npm run reset-data` starts it fresh.

Without the viaSocket secret everything still works. Each automation step is logged as **skipped**, together with the exact `inputData` it would have sent (Automations → Logs).

## viaSocket setup

1. Get the embed secret: viaSocket dashboard → Integrations → your embed → **Install Code**. Put it in `.env.local` as `VIASOCKET_EMBED_SECRET` (server only, never commit it). `VIASOCKET_ORG_ID` and `VIASOCKET_PROJECT_ID` are already filled in.
2. Go to **App connections** (`/automations/settings`). For each app:
   - **Connect.** This opens the app's own sign-in, returns an `auth_id`, and enables the app to get a `script_id`. The `script_id` is stored server-side only.
   - **Pick** from your real account data (`list-options`): WhatsApp business account and phone number, Slack channel, spreadsheet and tab plus column mapping, calendar.
   - **Send test** to confirm the app works.
3. WhatsApp: **Subscribe to inbound messages**. This registers a handler that runs on viaSocket for each message and calls `/api/webhooks/whatsapp`, which is protected by a per-hotel secret. `NEXT_PUBLIC_APP_URL` must be a public URL (for example an https tunnel during local development). After changing it, click **Redeploy handler**.
4. **Automation Studio** (`/automations/studio`) mounts viaSocket's prebuilt UI. Hotels can build flows into any of 2,300+ apps and choose which Hotelator events trigger them.

All IDs and field keys come from the app documents saved in `../.claude/skills/viasocket-*/SKILL.md`. To refresh one, refetch `https://flow.viasocket.com/documentation/<service_id>.md?format=http&org=4160&project=projj1a8ky8Q`.

| App | service_id | Action / trigger used |
|---|---|---|
| WhatsApp Business Cloud | `row3icnwu2su` | Send Text Message `rowxosuf86ra` · Message Notification trigger `rowybkarcyoe` |
| Gmail | `rowo0bqrhj5g` | Send Email `rowwj0sfmhub` |
| Slack | `rowbu58rc` | Send Message `rowj2u3wc8h5` |
| Google Sheets | `rowqm5xi2` | Add New Row to Sheet `row5dxvkb0mr` |
| Google Calendar | `rowkhibv5efp` | Create Calendar Event `rown3bkuc5jc` |

## The 10 automations

| # | Trigger | Apps |
|---|---|---|
| 1 | Reservation created (admin or website) | WhatsApp, Gmail, Calendar, Sheets |
| 2 | Cron 09:00, arrivals in 3 days without online check-in | WhatsApp |
| 3 | Check-in (desk or digital) | Slack, WhatsApp |
| 4 | Checkout: invoice and review request | WhatsApp, Gmail, Sheets |
| 5 | Checkout: room marked dirty and a cleaning task created | Slack |
| 6 | Maintenance request | Slack |
| 7 | Guest WhatsApp message: routed to housekeeping, maintenance or info, with an auto-reply | WhatsApp, Slack |
| 8 | Payment failed | WhatsApp, Slack |
| 9 | VIP reservation | Slack, Calendar |
| 10 | Cron 00:00, daily occupancy report | Slack, Sheets |

Each one can be paused on the Automations page, and every run is logged with its payload and response. Studio flows run on the events you pick for them.

## Architecture

- **Next.js 14 App Router + Tailwind.** Server components read the store directly; client components call `/api/*` and then `router.refresh()`.
- **`src/lib/db.ts`** is a single JSON document, persisted to disk. Swap it for Supabase/Postgres later without touching the routes.
- **`src/lib/viasocket/`**
  - `client.ts`: token signing, enable, list-options, run, subscribe, pause, revoke.
  - `apps.ts`: IDs and pickers.
  - `handlers.ts`: the handler code that runs on viaSocket.
  - `view.ts`: the browser-safe view of connections.
- **`src/lib/automations/`**: the 10 automations, the `safeRun()` logger, and one input builder per action.
- **Payments** use a demo gateway (pay or simulate a decline). Replace `recordPayment` with Razorpay order + verify for production.
- **Cron**: `vercel.json` schedules both jobs, authorized with `Authorization: Bearer $CRON_SECRET`. Admins can also click **Run now**.

Things to know before production:
- On Vercel the JSON store lives in `/tmp` and is not durable, so move to a real database.
- Uploaded IDs and photos are kept as data URLs. Move them to object storage.
- WhatsApp free-text messages only reach guests inside Meta's 24-hour window. Use approved templates for business-initiated messages.
