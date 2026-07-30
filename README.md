# Fintrack — Phase 2

Expo + TypeScript personal expense tracker for Android and Web. The app uses Supabase Auth and Postgres, supports manual expenses in RSD, USD, and EUR, and imports Serbian fiscal receipts from SUF verification QR codes on Android.

## Prerequisites

- Node.js and npm
- Expo Go on an Android device, or an Android emulator
- A Supabase project with the Phase 0 migration applied

## Environment variables

Copy `.env.example` to `.env` and replace both placeholders:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use the public anonymous key only. Never put the Supabase service-role key in the app or an `EXPO_PUBLIC_*` variable. Restart Expo after changing environment variables.

## Database

Phase 2 does not change the database schema. Apply the existing migration at `supabase/migrations/20260729000000_phase_0_foundation.sql` once on a new project:

1. Paste it into the Supabase SQL Editor and run it.
2. Or link the project with the Supabase CLI and run:

   ```bash
   supabase db push
   ```

Do not re-run the SQL manually on a project where the Phase 0 schema already exists.

## Deploy the `sync-fx` Edge Function

The function source is at `supabase/functions/sync-fx/index.ts`. It uses Supabase's automatically provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side variables. JWT verification must remain enabled so only authenticated app users can invoke it.

### Option A: Supabase Dashboard

1. Open **Edge Functions** in the Supabase Dashboard.
2. Create a function named `sync-fx`.
3. Open the function editor and replace its source with the complete contents of `supabase/functions/sync-fx/index.ts`.
4. Keep **Verify JWT** enabled and deploy the function.

### Option B: Supabase CLI

Link the local folder to the project, then deploy:

```bash
supabase link --project-ref your-project-ref
supabase functions deploy sync-fx
```

`supabase/config.toml` explicitly keeps JWT verification enabled. The function upserts on the `fx_rates` primary key, so invoking it repeatedly for the same date is safe.

## Deploy the `parse-receipt` Edge Function

The source is in `supabase/functions/parse-receipt/`. The app downloads the SUF verification page directly on the device with a 20-second timeout, then sends its HTML to this function for parsing. The function validates the original HTTPS SUF URL against the explicit allowlist, rejects empty or oversized HTML, and never makes an outbound network request. Keep JWT verification enabled so only authenticated app users can invoke it.

### Option A: Supabase Dashboard

The function has multiple source files, so upload it as an archive:

1. From the repository root, create the archive in PowerShell:

   ```powershell
   Compress-Archive -Path supabase/functions/parse-receipt/* -DestinationPath parse-receipt.zip -Force
   ```

2. Open **Edge Functions** in the Supabase Dashboard.
3. Click **Deploy a new function** → **Via Editor**.
4. Drag `parse-receipt.zip` into the editor.
5. Set the function name to `parse-receipt`.
6. Keep **Verify JWT** enabled and click **Deploy function**.
7. Delete the local archive after deployment; it is only a transport artifact.

The archive must contain `index.ts`, `parser.ts`, and `deno.json` at its root.

### Option B: Supabase CLI

Link the project and deploy the whole function directory:

```bash
supabase link --project-ref your-project-ref
supabase functions deploy parse-receipt
```

For local Edge Function testing:

```bash
supabase functions serve parse-receipt
```

The client invokes `parse-receipt` with the signed-in user's JWT. A request body has the shape `{ "html": "<!DOCTYPE html>...", "sourceUrl": "https://suf.purs.gov.rs/v/?vl=...", "debug": false }`. Set `debug` to `true` only during parser diagnostics; the function returns only a short raw slice and the app never persists it.

## Install and run

```bash
npm install
npx expo start
```

- Press `a` for Android.
- Or scan the QR code with Expo Go on an Android device on the same network.
- Press `w` for Web.

Direct target scripts are also available:

```bash
npm run android
npm run web
```

## Verification

```bash
npm run typecheck
npm test
npx expo install --check
npx expo export --platform web
npx expo export --platform android
```

## Phase 2 receipt flow

- On Android, tap the camera floating button and grant camera access. Scan the QR code once; scanning pauses while the receipt is processed.
- If camera access is denied, open system settings or switch to manual URL entry.
- Receipt scanning is Android-only because browser CORS prevents Web from fetching the SUF tax page. Web remains available for manual entry, viewing, and analytics.
- Review the detected merchant, merchant type, line items, categories, and excluded positions before saving.
- New receipt positions default to the system category with slug `uncategorized`.
- Merchant matching is case-insensitive and checks both the primary name and aliases.
- Saving creates one receipt and one expense per included position. All positions use the same resolved FX-rate pair and rate date.
- The Home screen's `Не распознано` chip filters the month to items that still need categorization.

The live SUF page format may evolve. If a real receipt cannot be parsed, reproduce it with `debug: true`, remove personal data from the captured response, add it as a test fixture, and update `supabase/functions/parse-receipt/parser.ts`.

## Existing expense behavior

- Manual expenses can be created, edited, and deleted.
- Expense dates use device-local calendar parts rather than UTC conversion.
- Amount input accepts a comma or dot and is converted to integer cents before money math.
- Every saved expense has RSD, USD, and EUR amounts plus the rate date.
- Rate resolution uses the newest complete USD/EUR pair on or before the expense date. If no earlier pair exists, it uses the earliest complete pair available.
- The display currency persists under the AsyncStorage key `display_currency`.
- Changing only description, merchant, category, or note leaves the existing conversion and `fx_rate_date` untouched.

The Kurs API exposes the last applicable NBS value for weekends and holidays. The function stores that value for the requested effective calendar date; historical resolution still guarantees `fx_rate_date` is not after the expense date.

## Scope

Phase 2 supports Serbian fiscal QR receipts only. It still excludes photo/email OCR, subscriptions UI, category management, analytics beyond month/day totals, budgets, incomes, accounts, offline queues, notifications, and dark mode.
