# Fintrack

A personal expense tracker. Expo (React Native) + TypeScript, one codebase for **Android** and **Web**, backed by **Supabase** (Postgres, Auth, Edge Functions).

Every expense is stored in its original currency and converted into **RSD, USD, and EUR** using the National Bank of Serbia rate for the date the expense occurred. Conversions are frozen at write time, so past totals never drift when rates change.

Replaces a Google Sheets tracker whose main problem was manual data entry.

> Working in this repo with a coding agent? Read [`AGENTS.md`](./AGENTS.md) first - it holds the non-negotiable rules (money in integer cents, local dates, RLS, theme tokens, device-fetch, scope discipline).

## Status

| Phase | Scope | State |
|---|---|---|
| 0 | Scaffolding, DB schema, RLS, email auth | Done |
| 1 | Manual expenses in 3 currencies, NBS rates, month list, edit/delete | Done |
| 2 | Serbian fiscal receipt scanning (QR) -> itemized expenses | Code done; native device test pending |
| 3 | Photo / email-screenshot receipts (any country) via vision model | Planned |
| 4 | Analytics | In progress: categories + merchants + drilldown done; trends / fixed-vs-variable / subscriptions pending |

### Known open items
- **Scanning not yet tested on a real phone.** Public Expo Go lags Expo SDK 57, so a **development build via EAS** is needed to run on device. Scanning is native-only anyway (the tax page can't be fetched from a browser due to CORS).
- **Design pass pending.** Minor visual inconsistencies to unify in one pass: expanded analytics rows differ slightly in style between blocks; the date field in the expense editor shows a raw ISO date (`2026-07-30`) instead of a formatted one; small arrow/indent inconsistencies.
- Deferred niceties: category management UI + FK-on-delete handling for categories; "check your email" state polish.

## Prerequisites

- Node.js (LTS) and npm
- A Supabase project
- For device testing: an Android device (a development build; public Expo Go is incompatible with SDK 57). Web needs nothing extra.

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill both values from Supabase (**Settings -> API Keys**, or the **Connect** button):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Use the **public** key (publishable/anon) only. The service-role key never goes in the app or any `EXPO_PUBLIC_*` var - it belongs only in Edge Functions, where Supabase provides it automatically.

Expo reads `.env` at startup only. After changing it, restart with `npx expo start -c`.

### 2. Database

Apply the migration in `supabase/migrations/` **once** on a fresh project (SQL Editor paste, or `supabase db push`). Never re-run an applied migration; new changes go in a new migration file.

For development, turn **off** email confirmation (Supabase -> Authentication -> Sign In / Providers -> Email -> *Confirm email*). With it on, sign-up returns no session and the app shows a "check your email" state instead of logging you in.

### 3. Edge Functions

Sources live in `supabase/functions/<name>/index.ts`. They use `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically - **do not create these as custom secrets** (the dashboard rejects the `SUPABASE_` prefix; they already exist).

Keep **Verify JWT** enabled on every function.

Deploy via the dashboard (Edge Functions -> *Deploy a new function* -> **Via Editor**; set the function name **before** deploying, since renaming later changes the display name but not the URL slug, and the app calls functions by slug). For `parse-receipt`, add both files in the editor's FILES panel: `index.ts` and `parser.ts`. Or via CLI: `supabase functions deploy <name>`.

Functions:

- **`sync-fx`** - fetches official NBS USD/RSD and EUR/RSD rates for given dates and upserts them into `fx_rates`. Called automatically on app start (today) and whenever an expense date lacks a rate. Idempotent.
- **`parse-receipt`** - **parses** the HTML of a Serbian SUF verification page and returns the itemized receipt. It does **not** fetch anything: the tax site blocks Supabase servers, so the **device downloads the page HTML** and sends it in the request body (`{ html, sourceUrl }`). The function validates `sourceUrl` against a hostname allowlist, then parses the `<pre>` journal block (the on-page item table is rendered client-side by JS and is empty in raw HTML).

## Run

```bash
npm install
npx expo start        # "a" = Android, "w" = Web
```

Day-to-day development happens in the browser (fast reload). **Receipt scanning is Android-only** and requires a development build (not public Expo Go); on Web the scan entry point is hidden and shows a "use the mobile app" note.

## Verify

```bash
npm run typecheck        # tsc --noEmit
npm test                 # jest - money, dates, receipt parsing, analytics aggregation
npx expo install --check
```

## Architecture

```
app/(auth)/           sign-in, sign-up
app/(app)/            month list (index), expense editor, analytics, receipt/{scan,review}
components/           ShareBar, ExpenseMiniRow, pickers, DatePicker, CurrencySelector, ReceiptCamera.{native,web}
contexts/             AuthContext, DisplayCurrencyContext, ReceiptDraftContext
lib/                  money, dates, fx, db, receipts, theme, supabase, authErrors
  __tests__/          unit tests
supabase/
  migrations/         SQL (Phase 0 foundation)
  functions/          sync-fx, parse-receipt (Deno)
```

### Data model

- **`expenses`** - one row per expense. `original_amount` + `original_currency` plus frozen `amount_rsd/usd/eur` and the `fx_rate_date` used. A scanned receipt produces **one expense per line item**, sharing a `receipt_id`.
- **`receipts`** - one row per scanned receipt (merchant, tax id, timestamp, total, parsed payload). Receipt **images are never stored**.
- **`categories`** - what money was spent on (group + fixed/variable type). Includes the system category "Не распознано" (`slug='uncategorized'`) for unrecognized items awaiting triage.
- **`merchants`** / **`merchant_types`** - *where* it was spent and the kind of place. A second axis, independent of category.
- **`fx_rates`** - daily NBS rates, server-written, client-read-only.
- **`subscriptions`** - recurring payments (explicit, not guessed).

Reference tables use `user_id IS NULL` for shared system defaults and a non-null `user_id` for user-created rows.

### Key decisions

- **Rate snapshot at write time.** Weekends/holidays fall back to the most recent earlier rate.
- **Integer cents everywhere.** No floating-point money math.
- **Local calendar dates.** Never derived via UTC.
- **Receipt line item = expense.** One table drives all analytics: by category, by merchant, or by product name.
- **Unrecognized -> "Не распознано", not a guess.** Surfaced on Home for manual triage.
- **Device fetches the tax page; server only parses.** The tax site blocks cloud servers but serves the device; parsing lives server-side (with a hostname allowlist) so fixes don't require a new app build.
- **Scanning is native-only.** Browsers can't fetch the tax page (CORS); Web is for manual entry, viewing, and analytics.
- **No image storage.** Receipt photos/pages are parsed and discarded.
- **Analytics is read-only and reuses stored conversions** - it never recomputes FX; a month's expenses are fetched once and grouped in memory.

## Security notes

- RLS on every user table, both `using` and `with check`.
- `.env` is gitignored; only `.env.example` is committed.
- The repository is public - no secrets belong in it. All data lives in Supabase.
- Edge Functions that accept client input validate `sourceUrl` against a hostname allowlist and cap payload size.
