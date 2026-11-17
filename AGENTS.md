# AGENTS.md

Mandatory rules for coding agents working in Fintrack. Read this file before changing the repository. A task prompt may narrow or override these rules; report any conflict.

## Product and sources of truth

Fintrack is an account-based expense tracker built with Expo/React Native + TypeScript for Android and responsive Web/PWA, backed by Supabase Postgres, Auth, and Edge Functions.

Documentation roles:

- `README.md` — product, implemented architecture, setup, and known limitations.
- `AGENTS.md` — non-negotiable engineering rules.
- `HANDOFF.md` — current operational state, risks, and next action.
- `CHANGELOG.md` — append-only history and release stamps.
- `BUGS.md` — confirmed defects and fixed-bug history.
- `BACKLOG.md` — future product functionality and consciously deferred ideas.

Current code is the implementation source of truth. Source in `main` does **not** prove that a migration, Edge Function, web deploy, or Android build is live in production.

## Architecture that must not regress

- Email/password auth with persisted sessions, RU/EN interface, light/dark/system themes, account name, feedback, and account deletion.
- Password-reset routes and logic exist, but the sign-in entry point is gated by `PASSWORD_RESET_UI=false` until domain + custom SMTP + redirect configuration are ready.
- Home uses a `FlatList` of non-sticky per-day cards. Each card owns its day header, purchase rows, inset dividers, and expansions. Month selection uses `MonthPicker`.
- Wide Web uses a fixed left sidebar; native and phone-width Web use bottom tabs. All creation routes through the navigation `+` menu.
- Android supports native SUF QR scanning and receipt photos. Web supports receipt-image upload/paste and vision recognition, but not SUF QR/link fetching.
- Analytics is read-only and supports preset/custom ranges, category/place/fixed-variable tabs, capped drilldowns, sorting, averages, pace/forecast, and a display-currency picker.
- Reports export the selected month as CSV/XLSX/PDF. Known export defects belong in `BUGS.md`; do not silently redefine the format while fixing unrelated work.
- `lib/db/` is split by domain and re-exported through `lib/db/index.ts`. Keep screen components thin and business/data logic in `lib/`.

## Money and dates

- Store and calculate app money in **integer cents**. Multiply, half-up round, then divide. Never chain floating-point operations on raw money.
- Use `lib/money.ts`; do not duplicate parsing, conversion, distribution, or formatting logic.
- `parseAmountInput` currently accepts unsigned plain values such as `12`, `12,5`, and `12.50`. It does **not** accept grouped thousands (`1.234,56`, `1 234,56`) or negative amounts. The grouped-input gap is tracked in `BUGS.md`; do not claim otherwise.
- Refunds/negative expenses are not implemented and remain backlog work.
- `occurred_on` is the user's **local calendar date**. Use `lib/dates.ts`; never derive it with `toISOString().slice(0, 10)` or another UTC shortcut.

## Currency model

The current model has a canonical write-time anchor plus a temporary compatibility snapshot:

- Always preserve `original_amount` + `original_currency`.
- New/edited expenses freeze `amount_eur` from the historical rate for the expense date whenever the currency/rate or manual equivalent is available. EUR originals are equality, not conversion. Honest-null legacy/unreadable rows are allowed by the current schema and must be surfaced, never fabricated.
- Home and Analytics display through `lib/fxDisplay.ts`: frozen EUR cents × a historical EUR-base rate selected on or before the expense date. `ANCHOR_DISPLAY=true` is the active path.
- Frankfurter EUR-base rows are synchronized by `sync-rates`; only settled dates are written and existing rows are not overwritten.
- `amount_rsd`, `amount_usd`, and the legacy `fx_rate_date` remain written/read for rollback and compatibility. `sync-fx`/`lib/fx.ts` are the legacy NBS path. Do not remove them without a dedicated migration/rollback task.
- Covered display/input currencies are declared in `lib/homeCurrency.ts`. A valid ISO currency outside that set may use a manual RSD equivalent; the frozen EUR anchor still derives from that manual equivalent.
- Resolve rates once per save operation and reuse them for every line of a receipt. Never call an external rate API directly from a screen.
- Never rewrite frozen expense anchors because newer rates appeared. Missing display rates may be fetched on demand, but saved expense values stay immutable unless the user edits money/date/currency.
- Totals are sums of individually rounded row amounts. An unconvertible row must not zero or hide the convertible subtotal; surface the unavailable count.

