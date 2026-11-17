# Fintrack

Fintrack is a personal, account-based expense tracker built with Expo, React Native, TypeScript, and Supabase. One codebase targets Android and responsive Web/PWA.

The product is now global and multi-currency. Every expense keeps its original amount and currency. When a rate or manual equivalent is available, writes also freeze an EUR anchor for the expense date; Home and Analytics convert that frozen anchor into the selected display currency using historical EUR-base rates. Honest-null legacy/unreadable rows remain possible and are surfaced as unavailable instead of silently invented. The legacy RSD/USD/EUR snapshot is still written in parallel for rollback and compatibility.

> Coding agents must read [`AGENTS.md`](./AGENTS.md) before changing the repository. Confirmed defects live in [`BUGS.md`](./BUGS.md); product ideas live in [`BACKLOG.md`](./BACKLOG.md).

## Current state

The following capabilities are implemented in `main`. Presence in `main` does not prove that the matching migration, Edge Function, web deploy, or Android build has reached production. The last explicitly stamped release in [`CHANGELOG.md`](./CHANGELOG.md) is **2026-10-27**; later entries remain under **Unreleased**.

| Area | Implemented in `main` | Operational note |
|---|---|---|
| Auth | Email/password sign-in and sign-up, persisted session, account name, account deletion | Self-service password reset exists but `PASSWORD_RESET_UI=false` until a sending domain and custom SMTP are configured |
| Manual expenses | Add/edit/delete expenses in supported and arbitrary ISO currencies | Covered currencies convert automatically; unsupported ISO codes require a manual RSD equivalent |
| FX | Frozen EUR anchor, historical Frankfurter rates, selectable primary/secondary display currencies | `sync-fx` and the RSD/USD/EUR snapshot remain as a legacy rollback path |
| Home | Month picker, balance hero, per-day cards, collapsible days, expandable purchases | Totals use the selected home currency; an optional secondary currency is shown in the hero |
| Receipts | Android SUF QR scanning; photo/email-screenshot recognition on Android and Web; multi-photo overlap handling | SUF QR/link fetching is native-only because browsers are blocked by CORS |
| Categorization | Personal dictionary, model fallback, editable item names, merchant normalization | Per-account default-category migration is in `main`; production application is not confirmed |
| Management | Full category and place create/edit/merge/delete flows with compensating cleanup | Each account owns its category copies; its `uncategorized` row is the protected fallback |
| Analytics | Custom/preset periods, category/place/fixed-variable tabs, drilldown, sorting, averages, pace/forecast, display-currency picker | Read-only; trends across periods and subscription forecasting remain backlog work |
| Export | Monthly CSV, Excel, and styled PDF with native/Web delivery | Export still has known currency/null limitations; see [`BUGS.md`](./BUGS.md) |
| UI | RU/EN, light/dark/system themes, responsive sidebar/bottom tabs, toasts and status components | User-created content must remain untranslated |
| Distribution | Android EAS profiles, EAS Hosting configuration, installable iOS-oriented PWA shell | No deploy is performed by repository changes alone |
| Support | In-app feedback with app version/platform metadata | Requires the feedback migration in the target Supabase project |

## Platform capabilities

### Android

- Manual expenses and full browsing/analytics/export.
- Live SUF QR scanning with the device fetching the Serbian tax page.
- Camera/gallery receipt photos and multi-image recognition.
- Internal preview APK through EAS Build.

### Web / PWA

- Responsive desktop sidebar and phone-width bottom navigation.
- Manual expenses, Home, Analytics, Reports, Settings, management screens, and account actions.
- Receipt-image upload/paste and vision recognition.
- Manifest, icons, safe-area metadata, and standalone PWA behavior for iPhone testers.
- No SUF QR/link parsing: browser access to the tax page is blocked by CORS. Web uses the photo flow instead.

## Setup

### Prerequisites

- Node.js LTS and npm.
- A Supabase project.
- Android Studio/device tooling only when running Android locally.
- A development build for native SDK 57 testing; public Expo Go is not sufficient for this project.

### 1. Environment

