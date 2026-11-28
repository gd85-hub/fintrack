# HANDOFF — Fintrack
_Обновлено: 2026-11-28 · автор витка: Claude · задача: DUP-02B.1_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Защита от дублей чеков доведена до пользовательского уровня и теперь устойчива к жизненному циклу экрана review: DUP-01 (matcher), DUP-02A (retrieval), DUP-02B (UI-предупреждение) и DUP-02B.1 (hardening). Авто-merge/delete/блокировок нет. Схема, RLS, FX, OCR/QR-парсинг не менялись.

**Важно про прод:** merge в `main` не доказывает деплой. DUP-01/02A/02B/02B.1 влиты в `main`, но из репозитория нельзя заключить, что соответствующая web/Android-сборка выпущена пользователям. Любой статус «в проде» подтверждается отдельно фактом деплоя, не наличием кода в `main`. Предыдущий виток REPORTS-02.3 (векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `app/(app)/receipt/review.tsx`: проверка дублей и подтверждения привязаны к аккаунту, draft, навигационной сессии и проверенному снимку сохранения.
  - `inFlightRef` теперь хранит токен владеющей операции (не boolean): `beginOperation` берёт замок (sync-защита от повторных нажатий), `endOperation` снимает его только если токен всё ещё совпадает (устаревшая операция не освободит замок более новой), `invalidatePendingDuplicateWork` двигает токен, снимает замок и чистит снимок + decision-state.
  - `checkedSnapshotRef` + `buildSnapshotKey()` фиксируют matching-релевантный снимок (аккаунт, подтверждённый тотал, валюта, дата, место). `useEffect` на `[accountId, draft, editReceiptId, confirmedReceiptTotalCents, receiptCurrency, occurredOn, merchantMode, merchantId, merchantName]` инвалидирует любую незавершённую проверку/одобрение при смене любого из них.
  - `useFocusEffect` инвалидирует при blur (а не только при unmount). `useAuth` даёт `accountId`.
  - После `await` в `checkDuplicatesThenSave` сохранение без совпадений идёт только если токен ещё текущий и снимок+аккаунт совпадают с проверенными. «Save anyway» / «Save without checking» авторизуют ровно проверенный снимок и отказывают после правки поля; `onBack` сбрасывает одобрение. `performSave` всегда снимает замок в `finally` → failed save retryable.
- Тесты: `lib/__tests__/receiptReviewDuplicate.test.tsx` — добавлены управляемый focus-lifecycle (`useFocusEffect`) и мок аккаунта, +9 сценариев (смена поля / аккаунта / draft во время pending-проверки; blur без unmount; refocus → свежая проверка; stale «Save anyway» не авторизует изменённый снимок; правка после ошибки инвалидирует bypass; быстрые «Save anyway» = один save; устаревшая проверка не освобождает замок новой). 15 прежних DUP-02B сценариев сохранены — итого 24/24.
- Доки: `BUGS.md` (BUG-13, fixed + покрытие), `CHANGELOG.md` (Fixed), `BACKLOG.md` (DUP-02B.1 ✅).

## Состояние origin/main

Ветка `main`. Один атомарный commit `fix(receipts): guard duplicate checks against stale review sessions`, запушен в `origin/main`. Только review-экран + его тест + docs; save builders/parsers/FX/схема/матчинг-политика не трогались.

## Следующий шаг

Задача закрыта. Опционально — живая проверка на устройстве (экран за авторизацией; здесь покрыто render-тестами с управляемым focus/account).

## Открытые решения и риски

- Предупреждение остаётся advisory: `strong` и `probable` только предупреждают, ничего не блокируют/не мёржат.
- Снимок одобрения привязан к модальности диалога (поле нельзя менять, пока диалог открыт); программная правка поля инвалидирует одобрение — следующий Save перепроверяет.
- `useFocusEffect` в тесте замокан управляемой реализацией (focus/blur/unmount); реальное поведение React Navigation здесь не прогоняется.
- Candidate retrieval (DUP-02A) использует `.in('id', receiptIds)` по чекам за дату — на один день объём мал; bounded batching — отдельная задача при реальной проблеме размера запроса (не трогалось здесь).
- `typecheck` зелёный; `receiptReviewDuplicate` 24/24. Полный `test:ci` — прогнать перед/в коммите. Живой browser/device-verify не делался.
- REPORTS-02.3: фактическое browser/OS-сохранение PDF остаётся manual verification после Web deploy.

## Не трогать

- Детект только для НОВОГО чека; edit обходит его. Никакого авто-merge/delete/блокировки.
- `buildDuplicateInput` — только подтверждённые значения формы, не raw OCR.
- Не ослаблять lifecycle-защиту: токен-замок (`inFlightRef`/`checkTokenRef`), `checkedSnapshotRef`, инвалидация по полям/аккаунту/focus. `endOperation` снимает замок только по совпадающему токену.
- Не использовать destructive `ConfirmDialog` для advisory-предупреждения; `DuplicateWarningDialog` — non-destructive.
- Не вводить глобальный state-machine фреймворк ради этого; не утверждать, что начавшаяся запись в БД отменяема/откатываема.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
