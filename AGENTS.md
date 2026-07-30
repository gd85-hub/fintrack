# AGENTS.md

Rules for any coding agent working in this repository. Read this before writing code.
These are constraints, not suggestions. When a task prompt and this file disagree, follow the task prompt and note the conflict in your summary.

## What this project is

Fintrack — a personal expense tracker for one user. Expo (React Native) + TypeScript, one codebase targeting **Android** (primary) and **Web** (development testing + desktop view). Backend is **Supabase**: Postgres, Auth, Edge Functions.

Core domain rule: every expense is stored in its original currency **and** converted into RSD, USD, and EUR using the National Bank of Serbia rate **for the date the expense occurred**. Conversions are frozen at write time and must not silently change later.

Two independent axes describe an expense: **category** (what the money was for — Продукты, Кафе…) and **merchant** (where — Lidl, a café…), and each merchant has a **type** (shop/café/restaurant/online/other). A single shop trip can span several categories.

## Working features (do not regress)

- Email/password auth with persisted session.
- Manual expense entry in RSD/USD/EUR with NBS conversion and a live 3-currency preview.
- Month list with day grouping, edit, delete, display-currency toggle.
- Fiscal receipt scanning (Serbian SUF QR): **native-only** (see CORS note); parses the receipt journal server-side; one receipt -> one `receipts` row + one `expenses` row per line item.
- Analytics screen (read-only): category breakdown, merchant/merchant-type breakdown, in-place expense drilldown with "show more", on-screen currency toggle.

## Non-negotiable rules

### Money
- All money math uses **integer cents**. Multiply -> round -> divide. Never chain floating-point arithmetic on raw amounts.
- Rounding is **half-up** to 2 decimals.
- Use the helpers in `lib/money.ts` (`parseAmountInput`, `convertAll`, `formatMoney`, cents conversion). Do not re-implement.
- Input parsing accepts both `12,5` and `12.5`. Serbian numbers use `.` for thousands and `,` for decimal: `1.234,56` -> `123456` cents.

### Dates
- `occurred_on` is the user's **local calendar date**, computed from `getFullYear/getMonth/getDate`.
- **Never** use `toISOString().slice(0,10)` or any UTC-based shortcut to derive a calendar date - it shifts evening expenses to the wrong day. This has bitten us before.
- Use `lib/dates.ts`.

### Currency conversion
- Use `lib/fx.ts` (`ensureRatesFor`, `resolveRates`). Never call the rate API from a screen.
- Resolve rates **once per save operation** and reuse for all rows (e.g. all line items of a receipt).
- Rate = newest complete USD/EUR pair on or before the expense date (weekend -> Friday). Store the chosen date as `fx_rate_date`. Never save NULL converted amounts; block and show a retry instead.
- Analytics reads the **stored** `amount_rsd/usd/eur` - it must never recompute FX.

### Database and security
- **RLS is enabled on every user table**, with both `using` and `with check`. Never `using (true)` on a user table.
- Set `user_id` explicitly on every insert.
- The service-role key must never appear in the app bundle or any `EXPO_PUBLIC_*` var. It lives only in Edge Functions (Supabase injects `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` automatically).
- `fx_rates` is server-written, client-read-only.
- **Do not modify applied migrations.** New schema changes go in a new timestamped migration. (Phases 1-2 required **no** schema changes beyond the Phase 0 foundation - keep it that way unless truly necessary.)
- Reference tables (`categories`, `merchant_types`) use the `user_id IS NULL = system default` pattern. No per-user copies, no `profiles` triggers.
- Reference the system "uncategorized" category by `slug='uncategorized'`, never by display name.

### Multi-row saves
No client-side transactions exist. When one action writes several rows (receipt + its expenses), implement **explicit compensating cleanup**: if a later insert fails, delete what was already written so no half-saved state remains. See `saveFiscalReceipt` in `lib/db.ts` for the pattern.

