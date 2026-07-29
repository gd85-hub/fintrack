# Fintrack — Phase 0

Minimal Expo + TypeScript foundation for Android and Web, with Supabase email/password authentication and a protected placeholder home screen.

## Prerequisites

- Node.js and npm
- Expo Go on an Android device, or an Android emulator
- A Supabase project

## Environment variables

Copy `.env.example` to `.env` and replace both placeholder values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both values are available in the Supabase project settings under API keys. Use the public anonymous key only. Never put the service role key in this app.

Restart Expo after changing environment variables.

## Apply the database migration

The migration is at `supabase/migrations/20260729000000_phase_0_foundation.sql`.

For a new Supabase project, either:

1. Open the Supabase SQL Editor, paste the entire migration, and run it once.
2. If the project is linked with the Supabase CLI, run:

   ```bash
   supabase db push
   ```

The migration creates the seven specified tables, indexes, `updated_at` triggers, RLS policies, and Russian system seed rows. It is intended to be applied once through Supabase's migration history.

## Install and run

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

- Press `a` to open Android on a running emulator.
- Or scan the QR code with Expo Go on an Android device on the same network.
- Press `w` to open the same app on Web.

You can also start a target directly:

```bash
npm run android
npm run web
```

## Authentication behavior

The app supports email/password sign-up, sign-in, and sign-out. Supabase sessions are stored with AsyncStorage and restored on cold start.

If email confirmation is enabled in the Supabase project's Auth settings, a new user must confirm their email before signing in. For local-only testing, that requirement can be disabled in Supabase.

## Phase 0 scope

This phase deliberately contains no expense UI, receipt scanning, FX fetching, analytics, or reference-data management. The database tables are present only as the foundation for later phases.