## Categories, merchants, and reference data

- Categories are per-account editable rows. `20261115000000_per_account_categories.sql` keeps NULL-user rows only as registration templates, seeds/backfills personal copies, and re-points existing references. Its production application is not yet confirmed in repository history.
- Client category lists must filter `user_id = auth.uid()`; never mix NULL templates into pickers or management screens.
- Every account must have exactly one personal `slug='uncategorized'`. It can be renamed/re-styled but never deleted or used as a merge source. Deleting another category re-points expenses, subscriptions, and dictionary rules to that personal fallback before deletion.
- Category/merchant destructive multi-row operations preserve ownership and use compensating cleanup.
- User-created labels are content and must pass through untranslated. Seeded reference labels may be localized only through an explicit stable mapping (prefer slug/context, not text coincidence). The current text-match collision is tracked in `BUGS.md`.
- Category and merchant are independent axes. A receipt may contain many categories while sharing one merchant/purchase.
- `normalizeItemName(rawName)` must be identical on dictionary read/write. Preserve Cyrillic and Latin unit stripping, punctuation normalization, and leading-barcode removal.

## Database and security

- RLS stays enabled on every user table. User policies require ownership in both `using` and `with check`; never use `using (true)` for user data.
- Set `user_id` explicitly on every client insert.
- The service-role key is server-only and must never enter app code, `.env.example`, or an `EXPO_PUBLIC_*` variable.
- `fx_rates` is server-written and client-read-only.
- Never modify an applied migration. Add a later timestamped migration and preserve data.
- No client transaction spans multi-row saves. Use explicit compensating cleanup; follow the receipt/category/merchant data-layer patterns.
- Do not infer production schema state from migration files. Record required application/verification in `HANDOFF.md`.

## Edge Functions and receipts

- Native device code downloads SUF verification HTML; `parse-receipt` only validates and parses supplied HTML. Never reintroduce server-side fetching of the Serbian tax page.
- `parse-receipt` requires HTTPS, an allowed SUF hostname, `/v/`, non-empty `vl`, capped HTML, and journal (`<pre>`) parsing. The JS-rendered item table is empty in raw HTML.
- Edge Functions return structured JSON and catch top-level errors. Rate writers use idempotent/insert-only conflict behavior.
- Gateway JWT verification stays enabled for `sync-fx`, `sync-rates`, `parse-receipt`, `analyze-receipt-image`, and `categorize-items`.
- `delete-account` is the documented exception: gateway `verify_jwt=false`, but the function must validate the bearer token itself with `auth.getUser` before service-role deletion.
- Receipt photos are processed in memory and not stored.
- Photo analysis may receive one to five overlapping images of one receipt. Preserve overlap-aware deduplication and the honest-null contract: unreadable printed totals/dates/currencies must reach review, not be silently invented from line items.
- Receipt categorization is dictionary-first; only unresolved item names reach `categorize-items`. Final review teaches the dictionary.

## Home and navigation

- Home feed: `FlatList` → per-day raised cards on the base backdrop. Day headers are inside cards and **not sticky**. Do not restore `SectionList` or sticky headers.
- Day collapse and purchase expansion are independent in-memory sets and reset on month change. Expansion keys use `unit.key`, not `receiptId`; every purchase is expandable.
- Rows use `components/ds/ListRow`. Preserve token-computed inset dividers and bottom padding above mobile navigation.
- Receipt-backed rows edit through `receipt/review`; manual rows use the expense editor. Delete receipt metadata only when `receiptId` is non-null.
- Home primary total/rows use the selected home currency; the hero may show the configured secondary currency. Do not restore the old fixed-RSD or three-currency hero rules.
- Add menu: native can show SUF scan, image upload, and manual entry; Web hides native QR and keeps image/manual entry.