Copy `.env.example` to `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Only public Supabase client values belong in `EXPO_PUBLIC_*`. The service-role key is server-only. Restart Expo with `npx expo start -c` after changing `.env`.

Standalone builds do not read the local `.env`; configure the two public values for the relevant EAS environments. They are public bundle configuration, not secrets.

### 2. Database

Apply the files in `supabase/migrations/` in timestamp order. Never edit or replay an already-applied migration; add a new timestamped migration instead.

Current additive migrations cover:

- the Phase 0 tables, constraints, and RLS;
- the personal item-category dictionary;
- raw/display item names and original merchant labels;
- in-app feedback;
- per-account editable copies of default categories.

`20261115000000_per_account_categories.sql` remains operationally important: its application to production is not confirmed. It seeds defaults for new users, backfills existing accounts, and re-points category references. Run the verification queries at the end of that migration after applying it.

### 3. Edge Functions

Sources live in `supabase/functions/`:

- `sync-rates` — EUR-base historical rates from Frankfurter; insert-only semantics for settled dates.
- `sync-fx` — legacy NBS rates retained for the compatibility snapshot.
- `parse-receipt` — validates the SUF URL and parses device-supplied HTML; it never fetches the tax page server-side.
- `analyze-receipt-image` — structured vision extraction from one to five receipt images.
- `categorize-items` — text categorization only for dictionary misses.
- `delete-account` — authenticates the bearer token itself and deletes the calling user through the service role.

`sync-rates`, `sync-fx`, `parse-receipt`, `analyze-receipt-image`, and `categorize-items` use Supabase JWT verification. `delete-account` intentionally has gateway `verify_jwt=false` and validates the JWT with `auth.getUser` inside the function so it can return its documented JSON errors.

Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not add them as custom secrets. Receipt AI functions additionally require server-side `OPENAI_API_KEY` and `OPENAI_MODEL`. `sync-rates` optionally reads `FX_SOURCE` and defaults to `frankfurter`.

Deploy only the functions needed by the target environment, for example:

```bash
supabase functions deploy sync-rates
supabase functions deploy parse-receipt
supabase functions deploy analyze-receipt-image
supabase functions deploy categorize-items
supabase functions deploy delete-account --no-verify-jwt
```

Deployment status is environment state and is not inferred from the source tree.

### 4. Run and verify

```bash
npm install
npx expo start          # press a for Android, w for Web
npx expo start -c       # clear Metro cache after environment changes
npm run typecheck
npm test
npx expo install --check
```

Unit tests cover pure money/date/period logic, FX selection and display calculations, receipt parsing/review, categorization, analytics invariants, export builders, and data-layer helpers. UI, network, native camera, Edge Function deployment, and migrations require manual/integration verification.

### 5. Distribution

Android internal APK:

```bash
eas build --profile preview --platform android
```

Web uses SPA output (`expo.web.output: "single"`):

```bash
npx expo export --platform web
eas deploy              # preview
eas deploy --prod       # stable URL
```

Do not stamp a release in `CHANGELOG.md` until the intended web and Android artifacts have actually been deployed.

## Architecture

```text
app/                    Expo Router screens: auth, tabs, receipts, settings, reports
components/             Shared inputs, pickers, navigation, receipt inputs, DS feedback/surface components
contexts/               Auth, language, theme, toast, receipt draft, display/home/secondary currency
lib/
  db/                   Domain data modules (expenses, receipts, analytics, categories, merchants, feedback)
  i18n/                 RU/EN dictionaries
  __tests__/             Jest tests for pure/domain logic
  anchorRates.ts         EUR-base historical rate resolution and on-demand sync
  fxDisplay.ts           Frozen EUR-anchor -> display-currency math
  fx.ts                  Legacy NBS USD/EUR pair resolution
  export*.ts             CSV/XLSX/PDF builders and platform delivery
  money.ts               Integer-cent parsing, rounding, conversion, formatting
supabase/
  migrations/           Additive SQL migrations
  functions/            Deno Edge Functions
public/                  PWA manifest and icons
scripts/                 Receipt-recognition evaluation harness
```

## Data model

- `expenses` — one row per manual expense or receipt line. Stores original amount/currency, nullable frozen EUR anchor (`amount_eur`), legacy RSD/USD values where available, legacy `fx_rate_date`, category, merchant, and optional receipt link.
- `receipts` — purchase-level fiscal/photo metadata and parsed payload. Images are processed in memory and are not persisted.
- `fx_rates` — server-written historical rates. Frankfurter rows use `base_currency='EUR'`; legacy NBS rows use the source currency with `quote_currency='RSD'`.
- `categories` — per-account editable categories. NULL-user rows remain templates for the registration trigger; clients list only their own copies. Each account must have exactly one protected `slug='uncategorized'` fallback.
- `item_category_rules` — per-user normalized item-name dictionary with category/exclude action and optional display name.
- `merchants` — user places/brands. Merchant type remains schema/reference history but is no longer a primary client editing axis.
- `subscriptions` — schema support for explicit recurring payments; no complete subscription product flow yet.
- `feedback` — user report text plus app version and platform.

RLS protects user-owned tables. Client inserts set `user_id` explicitly. `fx_rates` is client-read-only and server-written.

## Core invariants

- Money calculations use integer cents and half-up rounding.
- `occurred_on` is a local calendar date, never a UTC-derived date shortcut.
- Expense originals and frozen EUR anchors do not drift after save; display conversion uses historical rates on or before the expense date.
- Receipt multi-row writes use explicit compensating cleanup when a later write fails.
- SUF HTML is fetched by the native device and parsed by the server with strict URL/input validation.
- Receipt categorization is dictionary-first; only unresolved names reach the text model.
- User-created names are content, not translation keys.

## Known limitations

- The category migration in `main` still needs confirmed production application and SQL verification.
- Password-reset routes exist, but the sign-in entry point is disabled until custom SMTP/domain/redirect configuration is ready.
- Export is still tied to RSD/EUR/USD columns and currently turns a missing EUR value into `0`; see [`BUGS.md`](./BUGS.md).
- The amount parser accepts plain decimal comma/dot input but not grouped thousands such as `1.234,56`.
- Cross-period trends, budgets, search, duplicate-receipt protection, and subscription forecasting remain backlog items.

## Documentation ownership

- [`README.md`](./README.md) — product, implemented architecture, setup, and limitations.
- [`AGENTS.md`](./AGENTS.md) — mandatory engineering rules.
- [`HANDOFF.md`](./HANDOFF.md) — current operational state and next action.
- [`CHANGELOG.md`](./CHANGELOG.md) — append-only history and release stamps.
- [`BUGS.md`](./BUGS.md) — confirmed defects and fixed-bug history.
- [`BACKLOG.md`](./BACKLOG.md) — future product work and consciously deferred ideas.
