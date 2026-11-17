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

### BUG-4 · 🔴 Missing EUR anchor is exported as a real zero

- **Severity:** high (data correctness)
- **Area:** Reports / all export formats
- **Code:** `app/(app)/reports.tsx:132`
- **Evidence:** `amountEur: (expense.amountEurCents ?? 0) / 100` converts an unavailable EUR value into `0.00`. CSV/XLSX/PDF cannot distinguish “no EUR conversion” from an actual zero expense; totals are understated.
- **Reproduce:** export a month containing a legacy expense whose `amount_eur` is NULL → its EUR cell and EUR total use zero.
- **Direction:** preserve null/unavailable through `ExportRow`, render an explicit empty/unavailable value, exclude it from totals with a visible incomplete-total signal, and add regression tests for all formats.

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

### VERIFY-1 · 🟡 Per-account category migration

- `20261115000000_per_account_categories.sql` is committed, but production application is not confirmed.
- Apply it deliberately, run the verification SQL at the end of the migration, and check a new and an existing account before treating the feature as production-complete.

### VERIFY-2 · 🟡 EUR-anchor display and on-demand rate sync

- `ANCHOR_DISPLAY=true`, primary/secondary currencies, Frankfurter sync, and resilient partial totals are implemented and unit-tested.
- Still verify real-device/network behavior across a weekend/old expense, a previously unused currency, Home, Analytics, and the currency-management rates panel before tester rollout.

### VERIFY-3 · 🟡 Environment-dependent account operations

- Password-reset code depends on custom SMTP/domain/redirect configuration and is intentionally hidden by `PASSWORD_RESET_UI=false`.
- Account deletion and feedback require their Edge Function/migration deployment in the target Supabase environment. Repository presence alone does not prove they are live.

---

## Fixed

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