### Server-side fetching & receipt parsing
- **The device downloads the SUF verification page; the Edge Function only parses the supplied HTML.** The tax site blocks requests from Supabase servers, and it works from the device. Do not reintroduce server-side fetching of the tax page.
- `parse-receipt` still validates `sourceUrl` against a hostname **allowlist** (`suf.purs.gov.rs` + sandbox/tap variants), requires `https`, path `/v/`, non-empty `vl`, and caps HTML size. This guards against parsing arbitrary attacker HTML.
- Edge Functions keep `verify_jwt = true`, never throw, always return JSON, and use idempotent upserts.
- The SUF item table is rendered client-side by JS and is empty in raw HTML - parse the `<pre>` **journal** block instead (merchant, TIN, line items, totals, timestamp). The journal wraps names at ~40 chars, so an item is one-or-more name lines followed by one amounts line.

### UI
- Every color, spacing, radius, and font size comes from `lib/theme.ts`. No hardcoded hex/px in screens or components. `grep` for hex outside `lib/theme.ts` must be empty.
- All user-facing copy in **Russian**; code, identifiers, comments in **English**.
- Minimalist: white background, near-black text, one accent color, generous whitespace.
- **Web/native parity matters.** `flex: 1` does not guarantee full viewport height on react-native-web; absolutely positioned elements can end up off-screen. Floating buttons use `Platform.select({ web: 'fixed', default: 'absolute' })`. Verify every screen on Web, not just Android.
- Guard native-only modules (camera) behind `Platform.OS !== 'web'`. **Receipt scanning is native-only**: the tax page can't be fetched from a browser (CORS), so hide the scan entry point on Web and show a "use the mobile app" placeholder - never a raw CORS error.
- Reuse shared components (`ShareBar`, `ExpenseMiniRow`, pickers, `DatePicker`, `CurrencySelector`) instead of new variants.

### Analytics specifics
- Read-only. No inserts/updates/deletes on any analytics path.
- Fetch a month's expenses **once** and group in memory; never one query per row.
- Long drilldown lists are capped (show first N, "показать ещё") - never render hundreds of rows at once.
- Any grouping's grand total must equal the month total (same expenses, grouped differently) - assert this in a unit test.

### TypeScript and dependencies
- `strict` mode. No `any` without an inline justification comment.
- **Do not add dependencies** unless the task prompt explicitly allows them. Install RN/Expo packages with `npx expo install`, not raw `npm install`.
- Small focused modules; dumb components, logic in `lib/`.

### Scope discipline
- Build exactly what the task specifies. Each prompt has an "Out of scope" list - respect it.
- If a requirement seems to need a schema change or new dependency, **stop and explain in your summary** rather than doing it.

## Commands

```bash
npm install
npx expo start          # dev server; "a" = Android, "w" = Web
npx expo start -c       # same, clearing cache (needed after editing .env)
npm run android
npm run web
npm run typecheck       # tsc --noEmit - zero errors
npm test                # jest - pure logic (money, dates, parsing, analytics aggregation)
npx expo install --check
```

`.env` (gitignored) holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Expo reads it at startup only - restart with `-c` after changes.

## Testing expectations

Unit tests (jest-expo) cover **pure logic**: money parsing/conversion/formatting, date utilities, receipt journal parsing (fixture: the UNIVEREXPORT receipt - 7 items, total 124295 cents), and analytics aggregation (including the total-equivalence cross-check). UI and network are verified manually on Web and Android. Don't add heavy UI test infra unless asked.

## Repository layout

```
app/(auth)/           sign-in, sign-up
app/(app)/            month list (index), expense editor, analytics, receipt/{scan,review}
components/           ShareBar, ExpenseMiniRow, pickers, DatePicker, CurrencySelector, ReceiptCamera.{native,web}
contexts/             AuthContext, DisplayCurrencyContext, ReceiptDraftContext
lib/                  money, dates, fx, db, receipts, theme, supabase, authErrors
  __tests__/          unit tests
supabase/
  migrations/         SQL (Phase 0 foundation; do not edit applied migrations)
  functions/          sync-fx, parse-receipt (Deno)
```

## Definition of done (every task)

- `npm run typecheck` and `npm test` pass
- app boots on **both** Web and Android with no red screen
- nothing from the task's "Out of scope" was built
- no new dependencies beyond those explicitly allowed
- no hardcoded colors outside `lib/theme.ts`
- no secrets committed
- existing working features (list above) still work

When a task is ambiguous, choose the simplest interpretation that satisfies its Definition of Done and record the decision in the README.
