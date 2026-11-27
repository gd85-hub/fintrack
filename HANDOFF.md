# HANDOFF — Fintrack
_Обновлено: 2026-11-27 · автор витка: Claude · задача: DUP-02B_

Это краткая дельта. Долгий контекст и обязательные правила — в `README.md` и `AGENTS.md`.

## Где мы

Защита от дублей чеков завершена до пользовательского уровня: review перед сохранением нового чека проверяет вероятные дубли и показывает advisory-предупреждение; пользователь решает сам. DUP-01 (matcher), DUP-02A (retrieval) и теперь DUP-02B (UI) все в проде. Авто-merge/delete/блокировки нет. Схема, RLS, FX, OCR/QR-парсинг не менялись. Предыдущий виток (REPORTS-02.3, векторный PDF на Web) остаётся актуальным и ждёт ручной проверки после отдельного Web deploy.

## Только что сделано

- `app/(app)/receipt/review.tsx`: для нового чека `handleSave` → `checkDuplicatesThenSave`: валидация → `findReceiptDuplicates(buildDuplicateInput())` до любой записи. Нет совпадений → обычное сохранение. Есть → `DuplicateWarningDialog`. `buildDuplicateInput` строится из подтверждённых значений формы (total/currency/occurredOn/merchant), не из устаревшего OCR-черновика; `occurredAt`/`taxId`/`merchantLabel` из draft. Edit-режим обходит детект (прежний `saveReview`); delete-all `ConfirmDialog` сохранён.
- Lifecycle/race: `inFlightRef` (sync-guard от повторных Save/Save-anyway/Save-without-checking), `checkTokenRef` (отбрасывает stale-результаты при смене draft/навигации — effect на `[draft, editReceiptId]` + cleanup на unmount). `performSave` всегда чистит `inFlightRef` в finally → failed save retryable. Диалог модальный, поэтому «Save anyway» идёт по текущему снапшоту; «Вернуться к проверке» просто закрывает, следующий Save перепроверяет.
- Check-failure: `duplicateCheckFailed` → `StatusBanner` (warning) с «Повторить» + DS Button «Сохранить без проверки». Не оставляет в loading.
- `components/DuplicateWarningDialog.tsx` (новый): non-destructive advisory модал (DS Button, токены). Показывает merchant/дату/сумму+валюту/источник, число совпадений при >1, сортировка strong→probable + детерминированный id-tiebreak. «Вернуться к проверке» (primary) / «Всё равно сохранить» (surface). Никогда не называет совпадение подтверждённым.
- i18n: `review.duplicate.*` (RU/EN): title/description/count/back/saveAnyway/checking/checkFailed/retry/saveWithoutChecking/sourceQr/sourcePhoto.
- Тесты: `lib/__tests__/receiptReviewDuplicate.test.tsx` (15, full render review): no-match сохраняет; дубль → предупреждение до записи; strong/probable advisory; Back → без записи + форма сохранена; Save anyway ровно один save; быстрые повторные нажатия → один save; corrected date/currency/total/merchant в детекте; смена поля после Back → перепроверка; stale после unmount → ничего; check-fail ≠ no-matches; retry/save-without-checking; failed save retryable; edit обходит детект; delete-all confirm сохранён.

## Состояние origin/main

Ветка `main`. Один атомарный commit `feat(receipts): warn before saving probable duplicate receipts`, запушен в `origin/main`. Новый компонент + review-интеграция + i18n + тесты + docs; save builders/parsers/FX/схема не трогались.

## Следующий шаг

Фича завершена. Опционально — живая проверка на устройстве (экран за авторизацией; здесь покрыто render-тестами).

## Открытые решения и риски

- Предупреждение advisory: `strong` и `probable` оба только предупреждают, ничего не блокируют/не мёржат.
- Candidate retrieval (DUP-02A) использует `.in('id', receiptIds)` по всем чекам за дату — на один день объём мал; при реальной проблеме размера запроса — bounded batching отдельной задачей (scalability consideration, не трогалось здесь).
- Снимок подтверждения привязан к модальности диалога (поле нельзя менять, пока диалог открыт); смена поля требует Back → следующий Save перепроверяет.
- `typecheck` зелёный; targeted `receiptReviewDuplicate` 15/15, `receiptDuplicates`/`dbReceiptDuplicates` зелёные; полный `test:ci` 1034/1034. Живой browser/device-verify не делался.
- Остальные открытые риски — прежние, по REPORTS-02.3: фактическое browser/OS сохранение PDF остаётся manual verification.

## Не трогать

- Детект только для НОВОГО чека; edit обходит его. Никакого авто-merge/delete/блокировки.
- `buildDuplicateInput` — только подтверждённые значения формы, не raw OCR.
- Не использовать destructive `ConfirmDialog` для advisory-предупреждения; `DuplicateWarningDialog` — non-destructive.
- Не ослаблять lifecycle-защиту (inFlightRef / checkTokenRef): они предотвращают двойные записи и stale-варнинги.
- Не переносить pdfmake/VFS в общий или native entry; Web PDF-движок должен оставаться lazy-loaded.
