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

### BUG-13 · ✅ Receipt duplicate check could save a stale review session

- **Area:** receipt review (`app/(app)/receipt/review.tsx`)
- **Evidence:** `receipt/review` is an Expo Router `Tabs.Screen`, so the screen can stay mounted between visits. The DUP-02B duplicate check disabled only the Save button while `findReceiptDuplicates()` was pending, not the editable currency/date/merchant controls. The no-match continuation then called `performSave` through the closure captured before the `await`, so a field edited mid-check could be written under values that were never checked. The "Save anyway" / "Save without checking" paths re-collected the live form values instead of proving they matched the checked snapshot. The check was invalidated only by a draft change or by unmount — not by navigation blur while the screen stayed mounted — and it was never bound to the authenticated account (invalidation deps were `[draft, editReceiptId]`), so a late result from a previous account or screen session could drive a save or an obsolete warning. Tests never exercised a field change during a pending check, an account change, or a blur without unmount.
- **Resolution:** every check and confirmation is now bound to the active account, draft, navigation session and a validated save snapshot. `inFlightRef` holds the owning operation's token (not a boolean): `beginOperation` acquires it as the synchronous repeated-press guard, `endOperation` releases it only when the token still matches (so a superseded operation can never free a newer one's guard), and `invalidatePendingDuplicateWork` advances the token, releases the guard and clears the checked snapshot plus decision state. A `checkedSnapshotRef` records the matching-relevant snapshot (account, confirmed total, currency, date, merchant) a check or approval was made against. A `useEffect` keyed on the account, draft, edit target and every snapshot field invalidates outstanding work the moment any of them changes, and `useFocusEffect` invalidates on blur as well as unmount. After the `await`, the no-match save proceeds only if the token is still current and the live snapshot and account still equal the checked ones; "Save anyway" / "Save without checking" authorize only the exact checked snapshot and refuse once a field has changed. Failed saves stay retryable (the guard is always released in `finally`), and the detect-only-for-new-receipt / edit-bypasses rule is unchanged. No global state-machine framework was introduced; no already-started DB mutation is claimed cancellable.
- **Coverage:** `lib/__tests__/receiptReviewDuplicate.test.tsx` adds a controllable focus lifecycle (`useFocusEffect`) and account mock, and nine lifecycle scenarios: a field change during a pending check drops the stale result; blur without unmount stops a pending check from saving; refocus allows a fresh check and save; an account change during a pending check drops the result; replacing the draft invalidates a pending check; a stale "Save anyway" cannot authorize a changed snapshot; a field change after a failed check invalidates "save without checking"; rapid "Save anyway" presses perform exactly one save; a superseded check cannot release a newer check's guard. The fifteen existing DUP-02B scenarios are retained.
- **Follow-up findings (DUP-02B.2):** the first correction still let several lifecycle edges through. A repeated confirmation hit `invalidatePendingDuplicateWork`, which unconditionally cleared the single `inFlightRef` that also guarded an **already-running write** — so a second "Save anyway" could release an active write's lock. The snapshot (`buildSnapshotKey`) omitted most persisted data (receipt-item amounts, inclusion flags, categories, descriptions, and the manual RSD equivalent), so those could change during an async check while `performSave` held an older render closure. The post-`await` validity checks compared values captured by the original render rather than a genuinely current read. And `performSave` ran success feedback, draft clearing and navigation unconditionally, so a write that outlived its review session could clear a newer draft or navigate a different session/account.
- **Follow-up resolution (DUP-02B.2):** cancellable duplicate-check ownership is now fully separated from active-write ownership. A single monotonic `sessionRef` identifies the current cancellable session; `checkInFlightRef` guards a pending check (released by invalidation); `writeInFlightRef` guards an active write and is released **only** in the write's own `finally` — invalidation never touches it, so invalidating a check or approval can never unlock a running write. A `savePayloadKey` (`useMemo`) now covers every persisted field, including all receipt-item fields and the manual FX equivalent, and drives the invalidation effect. Async continuations validate against a fresh `sessionRef.current` read. Approval is bound to a specific session (`approvalRef` + an `approvalSession` render mirror the dialog/banner buttons close over) and consumed exactly once, so an obsolete or repeated confirmation — even with identical field values — is a harmless no-op. `runWrite` gates its success/error toast, draft clearing and navigation on the session still being current, so a stale write cannot disturb a newer draft/session or show account-inappropriate feedback. The screen is wrapped in an account-boundary (`key={accountId}`) so an account change fully remounts it, reloading that account's reference data and discarding any pending check/approval. Normal saves, advisory warnings, retry, explicit bypass, edit and delete-all are unchanged; no already-started mutation is treated as cancellable.
- **Follow-up coverage (DUP-02B.2):** seven added scenarios — double "Save anyway" plus a further attempt during the pending write performs one write; the same for double "Save without checking"; blur and a field change during an active write do not release its guard; editing item data during a pending check cannot save stale data; an old confirmation callback cannot authorize a newer check even with identical fields; a stale write completion does not clear a newer draft or navigate; an account change remounts and cannot reuse old reference data or authorize an old pending check. The "failed save is retryable" case stays covered by the existing retry test. All prior scenarios are retained (31/31).
- **Follow-up findings (DUP-02B.3):** three narrower edges remained. (1) `checkDuplicatesThenSave` read `sessionRef.current` without advancing it, so two consecutive checks in the same review session (close the warning, check again with unchanged fields) shared one approval identity — an obsolete "Save anyway" / "Save without checking" / Back callback could act on the newer decision (the earlier stale-confirmation test only advanced the session via blur/refocus, so it missed this). (2) `runWrite` called `learnItemCategoryRules` after awaiting persistence without binding it to the originating account, and `upsertItemCategoryRules` resolved the current authenticated account independently — so an account switch during a pending save could learn the old receipt's selections under the new account. (3) `ReceiptDraftProvider` sits above the account-keyed review screen and held no account scope, so a receipt draft was not guaranteed to be dropped when the account changed in place.
- **Follow-up resolution (DUP-02B.3):** (1) each check attempt now advances `sessionRef` (`session = (sessionRef.current += 1)`), giving every check a unique authorization identity; the approval, "Save anyway"/"Save without checking" and the Back callback are all bound to that identity, so an obsolete callback — even with identical field values — is a no-op and cannot dismiss or authorize a newer decision. (2) `upsertItemCategoryRules` takes an `expectedUserId` and rejects (writes nothing) when the authenticated account no longer matches; `runWrite` passes the review screen's originating `accountId`, so learning is bound to the account that owned the save rather than relying on hidden UI feedback. (3) `ReceiptDraftProvider` takes an `accountId` and resets the draft during render when it changes (reset-state-on-prop-change), so one account's in-progress receipt can never be inherited by another, with no stale-read window and without remounting unrelated providers. The separation of cancellable checks from the non-cancellable write (DUP-02B.2) is preserved.
- **Follow-up coverage (DUP-02B.3):** review scenarios — an old confirmation cannot save a re-checked warning with identical fields; an obsolete bypass cannot authorize a retried failed check; an obsolete Back cannot dismiss a newer warning; an account change during persistence learns only under the originating account. Rule-writer unit tests — `upsertItemCategoryRules` makes no DB access when the authenticated account differs from `expectedUserId`, and writes under the account when it matches. `ReceiptDraftProvider` tests — the draft survives same-account re-renders and is reset on an account change or a sign-out → different sign-in. All prior scenarios are retained.

