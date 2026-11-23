# BUGS — Fintrack

Confirmed defects and verification gaps. Product ideas belong in `BACKLOG.md`; current operational state belongs in `HANDOFF.md`.

**Statuses:** 🔴 open · 🟡 partial/manual verification · ✅ fixed. Fixed entries are retained for history.

Each open bug records severity, affected area, code evidence, reproduction, and a repair direction. Documentation audits do not fix the code.

---

## Open — confirmed from current code

### BUG-3 · 🔴 Export ignores the user's configured currencies

- **Severity:** medium (product consistency / exported data)
- **Area:** Reports → CSV/XLSX/PDF
- **Code:** `app/(app)/reports.tsx:131-150`, `lib/export.ts`
- **Evidence:** export rows and columns are always `amountRsd`, `amountEur`, `amountUsd` with fixed RSD/EUR/USD headings. `HomeCurrencyContext`, secondary currency, and the Analytics display-currency choice are not consulted.
- **Reproduce:** set the primary currency to GBP or CHF → export a month → the file still contains only RSD/EUR/USD converted columns.
- **Direction:** define the export currency contract explicitly (original + selected primary/secondary, or a stable universal set), calculate through the same EUR-anchor display helpers, and update characterization tests before changing all three formats.

### BUG-5 · 🔴 Reference-data localization can translate user-created names

- **Severity:** medium (content integrity / i18n)
- **Area:** categories and groups in Home, pickers, Analytics, Reports, management
- **Code:** `lib/catalog.ts:6-70` and its callers
- **Evidence:** `localizeCategoryName` and `localizeGroup` map Russian text alone. A user-created category named `Продукты` or group named `Еда` is indistinguishable from a seeded label and is translated in English, despite the rule that user content passes through unchanged.
- **Reproduce:** create a custom category named `Продукты` (slug NULL) → switch to English → surfaces using `localizeCategoryName` show “Groceries”.
- **Direction:** pass stable category provenance/slug into the display layer and translate only seeded personal copies with known slugs; keep slug-NULL user content raw. Groups need equivalent provenance/context rather than blind text matching.

### BUG-6 · 🔴 Serbian grouped amount input is rejected

- **Severity:** medium (manual-entry UX)
- **Area:** money input parsing
- **Code:** `lib/money.ts:91-110`, characterized in `lib/__tests__/money.test.ts:53-67`
- **Evidence:** `AMOUNT_PATTERN` accepts only ungrouped unsigned decimals. `1.234,56`, `1 234,56`, and negative values return `null`.
- **Reproduce:** type `1.234,56` into a money field → validation rejects the amount, while `1234,56` succeeds.
- **Direction:** decide the accepted locale formats, normalize separators unambiguously in `parseAmountInput`, and add boundary/ambiguity tests. Refunds remain a separate product/schema decision.

---

## Requires manual or environment verification

### VERIFY-1 · 🟡 EUR-anchor display and on-demand rate sync

- `ANCHOR_DISPLAY=true`, primary/secondary currencies, Frankfurter sync, and resilient partial totals are implemented and unit-tested.
- Still verify real-device/network behavior across a weekend/old expense, a previously unused currency, Home, Analytics, and the currency-management rates panel before tester rollout.

### VERIFY-2 · 🟡 Environment-dependent account operations

- Password-reset code depends on custom SMTP/domain/redirect configuration and is intentionally hidden by `PASSWORD_RESET_UI=false`.
- Account deletion and feedback require their Edge Function/migration deployment in the target Supabase environment. Repository presence alone does not prove they are live.

---

## Fixed

### BUG-8 · ✅ PDF monetary values were rounded to whole currency units

- **Area:** Reports / PDF export
- **Resolution:** every PDF money surface now formats the stored integer cents with exactly two decimal places and the existing thin-space thousands separator. Totals, EUR/USD equivalents, purchase metrics, categories (including Other), day totals, and detail rows no longer lose cents.
- **Coverage:** 0.01/0.49/0.50/123.75/1,234.56 boundaries, large grouped values, receipt purchase grouping, multiple manual purchases, half-up average, category/day reconciliation, Other aggregation, and missing EUR.

### BUG-4 · ✅ Missing EUR anchor was exported as a real zero

- **Area:** Reports / all export formats
- **Resolution:** export rows now preserve nullable EUR cents. CSV/XLSX leave the row and incomplete EUR total empty and append a visible unavailable-count warning; PDF shows an em dash for the EUR equivalent plus the same warning. RSD/USD values remain intact.
- **Coverage:** null EUR in CSV/XLSX/PDF, exact integer-cent totals, Unicode and quoted CSV fields, ZIP/reopen checks, large values, and 1,001-row datasets.

### BUG-7 · ✅ Expense collection queries could stop at the PostgREST row limit

- **Area:** Home, Analytics, Reports / financial data retrieval
- **Resolution:** monthly and ranged expense datasets plus category/merchant breakdowns now exhaust bounded `.range()` pages with deterministic `occurred_on`, `created_at`, `id` ordering. Any failed page rejects the complete load; no partial result is returned.
- **Coverage:** empty/small/exact/multi-page/partial datasets, a server cap below the requested size, first/later-page errors, equal timestamps, and a 1,001-row financial total/group invariant.
- **Limitation:** offset pagination is reliable for stable data but is not snapshot-isolated from concurrent writes.
- **Commit:** `PENDING`.

### OPS-1 · ✅ Per-account category migration applied

- Project owner confirmed on 2026-11-17 that `20261115000000_per_account_categories.sql` was applied to production Supabase and its verification checks passed. No additional production verification is pending for that migration.

### BUG-1 · ✅ Settings child screens returned to Home

- **Area:** navigation
- **Resolution:** category and place management now explicitly replace to `/(app)/settings` instead of relying on tab history.
- **Evidence:** `app/(app)/categories.tsx:388`, `app/(app)/merchants.tsx:278`.
- **Commit:** `de65390` — Fix back navigation from Manage categories/places to Settings.

### BUG-2 · ✅ Seeded reference labels stayed Russian in English UI

- **Area:** i18n / reference data
- **Resolution:** catalog display mappings were wired into category/group/merchant-type surfaces while unknown labels pass through.
- **Commit:** `b3fd335` — Localize system categories, groups, and merchant types.
- **Follow-up:** the text-coincidence problem for user-created names is tracked separately as BUG-5.
