# Kajabi Customer Dashboard

Internal Next.js dashboard for syncing Kajabi purchases into Supabase and reviewing customer/payment status behind an admin login.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Postgres with server-side service-role access
- Supabase Auth email/password login with a signed dashboard session cookie
- Kajabi OAuth refresh-token flow via `https://api.kajabi.com/v1/oauth/token`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill in values:

   ```bash
   cp .env.example .env.local
   ```

3. Apply the Supabase schema in `supabase/migrations/001_initial_schema.sql`.

4. Start the app:

   ```bash
   npm run dev
   ```

5. In Supabase, create an admin user under **Authentication → Users**.

6. Open `http://localhost:3000/login` and sign in with the Supabase user's email and password.

7. For forgot-password emails, add these Supabase Auth redirect URLs:

   ```text
   http://localhost:3000/reset-password
   https://your-domain.com/reset-password
   ```

## Environment Variables

- `AUTH_COOKIE_SECRET`: long random string used to sign the admin session cookie.
- `ADMIN_EMAIL_ALLOWLIST`: optional comma-separated list of Supabase Auth emails allowed into the dashboard. If empty, any valid Supabase Auth user can sign in.
- `APP_URL`: public app origin used for password reset links, for example `http://localhost:3000` or `https://your-domain.com`.
- `KAJABI_CLIENT_ID`, `KAJABI_CLIENT_SECRET`, `KAJABI_REFRESH_TOKEN`: required for token refresh.
- `KAJABI_ACCESS_TOKEN`, `KAJABI_TOKEN_EXPIRES_AT`: optional bootstrap fallback.
- `KAJABI_SITE_ID`: optional site filter sent to Kajabi list endpoints.
- `KAJABI_WEBHOOK_SECRET`: optional bearer token required by `/api/kajabi/webhook/purchase`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase admin access.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Auth client settings. Use the project URL and publishable/anon key, not the service-role key.

## Supabase Auth

Create dashboard users in Supabase under **Authentication → Users**. The login page calls Supabase Auth with `signInWithPassword`, then creates a short-lived signed cookie for the dashboard. The service-role key is still used only for server-side dashboard reads/writes.

Forgot password uses Supabase Auth `resetPasswordForEmail` and redirects to `/reset-password`, where the user sets a new password.

## Supabase Schema

The migration creates:

- `kajabi_tokens`: secure server-side persisted Kajabi OAuth tokens.
- `kajabi_customers`: customer profile snapshots and raw JSON.
- `kajabi_offers`: offer snapshots and raw JSON.
- `kajabi_products`: product snapshots and raw JSON.
- `kajabi_purchases`: purchase/payment status records and raw JSON.
- `kajabi_purchase_products`: product relationships for each purchase.
- `sync_logs`: initial/latest sync audit records.

RLS is enabled and no anon policies are created. The app reads and writes through the server-only service-role client.

## Kajabi OAuth Notes

For every Kajabi request, `lib/kajabi/auth.ts` checks whether the access token is missing or expires within five minutes. If needed, it refreshes through `/v1/oauth/token` using `grant_type=refresh_token`, persists the new token in `kajabi_tokens`, and retries once if a request returns `401`.

Kajabi API calls are made only from server modules and route handlers. Access and refresh tokens are never sent to the browser.

## Sync

- `/api/kajabi/sync/customers`: fetches customer pages using `/v1/customers`.
- `/api/kajabi/sync/offers`: fetches offer pages using `/v1/offers`.
- `/api/kajabi/sync/products`: fetches product pages using `/v1/products`.
- `/api/kajabi/sync/purchases`: fetches all purchase pages using `/v1/purchases`, then fetches each purchase detail.
- `/api/kajabi/sync/batch`: fetches one page at a time for customers, offers, products, or purchases using `page[number]` and `page[size]`.
- `/api/kajabi/sync/initial`: legacy full purchase sync.
- `/api/kajabi/sync/latest`: fetches the newest updated pages and upserts records.
- All sync routes require an authenticated admin session.
- Sync jobs create `sync_logs` records and continue past individual record failures.
- Run the first full sync in this order: customers, offers, products, purchases. Purchase payloads often only include relationship IDs, so purchase rows are enriched from the already-synced customer and offer tables.

The dashboard buttons use the batch route with a page size of 200 and show a progress bar. This keeps each server request small enough for cPanel-style timeouts while the browser advances page by page.

## Webhook

`POST /api/kajabi/webhook/purchase` accepts Kajabi purchase JSON:API payloads. If `KAJABI_WEBHOOK_SECRET` is set, send:

```http
Authorization: Bearer <KAJABI_WEBHOOK_SECRET>
```

The endpoint upserts customer, offer, and purchase data when included in the payload and stores raw payload JSON on the purchase row.

## Deployment

- Set all environment variables in the hosting platform.
- Run the Supabase migration before first sync.
- Use HTTPS in production so secure cookies are sent.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, Kajabi tokens, or OAuth credentials to client-side code.

### cPanel Node.js Deployment

For the full domain-specific walkthrough using `auth.businessbydesign.space`, see `CPANEL_UPLOAD.md`.

1. In cPanel, open **Setup Node.js App**.
2. Create an app with:
   - Node.js version: 20 or newer.
   - Application mode: Production.
   - Application root: the folder where you upload this project.
   - Application startup file: `server.js`.
3. Upload the project files to the application root. Do not upload `.env.local` publicly.
4. In cPanel's Node app environment variables, add the values from `.env.local`. Set `APP_URL` to your HTTPS domain.
5. In Supabase, add `https://your-domain.com/reset-password` to **Authentication → URL Configuration → Redirect URLs**.
6. In cPanel Terminal or SSH, run:

   ```bash
   npm ci
   npm run build
   ```

7. Confirm the included `server.js` file exists in the application root.
8. In cPanel, click **Restart** for the Node.js app.