### BUG-12 · ✅ Remembered manual currency went stale on a re-opened editor

- **Area:** manual expense editor (`components/ExpenseEditorScreen.tsx`)
- **Evidence:** `expense/new` is an Expo Router `Tabs.Screen`, so the editor can stay mounted between visits. `useFocusEffect` bumped `focusKey` to remount `ExpenseForm`, but the remembered-currency read lived in a `useEffect` keyed on `[accountId, expenseId, homeCurrency, t]` — not on focus. So after saving in a new currency and reopening the same mounted screen, the form could reinitialize with the previous visit's stale currency. Existing tests mocked `useFocusEffect` as a no-op and never exercised this lifecycle.
- **Resolution:** currency resolution is now tied to the focus lifecycle. The one-time load of categories/merchants/expense is separated from a focus-driven currency read that re-resolves on every new-expense focus. The form render is gated until the currency is resolved for the current focus (`currencyResolvedFocus === focusKey`), so a just-focused form never shows a currency carried over from an earlier visit. A per-focus session counter drops superseded async reads. The last-saved currency is held in an **account-scoped, module-level** in-memory cache in `lib/lastCurrency.ts` (not a screen-local ref), preferred over storage, so an immediate reopen — including through a new screen instance — cannot race the still-pending AsyncStorage write; per-account write chaining ensures an older write never overwrites a newer persisted value. The editor is wrapped in an account-keyed boundary (`key={accountId}`), so changing the authenticated account fully remounts and reloads, never showing the previous account's currency, categories, merchants or expense. Storage failures stay non-fatal; account isolation and custom currencies are preserved; categories/merchants/expense are not re-fetched merely to refresh the currency.
- **Coverage:** controllable focus/blur lifecycle on one mounted instance — save in a new currency then reopen uses it; an unsaved change is discarded on refocus; a stale pending read cannot override a newer focus; an immediate reopen during a pending write still restores the saved currency; a pending/failing write never blocks creation; editing keeps its original currency and reads no preference; changing account on a mounted screen reinitializes from the new account. `lib/lastCurrency.ts` adds account-isolation, in-session-preferred reads, read-in-flight-vs-newer-save ordering, overlapping-write ordering and reopen-during-pending-write coverage.

