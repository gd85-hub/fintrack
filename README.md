# Fintrack — Phase 1

Expo + TypeScript personal expense tracker for Android and Web. The app uses Supabase Auth and Postgres, supports manual expenses in RSD, USD, and EUR, and stores all three converted amounts using National Bank of Serbia rates.

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

Phase 1 does not change the database schema. Apply the existing migration at `supabase/migrations/20260729000000_phase_0_foundation.sql` once on a new project:

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
```

## Phase 1 behavior

- Manual expenses can be created, edited, and deleted.
- Expense dates use device-local calendar parts rather than UTC conversion.
- Amount input accepts a comma or dot and is converted to integer cents before money math.
- Every saved expense has RSD, USD, and EUR amounts plus the rate date.
- Rate resolution uses the newest complete USD/EUR pair on or before the expense date. If no earlier pair exists, it uses the earliest complete pair available.
- The display currency persists under the AsyncStorage key `display_currency`.
- Changing only description, merchant, category, or note leaves the existing conversion and `fx_rate_date` untouched.

The Kurs API exposes the last applicable NBS value for weekends and holidays. The function stores that value for the requested effective calendar date; historical resolution still guarantees `fx_rate_date` is not after the expense date.

## Scope

Phase 1 deliberately excludes receipts, QR/OCR, subscriptions UI, category management, analytics beyond month/day totals, budgets, incomes, accounts, offline queues, notifications, and dark mode.
