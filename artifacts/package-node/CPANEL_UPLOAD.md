# cPanel Upload Guide

This app is a server-rendered Next.js dashboard. If you want login, reset password, admin, and the dashboard all on one domain, the Node.js app should run on:

```text
https://businessbydesign.space
```

Use these routes:

```text
https://businessbydesign.space/login
https://businessbydesign.space/forgot-password
https://businessbydesign.space/reset-password
https://businessbydesign.space/dashboard
https://businessbydesign.space/customers
```

Do not upload the frontend-assets zip as a standalone dashboard. It only contains static browser assets used by the Node.js app. For a single-domain setup, deploy the Node.js zip to `businessbydesign.space`.

## 1. Prepare Supabase

1. Open Supabase.
2. Go to **Authentication → Users**.
3. Create your admin user.
4. Go to **Authentication → URL Configuration**.
5. Set or confirm these values:

   ```text
   Site URL: https://businessbydesign.space
   Redirect URLs:
   https://businessbydesign.space/reset-password
   http://localhost:3000/reset-password
   ```

6. Go to **SQL Editor**.
7. Run the migration from:

   ```text
   supabase/migrations/001_initial_schema.sql
   ```

   Run it again after uploading a new build if the migration changed. The SQL uses `create table if not exists`, so it is safe to rerun and will add the product tables when missing.

## 2. Point the Domain to the Node.js App in cPanel

1. Open cPanel.
2. Go to **Domains**.
3. Confirm `businessbydesign.space` points to the folder you want to use for the Node app, for example:

   ```text
   /home/YOUR_CPANEL_USER/businessbydesign.space
   ```

4. Enable SSL for the domain in **SSL/TLS Status** or **AutoSSL**.

## 3. Create the Node.js App

1. Open **Setup Node.js App** in cPanel.
2. Click **Create Application**.
3. Use:

   ```text
   Node.js version: 20 or newer
   Application mode: Production
   Application root: businessbydesign.space
   Application URL: businessbydesign.space
   Application startup file: server.js
   ```

4. Save the app.

## 4. Upload the Node.js Zip

Generate the upload zip before downloading or uploading it:

```bash
npm run package:cpanel
```

This creates:

```text
artifacts/kajabi-customer-nodejs.zip
```

1. Open **File Manager**.
2. Go to the Node app root folder:

   ```text
   /home/YOUR_CPANEL_USER/businessbydesign.space
   ```

3. Upload `kajabi-customer-nodejs.zip`.
4. Extract it in that folder.
5. Confirm these files are directly inside the app root:

   ```text
   server.js
   package.json
   package-lock.json
   .next/
   public/
   src/
   supabase/
   ```

Do not upload `.env.local`.

## 5. Add Environment Variables in cPanel

In **Setup Node.js App → Environment Variables**, add:

```env
NODE_ENV=production
APP_URL=https://businessbydesign.space
AUTH_COOKIE_SECRET=use-a-long-random-secret
ADMIN_EMAIL_ALLOWLIST=your-admin-email@example.com

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key

KAJABI_CLIENT_ID=your-kajabi-client-id
KAJABI_CLIENT_SECRET=your-kajabi-client-secret
KAJABI_REFRESH_TOKEN=your-kajabi-refresh-token
KAJABI_SITE_ID=
KAJABI_WEBHOOK_SECRET=
```

Keep `SUPABASE_SERVICE_ROLE_KEY`, Kajabi credentials, and `AUTH_COOKIE_SECRET` server-only.

## 6. Install Dependencies and Build

In cPanel **Terminal** or SSH:

```bash
cd /home/YOUR_CPANEL_USER/businessbydesign.space
npm ci
npm run build
```

If cPanel already runs `npm install` for the Node app, still run `npm run build` after env vars are set.

## 7. Restart the Node App

1. Go back to **Setup Node.js App**.
2. Open the `businessbydesign.space` app.
3. Click **Restart**.
4. Open:

   ```text
   https://businessbydesign.space/login
   ```

5. Sign in with the Supabase Auth user you created.

## 8. Optional: Redirect an Admin Path

If you want:

```text
https://businessbydesign.space/admin
```

to open the dashboard, add a redirect in cPanel:

```text
Source: https://businessbydesign.space/admin
Target: https://businessbydesign.space/login
Type: 302 or 301
```

## 9. Troubleshooting

- `Could not find table public.kajabi_customers`: run the Supabase migration in the same project used by `SUPABASE_URL`.
- `Could not find table public.kajabi_products` or `public.kajabi_purchase_products`: rerun `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor.
- Login fails: confirm the user exists in **Supabase → Authentication → Users** and the email is included in `ADMIN_EMAIL_ALLOWLIST`.
- Forgot password link fails: confirm Supabase redirect URLs include `https://businessbydesign.space/reset-password`.
- Blank or broken CSS: confirm `.next/static/` and `public/` are present in the Node app root.
- 500 error after upload: run `npm run build`, confirm all env vars are set, then restart the Node app.
- Empty `customer_email` or `customer_name` in purchases: run sync in this order: customers, offers, products, purchases. Existing purchase rows are enriched when purchases are re-synced.
- Large sync timing out: use the dashboard's batch buttons. They call `/api/kajabi/sync/batch`, process one page per request, and update the progress bar after each page. Purchases use `page[size]=25` (for example, `/v1/purchases?page[number]=2&page[size]=25`); other resources use `page[size]=200`.