### BUG-11 · ✅ Reports gave no way to retry a failed data load

- **Area:** Reports (`app/(app)/reports.tsx`)
- **Evidence:** Home, Analytics, Categories and Merchants each offer a Retry action when a data load fails; Reports did not. Its load-error `StatusBanner` had no action, so a transient failure left the screen stuck with no recovery short of navigating away and back. The failure also reused `export.failed` ("couldn't export"), which mislabels a failed data load as a failed export.
- **Resolution:** Reports now follows the established retry pattern — a `retryKey` in the data-loading focus-effect dependencies, a Retry action on the load-error banner (`home.retry`) that refetches both `listExpensesByMonth` and `listCategoriesForManagement` for the selected month, clears the error and shows the loading indicator, and keeps export actions unavailable until both requests succeed. A dedicated `export.loadFailed` string describes the data-load failure; `export.failed` is unchanged for real export failures. The active-request cancellation guard and prepared-PDF lifecycle are preserved, and Retry never triggers CSV/XLSX/PDF generation.
- **Coverage:** a failed load exposes Retry with the data-load copy; Retry refetches both datasets for the selected month; loading returns and export stays unavailable during retry; a successful retry restores the export actions or the empty state; repeated failure stays recoverable; Retry triggers no export delivery.

### BUG-10 · ✅ Failed receipt save could leave an orphan merchant