## UI, design system, and localization

- Use semantic dynamic colors from `useColors()` and `lib/theme.ts`; dimensions/type come from `theme.type.*` and `theme.scale.*` for new/redesigned UI. Do not hardcode hex colors or ad-hoc shadow values.
- Inter is bundled in `app/_layout.tsx`. Reuse components in `components/ds/` and existing pickers/chrome before creating variants.
- RU and EN are supported. Every new user-facing string needs both `lib/i18n/ru.ts` and `lib/i18n/en.ts`; code identifiers/comments stay English.
- Locale-aware dates and pluralization use the active locale. Never translate user-entered category, merchant, note, or description text.
- Web/native parity matters. Guard camera/native modules by platform, keep full-height web layouts, and use viewport-safe positioning where required.
- Wide-Web breakpoint behavior belongs in `TabBar`/app layout; do not branch solely on `Platform.OS === 'web'` for responsive navigation.

## Analytics and export

- Analytics never writes data. Fetch a range once per dataset, aggregate in memory, cap long lists, and preserve `sum(groups) === total` tests.
- Analytics display uses frozen EUR anchors + historical display rates when `ANCHOR_DISPLAY` is on; do not fall back to silently recomputing saved anchors.
- Export builders are pure and covered by characterization tests. Current RSD/EUR/USD-column and missing-EUR issues are documented bugs; fix them only in a dedicated task with regression tests.

## TypeScript, dependencies, and scope

- TypeScript strict; no `any` without an inline justification.
- No new dependency unless the task explicitly allows it. Install Expo/RN packages with `npx expo install`.
- Preserve unrelated working-tree changes. Never stage `.env` or `supabase/.temp/*`.
- Build exactly the requested scope. If a requirement needs an unapproved schema/dependency/product decision, stop and report it.

## Project history files

Every task updates both files in the same commit unless the task explicitly says otherwise:

- `HANDOFF.md` is rewritten as a concise delta with: **Где мы**, **Только что сделано**, **Состояние origin/main**, **Следующий шаг**, **Открытые решения и риски**, **Не трогать**.
- `CHANGELOG.md` is append-only. Add one user-facing entry under the top `## [Unreleased]` bucket; never edit/delete historical entries. Stamp a dated release only after an actual deployment.

## Commands and testing

```bash
npm install
npx expo start          # a = Android, w = Web
npx expo start -c       # clear cache after environment changes
npm run typecheck
npm test
npx expo install --check
```

Pure/domain logic belongs in Jest. UI, native camera, network, migrations, and deployments require manual/integration checks. For documentation-only tasks, validate Markdown diff, links, and consistency instead of running expensive builds/tests when the prompt allows it.

## Repository map

```text
app/                    Expo Router screens
components/             shared UI, DS components, receipt inputs, responsive nav
contexts/               auth, language, theme, toast, receipt draft, currency preferences
lib/db/                 domain data modules and barrel export
lib/i18n/               RU/EN dictionaries
lib/__tests__/          Jest suites
lib/anchorRates.ts      EUR-base rate resolution/on-demand sync
lib/fxDisplay.ts        frozen EUR anchor -> display currency
lib/fx.ts               legacy NBS compatibility path
lib/export*.ts          export builders/delivery
supabase/migrations/    additive migrations
supabase/functions/     Deno Edge Functions
scripts/                receipt-recognition evaluation
```

## Definition of done

- Requested scope is complete; out-of-scope behavior is untouched.
- Relevant typecheck/tests pass, or documentation-only verification is performed when explicitly allowed.
- Web and Android risks are considered; changed UI is manually checked on both when practical.
- Money/date/ownership/RLS/frozen-anchor invariants remain intact.
- No secrets, `.env`, temp Supabase state, unrelated changes, or unapproved dependencies are committed.
- `HANDOFF.md` and `CHANGELOG.md` are updated in the same commit.
- Commit/push/deploy actions follow the task exactly; a deploy or production migration is never claimed without evidence.