- **Area:** receipt save (`lib/db/fiscalReceipts.ts` → `saveFiscalReceipt`)
- **Evidence:** a new merchant was inserted before the `try/catch` that writes the receipt and expense rows, but the compensating cleanup only deleted the expenses and receipt. A failed receipt insert left an empty merchant with nothing cleaned up; a failed expense insert cleaned the receipt but kept the new merchant. Both left an orphan place in the list, and a retry could then collide with the duplicate merchant.
- **Resolution:** `saveFiscalReceipt` now tracks whether this call created the merchant (`createdMerchantId`). On a failed save the compensating cleanup deletes that merchant, scoped by `id` and `user_id` — but only when it is safe: either the receipt was never created, or its dependent rows were cleaned up successfully. If a dependent cleanup step itself fails, the merchant is kept so a row that may still reference it is not orphaned worse. An existing merchant passed via `{ existingId }` is never deleted. A failing merchant cleanup is logged and never replaces the original save error.
- **Coverage:** new merchant + receipt-insert failure (merchant removed, no expense insert); new merchant + expense-insert failure (expenses then receipt cleaned, then merchant removed); existing merchant + expense failure (no merchant delete); a failing dependent cleanup (merchant kept); a failing merchant cleanup (original error still thrown). Not a transaction/RPC — a full SQL-transaction save remains a separate architectural task.

### BUG-9 · ✅ Management/reference reads could stop at the PostgREST row limit

- **Area:** category & merchant management (usage counts) and category/merchant merge/delete reference snapshots
- **Evidence:** `listCategoriesForManagement`, `listMerchantsForManagement`, `loadCategoryReferences` and `loadMerchantReferences` each issued a single unpaginated `.select()`. Usage counts could be undercounted past the row limit, and — more seriously — a merge/delete rollback restores exactly the pre-loaded snapshot, so a snapshot truncated at the limit could leave some re-pointed references unrestored if a later step failed.
- **Resolution:** all four reads now exhaust PostgREST pages through the shared `fetchAllRows` helper with deterministic `order('id', { ascending: true })` and `.range()`. Any page failure rejects the whole operation before any mutation runs, so merge/delete never starts on a partial snapshot. The small per-account categories/merchants lists stay single-reads by design; expense references are selected as `id,category_id` / `id,merchant_id` (the `id` enables stable ordering).
- **Coverage:** multi-page usage counts for categories and merchants; merge `affectedExpenses` counting rows beyond the first page; a later-page read error aborting before any `update`/`delete`; plus the existing re-point/rollback characterization tests. See `BUG-7` for the earlier Home/Analytics/Reports pagination fix this extends.

### BUG-6 · ✅ Serbian grouped amount input was rejected

- **Area:** money input parsing
- **Resolution:** `parseAmountInput` now accepts correctly grouped unsigned amounts through an explicit contract and still produces integer cents without floating-point money arithmetic. Group separators are removed only after the shape is confirmed, then the decimal separator is normalized.
- **Accepted grouped formats:** Serbian dot grouping with a comma decimal (`1.234`, `1.234,56`, `12.345,67`, `1.234.567,89`) and space grouping with a comma or dot decimal (`1 234`, `1 234,56`, `1 234.56`, `1 234 567,89`), including NBSP (` `) and narrow NBSP (` `) separators pasted from formatted text. Ungrouped values (`1234`, `1234,56`, `1234.56`, `12,5`, `12.5`) are unchanged.
- **Still rejected:** empty input, comma thousands format (`1,234.56`), malformed grouping (`1.23,45`, `1.234,567`, `12.34.567`, `1..234`, `1 23,45`, `1 234 56`), trailing/leading separators (`12,`, `.5`), three-decimal-digit values (`12,555`), letters/currency symbols, and values exceeding `Number.MAX_SAFE_INTEGER` cents.
- **Out of scope:** refunds / negative amounts remain a separate product/schema decision; `-5` and other negatives stay rejected.
- **Coverage:** table-driven accepted/rejected cases in `lib/__tests__/money.test.ts`, including NBSP/narrow NBSP, zero, leading zeros, the `MAX_SAFE_INTEGER` boundary (`90071992547409,91`), and overflow (`90071992547409,92`, `99999999999999999`). Existing ungrouped accepted forms and existing negative rejections are retained.

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
- **Commit:** `8f27e38` — prevent silent truncation of expense queries.

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
